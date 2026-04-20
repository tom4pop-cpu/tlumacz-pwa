"use strict";

const LANG_NAMES = {
  pl: "Polski",
  en: "Angielski",
  es: "Hiszpański",
};

const LANG_FULL = {
  pl: "Polish",
  en: "English",
  es: "Spanish",
};

const CONTEXT_PROMPTS = {
  auto: "Automatically detect the register (formal/casual) and match it.",
  casual: "Use casual, everyday conversational language. Sound like a native speaker chatting with a friend.",
  formal: "Use formal, polite register. Sound professional but not stiff.",
  legal: "Use precise legal and compliance terminology (GDPR/RODO, AML, contracts). Preserve legal nuance exactly. When a term has a specific legal meaning, use the correct equivalent in the target jurisdiction.",
  business: "Use professional business language suitable for emails, negotiations, and meetings. Clear, direct, polite.",
};

const state = {
  src: "pl",
  tgt: "en",
  context: "auto",
  apiKey: localStorage.getItem("openai_api_key") || "",
  voice: localStorage.getItem("tts_voice") || "nova",
  recording: false,
  mediaRecorder: null,
  audioChunks: [],
  lastTranslation: "",
  history: JSON.parse(localStorage.getItem("history") || "[]"),
};

const $ = (id) => document.getElementById(id);

function setStatus(msg, type = "") {
  const el = $("status");
  el.textContent = msg;
  el.className = "status" + (type ? " " + type : "");
}

function updateLangLabels() {
  $("src-label").textContent = LANG_NAMES[state.src];
  $("tgt-label").textContent = LANG_NAMES[state.tgt];
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    const active = btn.dataset.src === state.src && btn.dataset.tgt === state.tgt;
    btn.classList.toggle("active", active);
  });
}

function loadActiveLangFromStorage() {
  const saved = localStorage.getItem("lang_pair");
  if (saved) {
    const [src, tgt] = saved.split("-");
    if (LANG_NAMES[src] && LANG_NAMES[tgt]) {
      state.src = src;
      state.tgt = tgt;
    }
  }
  updateLangLabels();
}

function saveActiveLang() {
  localStorage.setItem("lang_pair", `${state.src}-${state.tgt}`);
}

function renderHistory() {
  const list = $("history-list");
  list.innerHTML = "";
  state.history.slice(0, 10).forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="history-src">${escapeHtml(item.src)}</div>
      <div class="history-tgt">${escapeHtml(item.tgt)}</div>
    `;
    li.onclick = () => {
      $("src-text").value = item.src;
      $("tgt-text").textContent = item.tgt;
      state.lastTranslation = item.tgt;
      $("play-btn").disabled = false;
      $("copy-btn").disabled = false;
    };
    list.appendChild(li);
  });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function addToHistory(src, tgt) {
  state.history.unshift({ src, tgt, ts: Date.now() });
  state.history = state.history.slice(0, 20);
  localStorage.setItem("history", JSON.stringify(state.history));
  renderHistory();
}

async function callOpenAI(endpoint, body, isForm = false) {
  if (!state.apiKey) {
    throw new Error("Brak klucza API. Otwórz ⚙️ Ustawienia i wklej klucz.");
  }
  const headers = { Authorization: `Bearer ${state.apiKey}` };
  if (!isForm) headers["Content-Type"] = "application/json";
  const resp = await fetch(`https://api.openai.com/v1/${endpoint}`, {
    method: "POST",
    headers,
    body: isForm ? body : JSON.stringify(body),
  });
  if (!resp.ok) {
    let msg = `OpenAI API ${resp.status}`;
    try {
      const err = await resp.json();
      if (err.error?.message) msg = err.error.message;
    } catch {}
    throw new Error(msg);
  }
  return resp;
}

async function transcribe(audioBlob) {
  setStatus("Transkrypcja...");
  const form = new FormData();
  form.append("file", audioBlob, "audio.webm");
  form.append("model", "whisper-1");
  form.append("language", state.src);
  form.append("response_format", "json");
  const resp = await callOpenAI("audio/transcriptions", form, true);
  const data = await resp.json();
  return data.text.trim();
}

async function translate(text) {
  setStatus("Tłumaczenie...");
  const srcLang = LANG_FULL[state.src];
  const tgtLang = LANG_FULL[state.tgt];
  const contextInstruction = CONTEXT_PROMPTS[state.context];
  const systemPrompt = `You are a professional translator ${srcLang}→${tgtLang}. ${contextInstruction}

Rules:
- Translate naturally, as a fluent native speaker would say it.
- Preserve meaning, tone, and intent exactly.
- Do NOT add explanations, notes, or alternatives — output ONLY the translation.
- If the input is already in ${tgtLang}, translate it to ${srcLang} instead (auto-reverse).
- Keep names, numbers, and dates unchanged unless localization is required.`;

  const resp = await callOpenAI("chat/completions", {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: text },
    ],
    temperature: 0.3,
  });
  const data = await resp.json();
  return data.choices[0].message.content.trim();
}

async function speak(text) {
  setStatus("Generowanie głosu...");
  const resp = await callOpenAI("audio/speech", {
    model: "tts-1",
    voice: state.voice,
    input: text,
    response_format: "mp3",
  });
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.play();
  setStatus("");
}

async function startRecording() {
  if (!state.apiKey) {
    setStatus("Najpierw dodaj klucz API (⚙️)", "error");
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "audio/webm";
    state.mediaRecorder = new MediaRecorder(stream, { mimeType });
    state.audioChunks = [];
    state.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) state.audioChunks.push(e.data);
    };
    state.mediaRecorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(state.audioChunks, { type: mimeType });
      await processAudio(blob);
    };
    state.mediaRecorder.start();
    state.recording = true;
    $("mic-btn").classList.add("recording");
    setStatus("Nagrywam... puść, aby zakończyć");
  } catch (e) {
    setStatus("Brak dostępu do mikrofonu: " + e.message, "error");
  }
}

function stopRecording() {
  if (state.mediaRecorder && state.recording) {
    state.mediaRecorder.stop();
    state.recording = false;
    $("mic-btn").classList.remove("recording");
  }
}

async function processAudio(blob) {
  try {
    const text = await transcribe(blob);
    if (!text) {
      setStatus("Nic nie usłyszałem", "error");
      return;
    }
    $("src-text").value = text;
    await doTranslate(text);
  } catch (e) {
    setStatus("Błąd: " + e.message, "error");
  }
}

async function doTranslate(text) {
  try {
    const translated = await translate(text);
    $("tgt-text").textContent = translated;
    state.lastTranslation = translated;
    $("play-btn").disabled = false;
    $("copy-btn").disabled = false;
    addToHistory(text, translated);
    setStatus("Gotowe", "success");
    setTimeout(() => setStatus(""), 1500);
  } catch (e) {
    setStatus("Błąd: " + e.message, "error");
  }
}

function initUI() {
  loadActiveLangFromStorage();
  renderHistory();

  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.onclick = () => {
      state.src = btn.dataset.src;
      state.tgt = btn.dataset.tgt;
      saveActiveLang();
      updateLangLabels();
    };
  });

  $("context").onchange = (e) => {
    state.context = e.target.value;
  };

  const micBtn = $("mic-btn");
  const startHandler = (e) => {
    e.preventDefault();
    if (!state.recording) startRecording();
  };
  const stopHandler = (e) => {
    e.preventDefault();
    if (state.recording) stopRecording();
  };
  micBtn.addEventListener("touchstart", startHandler, { passive: false });
  micBtn.addEventListener("touchend", stopHandler);
  micBtn.addEventListener("touchcancel", stopHandler);
  micBtn.addEventListener("mousedown", startHandler);
  micBtn.addEventListener("mouseup", stopHandler);
  micBtn.addEventListener("mouseleave", stopHandler);

  $("translate-btn").onclick = async () => {
    const text = $("src-text").value.trim();
    if (!text) {
      setStatus("Wpisz lub wymów coś najpierw", "error");
      return;
    }
    await doTranslate(text);
  };

  $("play-btn").onclick = async () => {
    if (!state.lastTranslation) return;
    try {
      await speak(state.lastTranslation);
    } catch (e) {
      setStatus("Błąd: " + e.message, "error");
    }
  };

  $("copy-btn").onclick = async () => {
    if (!state.lastTranslation) return;
    try {
      await navigator.clipboard.writeText(state.lastTranslation);
      setStatus("Skopiowano", "success");
      setTimeout(() => setStatus(""), 1200);
    } catch {
      setStatus("Nie udało się skopiować", "error");
    }
  };

  $("clear-btn").onclick = () => {
    $("src-text").value = "";
    $("tgt-text").textContent = "";
    state.lastTranslation = "";
    $("play-btn").disabled = true;
    $("copy-btn").disabled = true;
    setStatus("");
  };

  $("settings-btn").onclick = () => {
    $("api-key").value = state.apiKey;
    $("voice").value = state.voice;
    $("settings-modal").classList.remove("hidden");
  };

  $("close-settings").onclick = () => {
    $("settings-modal").classList.add("hidden");
  };

  $("save-settings").onclick = () => {
    const key = $("api-key").value.trim();
    const voice = $("voice").value;
    if (key) {
      state.apiKey = key;
      localStorage.setItem("openai_api_key", key);
    }
    state.voice = voice;
    localStorage.setItem("tts_voice", voice);
    $("settings-modal").classList.add("hidden");
    setStatus("Ustawienia zapisane", "success");
    setTimeout(() => setStatus(""), 1500);
  };

  $("clear-history").onclick = () => {
    if (confirm("Na pewno wyczyścić całą historię?")) {
      state.history = [];
      localStorage.setItem("history", "[]");
      renderHistory();
    }
  };

  if (!state.apiKey) {
    setTimeout(() => {
      $("settings-btn").click();
      setStatus("Wklej klucz API, aby zacząć", "error");
    }, 300);
  }
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

initUI();

"use strict";

const LANG_FULL = { pl: "Polish", en: "English", es: "Spanish" };

const WHISPER_PROMPTS = {
  pl: "Rozmowa po polsku. Cześć, dzień dobry, jak się masz? Dziękuję bardzo. Proszę powtórzyć. Przepraszam, nie zrozumiałem.",
  en: "English conversation. Hello, how are you? Thank you very much. Please repeat that. Sorry, I did not understand.",
  es: "Conversación en español. Hola, ¿cómo estás? Muchas gracias. ¿Puedes repetir, por favor? Perdón, no entendí.",
};

const state = {
  panels: {
    A: { lang: localStorage.getItem("panelA_lang") || "pl", lastText: "", recording: false, recorder: null, chunks: [] },
    B: { lang: localStorage.getItem("panelB_lang") || "en", lastText: "", recording: false, recorder: null, chunks: [] },
  },
  apiKey: localStorage.getItem("openai_api_key") || "",
  voice: localStorage.getItem("tts_voice") || "nova",
  autoplay: localStorage.getItem("autoplay") !== "false",
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const panelEl = (p, cls) => document.querySelector(`.${cls}[data-panel="${p}"]`);

function setStatus(panel, msg, type = "") {
  const el = panelEl(panel, "status");
  el.textContent = msg;
  el.className = "status" + (type ? " " + type : "");
  if (type === "success") setTimeout(() => { if (el.textContent === msg) el.textContent = ""; }, 1500);
}

function otherPanel(p) { return p === "A" ? "B" : "A"; }

function applyLangSelections() {
  panelEl("A", "lang-select").value = state.panels.A.lang;
  panelEl("B", "lang-select").value = state.panels.B.lang;
}

async function callOpenAI(endpoint, body, isForm = false) {
  if (!state.apiKey) throw new Error("Brak klucza API. Otwórz ⚙️ i wklej klucz.");
  const headers = { Authorization: `Bearer ${state.apiKey}` };
  if (!isForm) headers["Content-Type"] = "application/json";
  const resp = await fetch(`https://api.openai.com/v1/${endpoint}`, {
    method: "POST",
    headers,
    body: isForm ? body : JSON.stringify(body),
  });
  if (!resp.ok) {
    let msg = `OpenAI API ${resp.status}`;
    try { const err = await resp.json(); if (err.error?.message) msg = err.error.message; } catch {}
    throw new Error(msg);
  }
  return resp;
}

async function transcribe(audioBlob, lang) {
  const form = new FormData();
  const ext = audioBlob.type.includes("mp4") ? "m4a" : "webm";
  form.append("file", audioBlob, `audio.${ext}`);
  form.append("model", "whisper-1");
  form.append("language", lang);
  form.append("prompt", WHISPER_PROMPTS[lang]);
  form.append("response_format", "json");
  form.append("temperature", "0");
  const resp = await callOpenAI("audio/transcriptions", form, true);
  return (await resp.json()).text.trim();
}

async function translate(text, srcLang, tgtLang) {
  if (srcLang === tgtLang) return text;
  const systemPrompt = `You are a professional translator. Translate from ${LANG_FULL[srcLang]} to ${LANG_FULL[tgtLang]}.

Rules:
- Output ONLY the translation — no explanations, no quotes, no notes, no alternatives.
- Translate naturally, the way a native ${LANG_FULL[tgtLang]} speaker would actually say it in a real conversation.
- Preserve meaning, tone, and register (casual stays casual, formal stays formal).
- Keep proper nouns, numbers, dates, and brand names unchanged.
- If the input is a common greeting or phrase, use the natural equivalent, not a word-by-word translation.
- Never repeat or paraphrase the source text — translate it.`;

  const resp = await callOpenAI("chat/completions", {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: text },
    ],
    temperature: 0.2,
  });
  const data = await resp.json();
  return data.choices[0].message.content.trim();
}

async function speak(text, voice) {
  const resp = await callOpenAI("audio/speech", {
    model: "tts-1",
    voice,
    input: text,
    response_format: "mp3",
  });
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  try { await audio.play(); } catch {}
}

async function startRecording(panel) {
  if (!state.apiKey) {
    setStatus(panel, "Najpierw wklej klucz API (⚙️)", "error");
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "audio/webm";
    const recorder = new MediaRecorder(stream, { mimeType });
    state.panels[panel].recorder = recorder;
    state.panels[panel].chunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) state.panels[panel].chunks.push(e.data); };
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(state.panels[panel].chunks, { type: mimeType });
      await processAudio(panel, blob);
    };
    recorder.start();
    state.panels[panel].recording = true;
    panelEl(panel, "mic-btn").classList.add("recording");
    setStatus(panel, "Nagrywam... puść, aby zakończyć");
  } catch (e) {
    setStatus(panel, "Brak dostępu do mikrofonu: " + e.message, "error");
  }
}

function stopRecording(panel) {
  const p = state.panels[panel];
  if (p.recorder && p.recording) {
    p.recorder.stop();
    p.recording = false;
    panelEl(panel, "mic-btn").classList.remove("recording");
  }
}

async function processAudio(panel, blob) {
  try {
    const srcLang = state.panels[panel].lang;
    setStatus(panel, "Transkrypcja...");
    const text = await transcribe(blob, srcLang);
    if (!text) {
      setStatus(panel, "Nic nie usłyszałem", "error");
      return;
    }
    panelEl(panel, "panel-text").value = text;
    await translateAndShow(panel, text);
  } catch (e) {
    setStatus(panel, "Błąd: " + e.message, "error");
  }
}

async function translateAndShow(srcPanel, text) {
  const tgtPanel = otherPanel(srcPanel);
  const srcLang = state.panels[srcPanel].lang;
  const tgtLang = state.panels[tgtPanel].lang;
  if (srcLang === tgtLang) {
    setStatus(srcPanel, "Oba panele mają ten sam język", "error");
    return;
  }
  setStatus(srcPanel, "Tłumaczenie...");
  try {
    const translated = await translate(text, srcLang, tgtLang);
    panelEl(tgtPanel, "panel-text").value = translated;
    state.panels[tgtPanel].lastText = translated;
    state.panels[srcPanel].lastText = text;
    enableActions(tgtPanel);
    enableActions(srcPanel);
    setStatus(srcPanel, "Gotowe", "success");
    if (state.autoplay) {
      speak(translated, state.voice).catch(() => {});
    }
  } catch (e) {
    setStatus(srcPanel, "Błąd: " + e.message, "error");
  }
}

function enableActions(panel) {
  panelEl(panel, "play-btn").disabled = !panelEl(panel, "panel-text").value.trim();
  panelEl(panel, "copy-btn").disabled = !panelEl(panel, "panel-text").value.trim();
}

function setupPanel(panel) {
  const mic = panelEl(panel, "mic-btn");
  const start = (e) => { e.preventDefault(); if (!state.panels[panel].recording) startRecording(panel); };
  const stop = (e) => { e.preventDefault(); if (state.panels[panel].recording) stopRecording(panel); };
  mic.addEventListener("touchstart", start, { passive: false });
  mic.addEventListener("touchend", stop);
  mic.addEventListener("touchcancel", stop);
  mic.addEventListener("mousedown", start);
  mic.addEventListener("mouseup", stop);
  mic.addEventListener("mouseleave", stop);

  panelEl(panel, "send-btn").onclick = async () => {
    const text = panelEl(panel, "panel-text").value.trim();
    if (!text) { setStatus(panel, "Najpierw wpisz lub nagraj tekst", "error"); return; }
    await translateAndShow(panel, text);
  };

  panelEl(panel, "lang-select").onchange = (e) => {
    state.panels[panel].lang = e.target.value;
    localStorage.setItem(`panel${panel}_lang`, e.target.value);
  };

  panelEl(panel, "clear-btn").onclick = () => {
    panelEl(panel, "panel-text").value = "";
    state.panels[panel].lastText = "";
    enableActions(panel);
    setStatus(panel, "");
  };

  panelEl(panel, "play-btn").onclick = async () => {
    const text = panelEl(panel, "panel-text").value.trim();
    if (!text) return;
    setStatus(panel, "Odtwarzanie...");
    try { await speak(text, state.voice); setStatus(panel, ""); }
    catch (e) { setStatus(panel, "Błąd: " + e.message, "error"); }
  };

  panelEl(panel, "copy-btn").onclick = async () => {
    const text = panelEl(panel, "panel-text").value.trim();
    if (!text) return;
    try { await navigator.clipboard.writeText(text); setStatus(panel, "Skopiowano", "success"); }
    catch { setStatus(panel, "Nie udało się skopiować", "error"); }
  };

  panelEl(panel, "paste-btn").onclick = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) { setStatus(panel, "Schowek pusty", "error"); return; }
      panelEl(panel, "panel-text").value = text;
      enableActions(panel);
      setStatus(panel, "Wklejono", "success");
    } catch { setStatus(panel, "Brak dostępu do schowka", "error"); }
  };

  panelEl(panel, "panel-text").addEventListener("input", () => enableActions(panel));
}

function initUI() {
  applyLangSelections();
  setupPanel("A");
  setupPanel("B");

  $("#swap-btn").onclick = () => {
    const a = state.panels.A.lang;
    state.panels.A.lang = state.panels.B.lang;
    state.panels.B.lang = a;
    localStorage.setItem("panelA_lang", state.panels.A.lang);
    localStorage.setItem("panelB_lang", state.panels.B.lang);
    applyLangSelections();
    const aText = panelEl("A", "panel-text").value;
    const bText = panelEl("B", "panel-text").value;
    panelEl("A", "panel-text").value = bText;
    panelEl("B", "panel-text").value = aText;
    enableActions("A"); enableActions("B");
  };

  $("#settings-btn").onclick = () => {
    $("#api-key").value = state.apiKey;
    $("#voice").value = state.voice;
    $("#autoplay").checked = state.autoplay;
    $("#settings-modal").classList.remove("hidden");
  };

  $("#close-settings").onclick = () => $("#settings-modal").classList.add("hidden");

  $("#save-settings").onclick = () => {
    const key = $("#api-key").value.trim();
    if (key) { state.apiKey = key; localStorage.setItem("openai_api_key", key); }
    state.voice = $("#voice").value; localStorage.setItem("tts_voice", state.voice);
    state.autoplay = $("#autoplay").checked; localStorage.setItem("autoplay", state.autoplay);
    $("#settings-modal").classList.add("hidden");
  };

  if (!state.apiKey) {
    setTimeout(() => {
      $("#settings-btn").click();
      setStatus("A", "Wklej klucz API, aby zacząć", "error");
    }, 300);
  }
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

initUI();

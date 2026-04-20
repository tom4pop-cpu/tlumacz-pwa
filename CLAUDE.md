# Tłumacz PWA — PL ⇄ EN/ES

## Cel
Progressive Web App (PWA) na iPhone'a do szybkiego, jakościowego tłumaczenia PL↔EN i PL↔ES z użyciem AI (OpenAI):
- Whisper API — transkrypcja głosu (świetna jakość PL)
- GPT-4o-mini — tłumaczenie z kontekstem (prawniczy, biznesowy, potoczny, formalny)
- OpenAI TTS (nova) — naturalne czytanie wyniku
- Działa jak aplikacja po dodaniu do ekranu głównego (Safari → Udostępnij → Do ekranu głównego)

## Stan
Utworzony 2026-04-19. Plik CLAUDE.md + będą: index.html, style.css, app.js, manifest.json, sw.js, ikony, README.

## Następne kroki
1. Zbudować pliki PWA (HTML/CSS/JS/manifest/service worker)
2. Wygenerować ikony
3. Wypchnąć na GitHub Pages (konto tom4pop-cpu)
4. Dostarczyć URL + instrukcję wklejenia klucza API w przeglądarce

## Notatki
- Klucz OpenAI **nigdy** nie trafia do kodu ani na GitHuba — tylko do localStorage przeglądarki po stronie klienta
- User ma już Apple Translate na telefonie (odrębnie, jako offline fallback)
- Priorytety: 1) jakość 2) szybkość 3) offline (nice-to-have, pomijamy w tej apce)
- Koszt tłumaczenia głosowego: ~$0.005 (Whisper + GPT + TTS razem)

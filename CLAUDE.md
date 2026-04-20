# Tłumacz PWA — PL ⇄ EN/ES

## Cel
Progressive Web App (PWA) na iPhone'a do szybkiego, jakościowego tłumaczenia PL↔EN i PL↔ES z użyciem AI (OpenAI):
- Whisper API — transkrypcja głosu (świetna jakość PL)
- GPT-4o-mini — tłumaczenie z kontekstem (prawniczy, biznesowy, potoczny, formalny)
- OpenAI TTS (nova) — naturalne czytanie wyniku
- Działa jak aplikacja po dodaniu do ekranu głównego (Safari → Udostępnij → Do ekranu głównego)

## Stan
Utworzony i wdrożony 2026-04-19. Działa na: **https://tom4pop-cpu.github.io/tlumacz-pwa/**

Repo: https://github.com/tom4pop-cpu/tlumacz-pwa

Pliki: index.html, style.css, app.js, manifest.json, sw.js, icon-192.png, icon-512.png, README.md

## Następne kroki
- User odświeża klucz OpenAI (ten ze starego czatu trzeba unieważnić), wkleja w ⚙️ Ustawienia w apce
- User dodaje apkę do ekranu głównego iPhone'a (Safari → Udostępnij → Do ekranu głównego)
- Ewentualne poprawki po testach: dodatkowe języki, lepsze prompty, ikony, Shortcut-trigger z Siri

## Notatki
- Klucz OpenAI **nigdy** nie trafia do kodu ani na GitHuba — tylko do localStorage przeglądarki po stronie klienta
- User ma już Apple Translate na telefonie (odrębnie, jako offline fallback)
- Priorytety: 1) jakość 2) szybkość 3) offline (nice-to-have, pomijamy w tej apce)
- Koszt tłumaczenia głosowego: ~$0.005 (Whisper + GPT + TTS razem)

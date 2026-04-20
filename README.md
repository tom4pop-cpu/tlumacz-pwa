# Tłumacz PWA

Progressive Web App do szybkiego tłumaczenia PL ⇄ EN/ES zasilana OpenAI (Whisper + GPT-4o-mini + TTS).

## Funkcje

- 🎙️ Nagrywanie głosem (Whisper API) — transkrypcja polskiego na poziomie natywnym
- 🤖 Tłumaczenie przez GPT-4o-mini z wyborem kontekstu (potoczny / formalny / prawniczy / biznesowy)
- 🔊 Czytanie wyniku naturalnym głosem (OpenAI TTS)
- 📋 Kopiowanie do schowka, historia ostatnich 20 tłumaczeń
- 📱 iPhone-first, ciemny motyw, dodawalna do ekranu głównego jako apka
- 🔐 Klucz API trzymany wyłącznie w `localStorage` przeglądarki — nigdy nie opuszcza telefonu

## Jak używać

1. Otwórz URL na iPhonie w Safari
2. Udostępnij → "Do ekranu głównego"
3. Otwórz aplikację, kliknij ⚙️, wklej swój klucz OpenAI API
4. Wybierz kierunek tłumaczenia, kontekst i nagrywaj głosem lub wpisuj tekst

## Koszt

~$0.005 za tłumaczenie głosowe (Whisper + GPT + TTS razem).

## Stack

- Czysty HTML/CSS/JS (bez frameworków)
- OpenAI API (Whisper, GPT-4o-mini, TTS)
- MediaRecorder API (nagranie), Clipboard API (kopiuj)
- Service Worker (cache assetów, offline load UI)
- GitHub Pages (hosting, HTTPS)

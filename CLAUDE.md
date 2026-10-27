# CLAUDE.md – Griffbrett-Trainer

Private Gitarren-App für einen erwachsenen, ausgebildeten Musiker (E-Gitarre, spielt nach Gefühl). Ziel: Griffbrett-Töne verinnerlichen als Basis für Intervalle, Tonleitern, Modes, CAGED. Vollständiges Konzept: `Konzeptnotiz_Griffbrett-Trainer_fuer_Code.md` (lokal, nicht im Repo). Stand und Roadmap: `README.md`.

## Rahmen
- **Privat:** eigenes Repo `mitlaeuferfotografie/griffbrett-trainer`, GitHub Pages. **Nie** auf der Übersichtsseite mitlaeuferfotografie.github.io eintragen (den Skill `lern-app-uebersicht` hier nicht verwenden). Kein Teil des Musik-App-Ökosystems für die Schule.
- Die Schulregeln der Lern-Apps gelten **nicht** (keine Sterne, kein Spielstand-Code, kein Lehrer-Bereich, keine kindgerechten Texte, kein Dienst-Impressum). Gemeinsame Technik schon: React 18, Tailwind v3 beim Bauen erzeugt, `lucide-react`, esbuild, keine Drittanbieter zur Laufzeit (kein CDN, keine Webfonts, keine Analyse), Tailwind-Klassen immer vollständig ausschreiben.
- **Impressum & Datenschutz** in `LegalModal` (App.jsx), private Angaben in der Konstante `IMPRESSUM` (nicht das Dienst-Impressum der Schul-Apps). Rechtstext nur nach Vorgabe des Nutzers ändern.
- Hauptgerät **iPhone Safari, Hochformat**, als Homescreen-App. Desktop nur nebenbei.

## Code-Struktur
- Oberfläche in `src/App.jsx`. **Audio- und Lernlogik in eigenen Modulen** (`src/audio/*`, `src/lib/*`), ohne React und ohne Browser-Abhängigkeit, wo möglich, damit sie in Node getestet und für Ausbaustufe 2/3 wiederverwendet werden können.
- Tonhöhen intern immer als MIDI-Zahl (69 = a′), Namen nur bei der Anzeige über `notes.js` (Einstellung deutsch H/B oder international B/B♭; Vorzeichen ♯/♭/beide).
- **Griffbrett-Darstellung (Vorgabe des Nutzers): dicke/tiefste Saite immer links, höchste Saite rechts** – in Stimmgerät-Saitenleiste, Heatmap, Mini-Griffbrett, Icons. Bei senkrechtem Griffbrett: Saiten als Spalten (tief → hoch von links nach rechts), Sattel oben.
- Saitenindex 0 = tiefste Saite. Griffbrett-Logik rechnet mit den Leersaiten der **aktiven Stimmung**. Stimmungen sind Daten in `tunings.js`, nie in der UI hartkodieren.
- Abgefragt werden immer die **gegriffenen/klingenden** Töne der aktiven Stimmung. Grundeinstellung Standard E. Kein Eb-Standard (vom Nutzer nicht gewünscht).
- `pages.yml` weicht von den Schwester-Apps ab: `npm ci`, `npm test`, `npm run build` (scripts/build.mjs). Tests müssen grün sein, sonst wird nicht veröffentlicht.

## Tonerkennung (Fundament, mit Vorsicht ändern)
- YIN in `src/audio/pitch.js`, Puffer 4096, 50–1500 Hz, Oktavfehler-Korrektur über 2τ/3τ. `detector.js`: Pegelschwelle, Stabilitätsfenster, Oktavausreißer, Anschlagserkennung.
- `getUserMedia` mit `echoCancellation`, `noiseSuppression`, `autoGainControl` = false.
- iOS: `startMic()` nur direkt aus einem Klick-Handler aufrufen (AudioContext + resume synchron). Nach Bildschirmsperre/App-Wechsel → Status `interrupted` und Button „Fortsetzen“. Mikrofon beim Verlassen der Ansicht freigeben (`stopMic`).
- Jede Änderung an pitch.js/detector.js: `npm test` laufen lassen (Selbsttest 55–1320 Hz, 6 Wellenformen, 44,1/48 kHz, Audiostrom-Test). Bei neuen Problemen vom echten Gerät einen passenden synthetischen Test ergänzen.

## Gestaltung
- Formensprache der Deutsch-Apps (z. B. Pronomen-Magie), aber **erwachsen und ruhig**: dunkler Grund (slate-950/900), helle Schrift, Indigo als Akzent, `rounded-2xl`/`rounded-3xl`, `border-2`, `font-black` für Überschriften und Aufgaben, Systemschrift.
- **Keine** Spielwelt, Figuren, Emojis, Sterne, Konfetti, verspielten Animationen. Gamification wie in Trainings-Apps (Bestwerte, Meilensteine, Levels), nichts bestraft, **kein Streak, der auf null fällt**.
- Farben mit Bedeutung: Grün im Stimmgerät nur für „gestimmt“ (±3 Cent); in der Heatmap feste Farben für nicht eingeführt / unsicher / wird / sitzt.
- Aufgaben groß, aus ca. 1 m lesbar; große Touch-Ziele; während Übungen möglichst keine Bedienung nötig. Kein `confirm()`/`alert()`, Bestätigungen in der App.
- Texte: Deutsch, sachlich, kurz, Du-Form, Fachbegriffe ohne Erklärung.

## Arbeitsweise
- README.md bei jeder Funktionsänderung aktualisieren (Stand-Tabelle, Funktionen, Roadmap).
- Bei Unklarheiten Vorschlag machen und kurz begründen, nicht raten.
- Lokal prüfen: `npm test`, `npm run build`, `npm run serve` (localhost:5173). Mikrofon lässt sich im Browser durch einen Oszillator ersetzen (getUserMedia überschreiben), um die Oberfläche ohne Gitarre zu testen.
- Commits nur auf Wunsch; Push auf `main` veröffentlicht nach ca. 2 Minuten.

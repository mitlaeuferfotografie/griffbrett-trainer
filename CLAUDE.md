# CLAUDE.md – Griffbrett-Trainer

Private Gitarren-App für einen erwachsenen, ausgebildeten Musiker (E-Gitarre, spielt nach Gefühl). Ziel: Griffbrett-Töne verinnerlichen als Basis für Intervalle, Tonleitern, Modes, CAGED. Vollständiges Konzept: `Konzeptnotiz_Griffbrett-Trainer_fuer_Code.md` (lokal, nicht im Repo). Stand und Roadmap: `README.md`.

## Rahmen
- **Privat:** eigenes Repo `mitlaeuferfotografie/griffbrett-trainer`, GitHub Pages. **Nie** auf der Übersichtsseite mitlaeuferfotografie.github.io eintragen (den Skill `lern-app-uebersicht` hier nicht verwenden). Kein Teil des Musik-App-Ökosystems für die Schule.
- Die Schulregeln der Lern-Apps gelten **nicht** (keine Sterne, kein Spielstand-Code, kein Lehrer-Bereich, keine kindgerechten Texte, kein Dienst-Impressum). Gemeinsame Technik schon: React 18, Tailwind v3 beim Bauen erzeugt, `lucide-react`, esbuild, keine Drittanbieter zur Laufzeit (kein CDN, keine Webfonts, keine Analyse), Tailwind-Klassen immer vollständig ausschreiben.
- **Impressum & Datenschutz** in `LegalModal` (`src/views/Legal.jsx`), private Angaben in der Konstante `IMPRESSUM` (nicht das Dienst-Impressum der Schul-Apps). Rechtstext nur nach Vorgabe des Nutzers ändern.
- Hauptgerät **iPhone Safari**, als Homescreen-App; Menüs im Hochformat, **Übungen gern im Querformat** (Handy quer auf dem Notenständer). Desktop nur nebenbei.

## Code-Struktur
- Oberfläche: `src/App.jsx` (Menü, Navigation, Daten), Ansichten in `src/views/`, gemeinsame Bausteine in `src/ui/` (u. a. `Fretboard`, `MicAnswer`, `MicGate`). **Audio- und Lernlogik in eigenen Modulen** (`src/audio/*`, `src/lib/*`), ohne React und ohne Browser-Abhängigkeit, damit sie in Node getestet und für Ausbaustufe 2/3 wiederverwendet werden können.
- Daten: ein Objekt `{ settings, progress }` in App.jsx, gespeichert in localStorage. Lernstand-Updates immer unveränderlich (`applyAnswer` liefert eine neue Einheit). Neue Felder in `DEFAULT_SETTINGS` (storage.js; soll ein geänderter Grundwert auch alte Stände umstellen: `settingsRev` erhöhen und in `mergeSettings` migrieren) bzw. `DEFAULT_PROGRESS`/`normalizeProgress` (stats.js) ergänzen, damit alte Stände und Exporte weiter laden.
- Lerneinheit-Schlüssel `"<Leersaiten-MIDI>:<Bund>"` nie ändern (sonst geht Lernstand verloren).
- Tonhöhen intern immer als MIDI-Zahl (69 = a′), Namen nur bei der Anzeige über `notes.js` (Einstellung deutsch H/B oder international B/B♭; Vorzeichen ♯/♭/beide).
- **Griffbrett-Darstellung (Vorgabe des Nutzers, 28.10.2026): waagerecht wie die Gitarre auf dem Schoß** – Sattel links, Bünde nach rechts, **dicke/tiefste Saite UNTEN, hohe E-Saite oben**. Saiten als Linien (unten dicker), Bundstäbchen, Lagenpunkte, Töne als **Punkte** (keine Kästchen). Eine Komponente für alles: `Fretboard` in `src/ui/board.jsx` (`cell` liefert `null` = kein Punkt; `highlightString` für die gefragte Saite; > 12 Bünde → zwei Hälften untereinander). Auch „Tonlauf“ nutzt waagerechte Saiten (dicke unten). Nur die Saitenleiste im Stimmgerät (Buttons) hat die dicke Saite links.
- **Navigation:** Reiter (`TabBar` in common.jsx) Üben / Tonarten / Stimmgerät / Fortschritt / Mehr; neue Übungen als `ListRow` im Reiter „Üben“, Werkzeuge unter „Mehr“. Selten Genutztes in `Collapsible`, Auswahl mit vielen Optionen als `SelectField`.
- **Querformat:** Übungen nutzen `Split` (`src/ui/common.jsx`): im Querformat links Aufgabe, rechts Griffbrett/Eingabe; Hochformat untereinander. Manifest `orientation: any`. Neue Übungen ebenso aufbauen.
- Saitenindex 0 = tiefste Saite. Griffbrett-Logik rechnet mit den Leersaiten der **aktiven Stimmung**. Stimmungen sind Daten in `tunings.js`, nie in der UI hartkodieren.
- Abgefragt werden immer die **gegriffenen/klingenden** Töne der aktiven Stimmung. Grundeinstellung Standard E. Kein Eb-Standard (vom Nutzer nicht gewünscht).
- `pages.yml` weicht von den Schwester-Apps ab: `npm ci`, `npm test`, `npm run build` (scripts/build.mjs). Tests müssen grün sein, sonst wird nicht veröffentlicht.

## Tonerkennung (Fundament, mit Vorsicht ändern)
- YIN in `src/audio/pitch.js`, Puffer 4096, 50–1500 Hz, Oktavfehler-Korrektur über 2τ/3τ. `detector.js`: Pegelschwelle, Stabilitätsfenster, Oktavausreißer, Anschlagserkennung.
- `getUserMedia` mit `echoCancellation`, `noiseSuppression`, `autoGainControl` = false.
- iOS: `startMic()` nur direkt aus einem Klick-Handler aufrufen (AudioContext + resume synchron). Nach Bildschirmsperre/App-Wechsel → Status `interrupted` und Button „Fortsetzen“. Mikrofon beim Verlassen der Ansicht freigeben (`stopMic`).
- Jede Änderung an pitch.js/detector.js: `npm test` laufen lassen (Selbsttest 55–1320 Hz, 6 Wellenformen, 44,1/48 kHz, Audiostrom-Test). Bei neuen Problemen vom echten Gerät einen passenden synthetischen Test ergänzen.

## Lernlogik (Grenzwerte als Konstanten)
- `srs.js`: FAST_SEC 3, SLOW_SEC 8, „sitzt“ = Box 3 (schnell + richtig an ≥ 2 Tagen), Antippen max. Box 2, Fehler −2 Boxen (min. 1).
- `curriculum.js`: Freischaltung bei ≥ 80 % „wird“ und ≥ 50 % „sitzt“, bleibt freigeschaltet.
- `session.js`: Mischung 70/20/10, Arbeitsmenge 5 „unsichere“ Positionen, max. 12 neue pro Session, Fehler kommen nach 3 Aufgaben wieder.
- `intervals.js` (Ausbaustufe 2): Lerneinheit = Form `"<halbtöne>:<saiten>:<bünde>"` (nie ändern), nur |Bundabstand| ≤ 4, Saitenwechsel 0/+1/+2, Gruppen Oktave+Quinte → Quarte+Terzen → 2/♭7/6 → Rest. Eigener Lernstand `progress.intervals` (units + unlocked je Stimmung). Aufgaben über `pickTask(..., make)`. „Zielton benennen“: Schreibweise mit `spellInterval` (Stammton + Intervallnummer, ♭5 = verminderte Quinte), Antworten aus `nameChoices`; richtig nur, wenn Name und Ton stimmen. Modus `intervalNameMode` auto/tap/head/off, Auto über `chooseNameMode` (NAME_KNOWN 3, NAME_CHECK_SHARE 0,2) und `progress.intervals.names` je `<halbtöne>:<grundton-tonklasse>`.
- Abwärts-Intervalle meinen die **Stufe** in der tieferen Oktave („5 darunter“ = Quarte tiefer); Anzeige „Stufe 5 darunter · Quarte abwärts“.
- `scales.js`: Schreibweise über Stammton + Stufennummer (nie über Tonklassen raten); bei schwarzen Grundtönen weniger Vorzeichen gewinnt. „Stufen finden“ (Tonarten) zählt nicht im Lernstand.
- `patterns.js`: 3NPS/2NPS-Muster = aufeinanderfolgende Skalentöne, n pro Saite, Muster k startet mit Stufe k auf der tiefsten Saite (tiefste Lage, bei negativem Bund eine Oktave höher). „Muster spielen“ zählt nicht im Lernstand, Bestzeit in `bests.patterns`.
- `analysis.js` (Ausbaustufe 3): Gewichtung nach Tondauer, Rangfolge nach Abdeckung (Gleichstand → weniger ungenutzte Stufen), Klartext-Sätze grammatisch korrekt (Dativ-Tabelle). Improvisieren zählt nicht im Lernstand.
- Challenge und „Tonlauf“ (intern `arcade`) zählen nicht im Lernstand (Zeitdruck), nur als Übungszeit. „Ein Ton – alle Saiten“ zählt normal.
- `arcade.js`: Fallzeit 6 s → ca. 1,5 s über 10 Stufen, +1 Stufe je 8 Treffer, −1 nach 2 verpassten in Folge, Zonen 0,6/0,85/1,15, 5 Leben.
- Änderungen hier: Tests in `tests/learning.test.mjs`, `tests/arcade.test.mjs` bzw. `tests/intervals.test.mjs` anpassen/ergänzen.

## Gestaltung
- Hell-Modus über CSS-Variablen der Slate-Skala (`tailwind-input.css`, `tailwind.config.cjs`): nur `slate-*` für neutrale Flächen/Texte verwenden, damit beide Modi passen; auf farbigen Buttons `text-white`.
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

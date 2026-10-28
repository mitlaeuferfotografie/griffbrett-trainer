# Griffbrett-Trainer

Private Web-App (iPhone/Safari zuerst, Hochformat, als Homescreen-App nutzbar), um die Töne auf dem Gitarren-Griffbrett wirklich zu verinnerlichen: Die App fragt, du spielst auf der echten Gitarre, das Mikrofon prüft. Schwaches kommt öfter dran, eine Heatmap zeigt, was schon sitzt.

**Live:** https://mitlaeuferfotografie.github.io/griffbrett-trainer/
Privates Projekt, **nicht** auf der Übersichtsseite der Lern-Apps eingetragen.

## Stand

| Bereich | Status |
|---|---|
| Tonerkennung (YIN) + Tests mit synthetischen Signalen | fertig, am iPhone mit Gitarre getestet (Eingangsschwelle −75 dB) |
| Stimmgerät | fertig, weiterer Hardware-Test folgt |
| Diagnose (Live-Werte, erkannte Töne, Selbsttest auf dem Gerät) | fertig |
| **Version 1:** Ton finden, adaptive Wiederholung, Heatmap, Session, Gamification, Export/Import, Hell-Modus, Offline | fertig (28.10.2026), Praxistest am iPhone steht aus |
| Übung „Tonlauf“ (früher „Fallende Töne“; Timing, steigendes Tempo) | fertig (28.10.2026) |
| Impressum & Datenschutz | fertig |
| **Ausbaustufe 2:** Intervalle als Griff-Formen (auf- und abwärts, „Grundton zuerst“, „Zielton benennen“) | fertig (28.10.2026), Praxistest steht aus |
| Tonarten-Übersicht (Griffbrett bis Bund 24) + Übung „Stufen finden“ | fertig (28.10.2026) |
| Griffbrett waagerecht (dicke Saite unten, Punkte auf Saiten) + Querformat für Übungen | fertig (28.10.2026) |
| **Ausbaustufe 3:** Improvisieren – Live-Stufen, Lage-Schätzung, Auswertung Tonleiter/Modus | erste Version fertig (28.10.2026), Praxistest steht aus |

## Funktionen

### Darstellung
- **Navigation:** Reiter-Leiste unten – **Üben** (Start, Tagesziel, weitere Übungen), **Tonarten**, **Stimmgerät** (startet das Mikrofon direkt), **Fortschritt**, **Mehr** (Einstellungen, Diagnose, Impressum). Übungen laufen im Vollbild ohne Leiste; „Zurück“ führt zum Reiter, von dem aus sie gestartet wurden.
- **Einstellungen** in ausklappbaren Abschnitten (Instrument, Training, Tonnamen & Darstellung, Mikrofon, Motivation, Lernstand); zugeklappt zeigt jeder Abschnitt die aktuelle Wahl.
- **Tonarten:** Grundton und Tonart als kompakte Auswahlfelder (iPhone: Auswahl-Walze), Griffbrett direkt darunter, Anzeige-Optionen ausklappbar.
- **Griffbrett waagerecht wie die Gitarre auf dem Schoß:** Sattel links, Bünde nach rechts, **dicke Saite unten, hohe E-Saite oben**. Saiten als Linien (unten dicker), Bundstäbchen, Lagenpunkte (3, 5, 7, 9, 12 doppelt …), Töne als farbige Punkte. Bei mehr als 12 Bünden zwei Hälften untereinander (0/1–12, 13–24).
- **Querformat:** Die Übungen (Ton finden, Ein Ton, Challenge, Intervalle, Stufen finden) zeigen quer links die Aufgabe und rechts Griffbrett und Eingabe – ideal mit dem Handy quer auf dem Notenständer. Hochformat funktioniert weiterhin.

### Start: Session „Ton finden“ (Kernübung)
- Ein Tipp auf **Start**, Dauer 3 / 5 / 10 Minuten (Standard 5). Die App wählt jede Aufgabe selbst.
- Aufgabe groß, aus ca. 1 m lesbar: **„F auf der A-Saite“**. Du spielst, die App hört.
- **Geprüft wird Tonklasse und Lage:** Der Ton muss auf genau dieser Saite im Bundbereich (0–12 bzw. 0–24) liegen. F2 statt F3 auf der A-Saite zählt also nicht. Bund 0 und 12 zählen beide.
- Gemessen werden richtig/falsch und **Reaktionszeit** (Aufgabe sichtbar → stabil erkannter Ton).
- Rückmeldung: „Richtig · 1,8 s“ oder „Daneben“ mit Mini-Griffbrett (Ziel grün, gespielter Bund orange), danach kommt automatisch die nächste Aufgabe. Kein Game-Over.
- **Lösung zeigen**, wenn der Ton nicht einfällt (zählt wie ein Fehler).
- **Pause** hält die Zeit an. Die Zeit läuft auch nur, solange das Mikrofon aktiv ist.
- **Ohne Mikrofon** (Bahn, Mikro verweigert): Bund auf einem Griffbrett antippen. Zählt schwächer, siehe unten.
- Gegen Fehlauslösungen: 250 ms Sperrzeit nach jeder neuen Aufgabe; ein noch klingender vorheriger Ton zählt erst nach einem neuen Anschlag.
- Bildschirm bleibt während der Übung an (Wake Lock).
- **Zusammenfassung** am Ende: Antworten, Trefferquote, Ø Reaktionszeit, welche Positionen besser geworden sind (auf dem Griffbrett hervorgehoben), neu freigeschaltete Saiten, neue Bestwerte und Meilensteine, Tagesziel.

### Ein Ton – alle Saiten
Ein Ton (gewählt oder zufällig) nacheinander auf allen Saiten von tief nach hoch. Trainiert die Oktav-Verbindungen. Zählt normal im Lernstand.

### Challenge
Alle natürlichen Töne einer Saite (Bund 1–12) in zufälliger Reihenfolge auf Zeit, mit Bestzeit pro Saite. Falsche Töne kosten nur Zeit. Freiwillig, nur mit Mikrofon, **zählt nicht im Lernstand**, damit Zeitdruck die adaptive Wiederholung nicht verfälscht.

### Intervalle – Ausbaustufe 2 (`src/lib/intervals.js`, `src/views/Intervals.jsx`)
Ein Grundton wird auf dem Griffbrett gezeigt (mit Name und Saite), gefragt ist z. B. **„♭3 · kleine Terz · eine Saite höher“** oder abwärts **„↓ ♭7 · Stufe ♭7 darunter · große Sekunde abwärts“**. Gespielt wird der Zielton; richtig ist nur **genau** dieser Ton (eine Oktave daneben zählt nicht).
- **Richtung** auf der Startseite: aufwärts, abwärts oder beides (Standard). Abwärts ist die **Stufe** gemeint: „5 darunter“ = die 5 der tieferen Oktave, also eine Quarte tiefer; Saitenwechsel gleiche Saite, 1 oder 2 Saiten tiefer.
- **Zielton benennen** (Standard an): vor dem Spielen den Namen des Zieltons aus 4 Antworten antippen (richtige Schreibweise über die Intervallnummer, z. B. große Terz über Es = G; Ablenker: gleicher Stammton mit anderem Vorzeichen, Nachbar-Stammton, enharmonisch). Die Aufgabe zählt nur als richtig, wenn Name **und** gespielter Ton stimmen.
- **Grundton zuerst** (Standard an): erst den Grundton spielen, dann das Intervall – trainiert das Hören; die Reaktionszeit zählt ab dem Grundton. Ablauf mit beiden Optionen: Name tippen → Grundton → Zielton.
- **Lerneinheit = Griff-Form:** Intervall (mit Vorzeichen, abwärts negativ) × Saitenwechsel × Bundabstand, Schlüssel `"<halbtöne>:<saiten>:<bünde>"`, z. B. `7:1:2`, `-5:-1:0`. Dadurch ist der Sonderfall G→H-Saite eine eigene Form (z. B. Quinte eine Saite höher: normal +2 Bünde, über G→H +3).
- Nur Formen innerhalb einer Hand-Lage (Bundabstand ≤ 4), auf der gleichen Saite also bis zur großen Terz. In Standardstimmung je Richtung gut drei Dutzend Formen.
- **Progressive Einführung:** Oktave & Quinte → Quarte & Terzen → große Sekunde, kleine Septime, große Sexte → große Septime, kleine Sekunde, kleine Sexte, Tritonus. Freischaltung durch Können wie bei „Ton finden“.
- Gleiche Lernlogik (Leitner-Boxen mit Reaktionszeit, Mischung fällig/neu/Wiederholung, Arbeitsmenge), eigener Lernstand `progress.intervals`.
- Übersicht aller Formen (Zeilen = Intervalle, Kästchen = Saitenwechsel + Bundabstand, eingefärbt nach Status) auf der Startseite und in der Zusammenfassung.
- Antipp-Modus: Zielbund auf der Zielsaite antippen. Meilensteine je Intervall-Gruppe.

### Improvisieren – Ausbaustufe 3 (`src/lib/analysis.js`, `src/views/Improv.jsx`)
„Was spiele ich da eigentlich?“ – frei spielen, die App hört mit.
- **Grundton** wählen oder **automatisch** erkennen lassen (beste Passung Grundton × Tonleiter, bei Gleichstand der häufigste Ton).
- **Live:** aktuelle Stufe groß (Grundton gelb), Stufenverteilung als Balken, Griffbrett mit der **geschätzten Lage** der letzten 8 Töne und den übrigen möglichen Stellen blass. Das Griffbrett zeigt einen Ausschnitt von 12 Bünden, der der gespielten Lage folgt.
- **Lage-Schätzung** (`estimatePath`): Derselbe Ton liegt an mehreren Stellen, am Klang nicht unterscheidbar. Modell: Die Hand steht in einer Lage (Bund p…p+4, Leersaiten immer), Lagenwechsel kosten; über die letzten 16 Töne wird die Lagenfolge mit den geringsten Kosten gesucht. Zusätzlich gilt: **lieber die Saite wechseln als weit auf einer Saite springen** – Sprünge über eine Hand-Spanne (> 4 Bünde) auf derselben Saite kosten deutlich mehr als ein Saitenwechsel. Hohe Töne einer Phrase ziehen so die ganze Phrase nach oben. **Lage-Vorgabe** Auto / Tief / Mittel / Hoch (auch live umschaltbar) entscheidet bei mehrdeutigen Phrasen.
- **Auswertung in Klartext**, z. B. „Du hast überwiegend Moll-Pentatonik gespielt, mit der großen Sexte (6) als Farbton. Das klingt dorisch.“; Dur-/Moll-Charakter (Terz), Töne außerhalb (Blue Notes, chromatische Durchgänge), **nie gespielte Töne** der passenden Tonleiter; Balken und Griffbrett „gespielt / nie gespielt“.
- Töne werden nach **Dauer gewichtet** (0,15–1,5 s), damit Durchgänge weniger zählen als gehaltene Töne. Pentatonik gilt als „überwiegend“, wenn ≥ 75 % der Töne darin liegen.
- Aufgezeichnet werden nur erkannte Tonhöhen mit Zeitpunkt, kein Audio. Zählt nicht im Lernstand (nur Übungszeit). Einstimmig spielen; Begleitung nur über Kopfhörer.

### Tonarten (`src/lib/scales.js`, `src/views/Scales.jsx`)
- Grundton (12) und Tonart wählen: **Dur, Moll (natürlich), harmonisch und melodisch Moll, Dur- und Moll-Pentatonik, Blues, Dorisch, Phrygisch, Lydisch, Mixolydisch, Lokrisch**.
- **Ganzes Griffbrett bis Bund 24** (umschaltbar auf 12) inklusive Leersaiten links vom Sattel, dicke Saite unten: Töne der Tonart als Punkte, alles andere leer. **Standard „Einfarbig“:** alle Töne indigo, nur der **Grundton gelb** – so ist das Muster der Tonleiter auf einen Blick zu sehen. Alternativ **„Stufenfarben“** (Grundton ebenfalls gelb, Terz grün, Quinte hellblau, übrige grau). Beschriftung: Stufen, Tonnamen oder ohne (reines Muster).
- Tonart-Kopf: Name („G-Dur“, „e-Moll“, „D Dorisch“), Vorzeichen in Quintenzirkel-Reihenfolge („2 ♯: Fis, Cis“), Umschalter zur **Paralleltonart**, alle Töne mit Stufe. Antippen einer Stufe blendet sie auf dem Griffbrett aus (z. B. nur Grundtöne zeigen).
- **Korrekte Schreibweise:** G-Dur hat Fis, F-Dur hat B; bei schwarzen Grundtönen gewinnt die Variante mit weniger Vorzeichen (Des-Dur statt Cis-Dur, fis-Moll statt ges-Moll; Gleichstand nach Vorzeichen-Einstellung).
- **Tonart finden** (Umschalter oben „Tonart anzeigen · Tonart finden“, `src/views/KeyFinder.jsx`, `findKeys` in scales.js): Bünde antippen → Liste der Tonarten, die alle gewählten Töne enthalten. Rangfolge: häufige Tonarten vor seltenen Modi, Grundton unter den gewählten Tönen (als tiefster Ton/Basston noch höher), wenige Zusatztöne; bei weniger als 4 Tönen siebentönige Tonarten vor Pentatoniken. Passt keine vollständig: Treffer „bis auf X“. Tipp auf ein Ergebnis zeigt die Tonart in der Übersicht; die Auswahl bleibt beim Hin- und Herwechseln erhalten.
- **Griffmuster 3NPS / 2NPS** (Umschalter über dem Griffbrett): aufeinanderfolgende Töne der Tonleiter, 3 bzw. 2 pro Saite, von der tiefsten zur höchsten Saite. **Muster 1–7** (bzw. 1–5 bei Pentatoniken) beginnen jeweils auf einer anderen Stufe der tiefsten Saite (Anzeige „ab Stufe ♭3 · Bund 8–13“). Muster-Töne als Punkte, übrige Töne der Tonleiter blass. 3NPS passt zu Dur/Moll/Modi, 2NPS zu Pentatoniken (Box-Muster). Logik: `src/lib/patterns.js`.
- **Übung „Muster spielen“** (`src/views/PatternRun.jsx`): das gewählte Muster Ton für Ton auf- und abwärts spielen; das Mikrofon prüft die Reihenfolge, der nächste Ton ist gelb markiert, gespielte grün, falsche Töne halten nur auf. Zeit ab dem ersten richtigen Ton, Bestzeit je Muster. Zählt nicht im Lernstand.
- **Übung „Stufen finden“**: 10 Aufgaben wie „6 in G-Dur auf der D-Saite“, Mikrofon oder Antippen, Rückmeldung mit Stufe, Tonname und Bund. Zählt nicht im Lernstand.

### Tonlauf (`src/lib/arcade.js`, `src/views/Arcade.jsx`)
Töne laufen auf ihrer Saite – waagerecht, dicke Saite unten wie auf dem Griffbrett – von rechts auf eine Trefferlinie links zu und müssen im richtigen Moment gespielt werden (wie beim Tab-Lesen).
- **Timing:** Fortschritt p (0 = rechts, 1 = Linie). Unter 0,6 „zu früh“ (zählt nicht, Ton fällt weiter), 0,6–0,85 „gut“, 0,85–1,15 „perfekt“, danach verpasst.
- **Tempo:** 10 Stufen, Fallzeit 6 s (Stufe 1) bis ca. 1,5 s (Stufe 10). Alle 8 Treffer eine Stufe schneller, nach 2 verpassten Tönen in Folge eine Stufe langsamer.
- **Start-Tempo:** automatisch aus dem Anteil sitzender Positionen und der bisher erreichten Höchststufe (2 darunter), oder Ruhig (1) / Mittel (4) / Schnell (7).
- **Töne:** freigeschaltete Positionen (bevorzugt bereits eingeführte) oder alle natürlichen Töne auf allen Saiten.
- **Punkte:** 100 (gut) bzw. 150 (perfekt) × Stufe × Serien-Multiplikator (+1 je 10 Treffer in Folge). 5 Leben: Nur durchgerutschte Töne kosten ein Leben, ein falscher Ton beendet nur die Serie.
- Bestwert und höchste Stufe je Tonvorrat. Zählt **nicht** im Lernstand (Zeitdruck), die Spielzeit zählt als Übungszeit.

### Lernstand (adaptive Wiederholung, `src/lib/srs.js`)
- **Lerneinheit = Leersaitenton × Bund** (Schlüssel z. B. `45:8` = F auf der A-Saite). 6- und 7-Saiter teilen sich so den Lernstand gemeinsamer Saiten; Drop-Saiten haben eigene Einheiten.
- **Leitner-Boxen 0–5 mit Reaktionszeit:**
  - richtig und ≤ 3 s → eine Box höher; ab Box 2 höchstens einmal pro Tag. **„sitzt“ (Box 3) = schnell und richtig an mindestens zwei verschiedenen Tagen.**
  - richtig, aber langsamer → Box bleibt; über 8 s → eine Box zurück.
  - falsch / Lösung angezeigt → zwei Boxen zurück, nie unter 1 (Fortschritt fällt nie ganz weg).
  - Antippen statt Spielen → höchstens bis „wird“ (Box 2), nie „sitzt“; stuft nicht herab.
  - fällig nach 0 / 0 / 1 / 3 / 7 / 14 Tagen (Box 0–5).
- Status in der Heatmap: **nicht eingeführt / unsicher** (Box 0–1) **/ wird** (Box 2) **/ sitzt** (Box ≥ 3).
- Leersaiten werden nicht abgefragt.

### Progressive Einführung (`src/lib/curriculum.js`)
1. Natürliche Töne auf tiefer und hoher E-Saite → 2. A-Saite → 3. D- und G-Saite → 4. H-Saite → 5. (7-Saiter) tiefe H-Saite → 6. Vorzeichen auf allen Saiten.
- Die nächste Stufe wird **durch Können** freigeschaltet: wenn von allen freien Positionen ≥ 80 % mindestens „wird“ und ≥ 50 % „sitzt“. Freigeschaltet bleibt freigeschaltet.
- Manuelle Auswahl der Bereiche in den Einstellungen möglich (nicht Standard).

### Session-Zusammenstellung (`src/lib/session.js`)
- Ca. **70 % fällige/schwache**, **20 % neue**, **10 % Wiederholung** von Sitzendem; zufällig, keine Position zweimal direkt hintereinander.
- Neue Positionen kommen dazu, solange weniger als 5 Positionen „unsicher“ sind (max. 12 pro Session). Wer schnell lernt, bekommt schneller Neues; bei vielen Fehlern wird erst gefestigt.
- Falsch Beantwortetes kommt nach 3 anderen Aufgaben noch einmal.

### Fortschritt
- **Heatmap** des Griffbretts (waagerecht, dicke Saite unten): Status als farbige Punkte, nicht eingeführte Positionen als kleine graue Punkte. Antippen einer Position zeigt Details (Trefferquote, Ø Zeit, fällig wann). Tonnamen ein-/ausblendbar.
- „X von Y Positionen sitzen“, Verteilung, Fortschritt bis zur nächsten Freischaltung.
- **Übungskalender** der letzten 28 Tage („an 12 der letzten 28 Tage geübt“) und Wochenziel 4 von 7 Tagen. **Kein Streak**, der bei einem verpassten Tag auf null fällt.
- **Bestwerte:** längste Serie richtiger Antworten, meiste Positionen „sitzt“, Ø Reaktionszeit pro Saite, Challenge-Bestzeiten.
- **Meilensteine** mit Gitarrenbezug: z. B. „Tiefe E-Saite & hohe E-Saite: alle natürlichen Töne“, „A-Saite komplett“, „7. Saite gemeistert“, „Alle natürlichen Töne bis Bund 12“, „Ganzes Griffbrett bis Bund 12/24“, 10/30/100 Übungstage, 500/2000/10000 richtige Antworten.
- Tagesziel-Ring (Minuten heute) im Menü. Alles über die Einstellungen abschaltbar.

### Stimmgerät
- Großer Tonname mit Oktave, Abweichung in Cent, Zeiger −50 … +50 Cent; **grün nur bei ±3 Cent** („gestimmt“).
- Saitenleiste der aktiven Stimmung (dicke Saite links). Antippen legt eine **Zielsaite** fest.
- Stimmungen: Standard E (6), Drop D, 7-Saiter Standard (H-E-A-D-G-H-E), 7-Saiter Drop A. Weitere Stimmungen = neuer Eintrag in `src/lib/tunings.js`.

### Diagnose
- Stabil erkannter Ton mit allen Positionen auf dem Griffbrett, Rohfrequenz, Klarheit, Pegel mit Schwelle, Messungen/s, Rechenzeit, Abtastrate, Liste erkannter Töne.
- **Selbsttest** mit denselben synthetischen Signalen wie die Node-Tests, direkt auf dem iPhone.

### Einstellungen
Saiten (6/7), Stimmung, Bundbereich (bis 12 / bis 24), Session-Dauer (= Tagesziel), Lernreihenfolge (automatisch/manuell), Tonnamen (deutsch H/B oder international B/B♭), Vorzeichen (♯, ♭, beide), Referenzton a′ 435–445 Hz, Eingangsschwelle, Dunkel/Hell, Motivation (Tagesziel/Kalender, Bestwerte/Meilensteine ein/aus).

**Lernstand:** Exportieren (iPhone: Teilen-Menü → „In Dateien sichern“), Importieren (mit Bestätigung in der App), Zurücksetzen (mit Bestätigung in der App). Hat man mindestens zwei Sessions und seit 14 Tagen nicht exportiert, erinnert das Menü dezent an eine Sicherung („Später“ verschiebt um 14 Tage).

### Hinweise zur Erkennung
- Unverstärkte E-Gitarre ist fürs Handy-Mikrofon sehr leise → leise über Amp/Kopfhörer-Amp oder Westerngitarre.
- Die **Eingangsschwelle** (−90 … −30 dB, Standard **−75 dB**, am iPhone mit Gitarre als bester Wert ermittelt) bestimmt, ab welchem Pegel gemessen wird. Rauschen über der Schwelle wird zusätzlich über die Klarheit der Tonhöhe ausgefiltert.

## Technik

- React 18, Tailwind CSS v3 (beim Bauen erzeugt, `tailwind.config.cjs`), Icons aus `lucide-react`, Build mit esbuild. Keine Drittanbieter zur Laufzeit, Systemschrift.
- **Hosting:** GitHub Pages über `.github/workflows/pages.yml`: `npm ci` → `npm test` → `npm run build` → Veröffentlichung von `_site/`. Schlagen die Tests fehl, wird nichts veröffentlicht.
- **Speicherung:** localStorage (`griffbrett-trainer:v1`: `settings` + `progress`), nur auf dem Gerät, ohne Konto (Entscheidung 28.10.2026: nur iPhone, kein Sync nötig).
  - Beim Start fordert die App **dauerhaften Speicher** an (`navigator.storage.persist()`), damit iOS die Daten nicht automatisch löscht.
  - **Home-Bildschirm-App empfohlen:** Dort gilt Safaris 7-Tage-Löschregel nicht. Läuft die App im Safari-Tab, zeigt das Menü einen Hinweis „Teilen → Zum Home-Bildschirm“. Achtung: Die Home-Bildschirm-App hat einen **eigenen Speicher** – vorhandenen Lernstand vorher exportieren und dort importieren.
  - Status in Einstellungen → Lernstand („Speicher dauerhaft · Home-Bildschirm-App“ grün bzw. Hinweis orange). Export bleibt als zusätzliche Sicherung (Erinnerung alle 14 Tage). Exportformat: JSON mit `app: "griffbrett-trainer"`, `format: 1`.
- **Offline / Homescreen:** `manifest.json`, Icons, Service Worker (`public/sw.js`, „Netz zuerst“: online immer die aktuelle Version, offline die zuletzt geladene; Cache-Name enthält die Build-Version). Wird nur über https registriert.
- **Hell-Modus:** Die Slate-Farben sind CSS-Variablen; `[data-theme="light"]` dreht die Skala um. Die Klassen bleiben gleich.

### Struktur

```
src/
  App.jsx              Menü, Navigation, Datenhaltung (settings + progress), Theme
  index.js             Einstieg, Service-Worker-Registrierung
  tailwind-input.css   Tailwind, Farbvariablen (dunkel/hell), Safe Area
  views/               Training (Session + Zusammenfassung), OneNote, Challenge, Arcade, Intervals, Scales, PatternRun, Improv, Progress,
                       Tuner, Diagnose, Settings, Legal (Impressum & Datenschutz)
  ui/
    common.jsx         Card, Header, Segmented, LevelMeter, MicGate (Mikrofon-Zugang)
    board.jsx          Griffbrett (Heatmap/Antippen/Rückmeldung), Ring, Fortschrittsbalken,
                       MicAnswer (Ton als Antwort erkennen), TapAnswer
    hooks.js           Mikrofon-Status/-Frames, Wake Lock, Notenverfolgung
    backup.js          Export (Teilen/Download), Datei lesen
  audio/
    pitch.js           YIN-Tonhöhenerkennung (rein rechnerisch, in Node testbar)
    fft.js             Radix-2-FFT für die Korrelation in YIN
    detector.js        Notenverfolgung: Pegelschwelle, Stabilitätsfenster, Oktavausreißer, Anschlag
    mic.js             Mikrofon, AudioContext, Messschleife, iOS-Unterbrechungen
    synth.js           synthetische Testsignale
    selftest.js        Selbsttest (Node-Tests und Diagnose)
  lib/                 (ohne React, in Node getestet; Basis für Ausbaustufe 2 und 3)
    notes.js           Tonnamen, Frequenz ↔ MIDI ↔ Cent
    tunings.js         Stimmungs-Presets (Daten)
    fretboard.js       Saite × Bund ↔ Ton, Saitennamen (auch Dativ: „auf der tiefen E-Saite“)
    srs.js             Lerneinheiten, Leitner-Boxen mit Reaktionszeit, Fälligkeit
    curriculum.js      Gruppen, Freischaltung, aktive Positionen
    session.js         Aufgabenwahl, Prüflogik (Tonklasse + Lage)
    stats.js           Übungstage, Wochenziel, Bestwerte, Meilensteine, Zusammenfassung
    arcade.js          „Tonlauf“: Tempo, Timing-Zonen, Punkte, Stufen, Tonvorrat
    intervals.js       Ausbaustufe 2: Intervall-Formen (auf/ab), Einführung, Aufgaben, Prüfung
    scales.js          Tonarten/Skalen: Stufen, Schreibweise, Vorzeichen, Paralleltonart
    patterns.js        3NPS/2NPS-Griffmuster
    analysis.js        Ausbaustufe 3: Stufenverteilung, Skalen-Rangfolge, Klartext, Lage-Schätzung
    storage.js         localStorage, Export/Import
public/                index.html, manifest.json, sw.js, icons/
scripts/               build.mjs, serve.mjs (lokaler Server), make-icons.mjs
tests/                 Node-Tests (node --test)
```

### Tonerkennung
- **Verzerrung & schnelles Spiel (28.10.2026):** Improvisieren nutzt einen schnellen Modus (Messfenster 2048 statt 4096 Samples, Profil `TRACKER_FAST`): verzerrte Läufe mit 80 ms pro Ton werden vollständig erkannt (normal: 2 von 23). Oktavkorrektur prüft zusätzlich echte Energie auf der Unteroktave (Goertzel) – verhindert Oktavfehler bei hohen verzerrten Tönen.
- **Schneller Modus, nachgeschärft (Rückmeldung vom echten Gerät):** Doppelmeldungen beim Anschlag verhindert (gleicher Ton nicht erneut innerhalb 150 ms, neuer Anschlag frühestens nach 200 ms), **mitlernender Raumpegel** (Ton muss 12 dB darüber liegen – Brummen, Lüfter, Stimmen fallen raus), Klarheit ≥ 0,8, 3 Messungen. Im Improvisieren wählbar: **Erkennung Schnell / Genau**. Testsignale mit realistischem Anschlag (`pluckTone`) und Raumklang (`roomNoise`).
- **Mitschwingende Saiten (Rückmeldung Western- und E-Gitarre):** Übungen mit richtig/falsch nutzen das Profil `TRACKER_ANSWER`: Ton muss 12 dB über dem Raumpegel liegen und darf höchstens 20 dB leiser sein als das zuletzt Gespielte – mitschwingende Leersaiten (meist 20–30 dB leiser) lösen keine Antwort mehr aus. Tonlauf zählt denselben Ton erst nach neuem Anschlag; Leersaite und Bund 12 zählen beide (wie bei „Ton finden“).
- **Slides & Nebengeräusche:** In Übungen zählt der richtige Ton sofort, ein falscher erst nach 0,3 s stabilem Klang (`src/audio/answer.js`); gleitet die Tonhöhe weiter (Slide), wird nichts gewertet.
- **YIN** mit FFT-beschleunigter Differenzfunktion, Puffer 4096 Samples (≈ 85 ms bei 48 kHz), Suchbereich 50–1500 Hz (Drop A 55 Hz bis hohe E-Saite Bund 24 ≈ 1319 Hz), Parabel-Interpolation.
- **Oktavfehler-Korrektur:** Ist die Mulde bei 2τ oder 3τ deutlich tiefer als bei τ, war τ ein Oberton → längere Periode. Ohne diese Korrektur scheitert der Test „Grundton fast weg“ in 47 von 56 Fällen um genau eine Oktave, mit ihr in keinem.
- **Notenverfolgung:** Ein Ton gilt als erkannt, wenn 4 Messungen in Folge (≈ 70 ms) innerhalb ±40 Cent liegen; einzelne Oktavsprünge werden übersprungen; ein Pegelsprung (Anschlag) meldet denselben Ton erneut.
- **Mikrofon:** `echoCancellation`, `noiseSuppression`, `autoGainControl` aus. Audio wird nur im Speicher ausgewertet, nie aufgezeichnet oder übertragen.

### Lokal arbeiten

```bash
npm install
npm test          # Tonerkennung, Notenverfolgung, Griffbrett-, Lern- und Session-Logik
npm run build     # → _site/
npm run serve     # http://localhost:5173 (Mikrofon geht auf localhost auch ohne https)
npm run icons     # Icons neu erzeugen
```

## Roadmap

### Ideen nach dem Praxistest von Version 1
- Grenzwerte (3 s „schnell“, Freischaltung 80 %/50 %, Arbeitsmenge 5) anhand echter Nutzung nachjustieren – alle als Konstanten in `srs.js`, `curriculum.js`, `session.js`.
- Ggf. Reaktionszeit-Schwelle pro Saite/Lage anpassen (hohe Lagen brauchen länger).

### Ausbaustufe 2: weitere Schritte
- Tonarten-Ansicht um **Lagen/CAGED-Fenster** erweitern (nur Bund x–y hervorheben).
- Übung „Tonleiter in einer Lage spielen“ (Tonfolge auf- und abwärts mit Mikrofon prüfen).
- Dreiklänge/Arpeggien in den fünf CAGED-Formen, Tonleiter-Formen (Dur, Moll, Pentatonik, Modes) als Stufenfolgen – aufbauend auf den Intervall-Formen.

_Ursprüngliche Idee:_ Grundton setzen, Aufgaben wie „kleine Terz“, „Quinte auf der nächsthöheren Saite“, „♭7 darunter“. Lerneinheit = Intervall × Saitenwechsel. Später Dreiklänge/Arpeggien in CAGED-Formen, Tonleitern und Modes als Stufenfolgen. Bausteine: `session.js` (Aufgabe/Prüfung), `srs.js` (Lernstand), `board.jsx` (Griffbrett).

### Ausbaustufe 3: weitere Schritte
- Aus der Auswertung direkt eine Übung erzeugen („diese Töne nutzt du nie“ → Stufen finden / Intervalle mit genau diesen Stufen).
- Drone/Grundton als Klang (über Kopfhörer), Verlauf mehrerer Improvisationen vergleichen.

_Ursprüngliche Idee:_ Grundton wählen, frei improvisieren; die App zeigt live die gespielten Töne **als Stufen** auf dem Griffbrett (Lage aus den letzten Tönen schätzen). Auswertung: Stufenhäufigkeit, Abgleich mit Tonleitern/Modes in Klartext, daraus Übungen für Stufe 2. Bausteine: `detector.js` (Onset + Ton), `fretboard.js` (Positionen eines Tons).

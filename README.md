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
| **Ausbaustufe 2:** Intervalle als Griff-Formen (auf- und abwärts, „Grundton zuerst“) | fertig (28.10.2026), Praxistest steht aus |
| Tonarten-Übersicht (Griffbrett bis Bund 24) + Übung „Stufen finden“ | fertig (28.10.2026) |
| Griffbrett waagerecht (dicke Saite unten, Punkte auf Saiten) + Querformat für Übungen | fertig (28.10.2026) |
| Ausbaustufe 3 | Roadmap |

## Funktionen

### Darstellung
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
- **Grundton zuerst** (Option): erst den Grundton spielen, dann das Intervall – trainiert das Hören; die Reaktionszeit zählt ab dem Grundton.
- **Lerneinheit = Griff-Form:** Intervall (mit Vorzeichen, abwärts negativ) × Saitenwechsel × Bundabstand, Schlüssel `"<halbtöne>:<saiten>:<bünde>"`, z. B. `7:1:2`, `-5:-1:0`. Dadurch ist der Sonderfall G→H-Saite eine eigene Form (z. B. Quinte eine Saite höher: normal +2 Bünde, über G→H +3).
- Nur Formen innerhalb einer Hand-Lage (Bundabstand ≤ 4), auf der gleichen Saite also bis zur großen Terz. In Standardstimmung je Richtung gut drei Dutzend Formen.
- **Progressive Einführung:** Oktave & Quinte → Quarte & Terzen → große Sekunde, kleine Septime, große Sexte → große Septime, kleine Sekunde, kleine Sexte, Tritonus. Freischaltung durch Können wie bei „Ton finden“.
- Gleiche Lernlogik (Leitner-Boxen mit Reaktionszeit, Mischung fällig/neu/Wiederholung, Arbeitsmenge), eigener Lernstand `progress.intervals`.
- Übersicht aller Formen (Zeilen = Intervalle, Kästchen = Saitenwechsel + Bundabstand, eingefärbt nach Status) auf der Startseite und in der Zusammenfassung.
- Antipp-Modus: Zielbund auf der Zielsaite antippen. Meilensteine je Intervall-Gruppe.

### Tonarten (`src/lib/scales.js`, `src/views/Scales.jsx`)
- Grundton (12) und Tonart wählen: **Dur, Moll (natürlich), harmonisch und melodisch Moll, Dur- und Moll-Pentatonik, Blues, Dorisch, Phrygisch, Lydisch, Mixolydisch, Lokrisch**.
- **Ganzes Griffbrett bis Bund 24** (umschaltbar auf 12) inklusive Leersaiten links vom Sattel, dicke Saite unten: Töne der Tonart farbig mit **Stufe** (oder Tonname), alles andere ausgegraut. Farben mit Bedeutung: Grundton indigo, Terz grün, Quinte gelb, übrige Stufen grau.
- Tonart-Kopf: Name („G-Dur“, „e-Moll“, „D Dorisch“), Vorzeichen in Quintenzirkel-Reihenfolge („2 ♯: Fis, Cis“), Umschalter zur **Paralleltonart**, alle Töne mit Stufe. Antippen einer Stufe blendet sie auf dem Griffbrett aus (z. B. nur Grundtöne zeigen).
- **Korrekte Schreibweise:** G-Dur hat Fis, F-Dur hat B; bei schwarzen Grundtönen gewinnt die Variante mit weniger Vorzeichen (Des-Dur statt Cis-Dur, fis-Moll statt ges-Moll; Gleichstand nach Vorzeichen-Einstellung).
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
- **Speicherung:** localStorage (`griffbrett-trainer:v1`: `settings` + `progress`), nur auf dem Gerät. Exportformat: JSON mit `app: "griffbrett-trainer"`, `format: 1`.
- **Offline / Homescreen:** `manifest.json`, Icons, Service Worker (`public/sw.js`, „Netz zuerst“: online immer die aktuelle Version, offline die zuletzt geladene; Cache-Name enthält die Build-Version). Wird nur über https registriert.
- **Hell-Modus:** Die Slate-Farben sind CSS-Variablen; `[data-theme="light"]` dreht die Skala um. Die Klassen bleiben gleich.

### Struktur

```
src/
  App.jsx              Menü, Navigation, Datenhaltung (settings + progress), Theme
  index.js             Einstieg, Service-Worker-Registrierung
  tailwind-input.css   Tailwind, Farbvariablen (dunkel/hell), Safe Area
  views/               Training (Session + Zusammenfassung), OneNote, Challenge, Arcade, Intervals, Scales, Progress,
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
    storage.js         localStorage, Export/Import
public/                index.html, manifest.json, sw.js, icons/
scripts/               build.mjs, serve.mjs (lokaler Server), make-icons.mjs
tests/                 Node-Tests (node --test)
```

### Tonerkennung
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

### Ausbaustufe 3: „Was spiele ich da eigentlich?“
Grundton wählen, frei improvisieren; die App zeigt live die gespielten Töne **als Stufen** auf dem Griffbrett (Lage aus den letzten Tönen schätzen). Auswertung: Stufenhäufigkeit, Abgleich mit Tonleitern/Modes in Klartext, daraus Übungen für Stufe 2. Bausteine: `detector.js` (Onset + Ton), `fretboard.js` (Positionen eines Tons).

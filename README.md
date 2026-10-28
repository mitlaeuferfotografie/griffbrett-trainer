# Griffbrett-Trainer

Private Web-App (iPhone/Safari zuerst, Hochformat, als Homescreen-App nutzbar), um die Töne auf dem Gitarren-Griffbrett wirklich zu verinnerlichen: Die App fragt, du spielst auf der echten Gitarre, das Mikrofon prüft. Schwaches kommt öfter dran, eine Heatmap zeigt, was schon sitzt.

**Live:** https://mitlaeuferfotografie.github.io/griffbrett-trainer/
Privates Projekt, **nicht** auf der Übersichtsseite der Lern-Apps eingetragen.

## Stand

| Bereich | Status |
|---|---|
| Tonerkennung (YIN) + Tests mit synthetischen Signalen | fertig, Hardware-Test am iPhone läuft |
| Stimmgerät (chromatisch, Saitenanzeige, Zielsaite, a′ 435–445 Hz) | fertig, Hardware-Test am iPhone läuft |
| Diagnose (Live-Werte, erkannte Töne, Selbsttest auf dem Gerät) | fertig |
| Einstellungen (6/7 Saiten, Stimmung, Tonnamen, Vorzeichen, Referenzton, Eingangsschwelle) | fertig |
| Impressum & Datenschutz (`LegalModal`, Fußzeile im Menü und in den Einstellungen) | fertig |
| PWA: Manifest + Icons | fertig; Service Worker (offline) folgt mit Version 1 |
| Trainer „Ton finden“, adaptive Wiederholung, Heatmap, Session, Gamification, Export/Import | Version 1, nach dem Hardware-Test |

## Funktionen

### Stimmgerät
- Großer Tonname mit Oktave, Abweichung in Cent, Zeiger −50 … +50 Cent; **grün nur bei ±3 Cent** („gestimmt“).
- Saitenleiste der aktiven Stimmung: Die passende Saite leuchtet auf. Antippen legt eine **Zielsaite** fest (hilfreich, wenn eine Saite mehr als einen Halbton daneben liegt).
- Stimmungen: Standard E (6), Drop D, 7-Saiter Standard (H-E-A-D-G-H-E), 7-Saiter Drop A. Weitere Stimmungen = neuer Eintrag in `src/lib/tunings.js`.
- Die gewählte Stimmung gilt auch für den Trainer.

### Diagnose (für den Hardware-Test)
- Stabil erkannter Ton mit allen Positionen auf dem Griffbrett der aktiven Stimmung, Rohfrequenz, Klarheit, Pegel mit Schwelle, Messungen/s, Rechenzeit, Abtastrate.
- Liste der zuletzt erkannten Töne (jeder Anschlag ein Eintrag).
- **Selbsttest**: dieselben synthetischen Signale wie die Node-Tests, direkt auf dem iPhone gerechnet.

### Hinweise zur Erkennung
- Unverstärkte E-Gitarre ist fürs Handy-Mikrofon sehr leise → leise über Amp/Kopfhörer-Amp oder Westerngitarre.
- Die **Eingangsschwelle** (Einstellungen, −90 … −30 dB, Standard **−75 dB** – am iPhone mit Gitarre als bester Wert ermittelt) bestimmt, ab welchem Pegel gemessen wird. Rauschen über der Schwelle wird zusätzlich über die Klarheit der Tonhöhe ausgefiltert. Die Diagnose zeigt den Pegel live mit Schwellen-Markierung.

## Technik

- React 18, Tailwind CSS v3 (beim Bauen erzeugt), Icons aus `lucide-react`, Build mit esbuild. Keine Drittanbieter zur Laufzeit, Systemschrift.
- **Hosting:** GitHub Pages über `.github/workflows/pages.yml`: `npm ci` → `npm test` → `npm run build` → Veröffentlichung von `_site/`. Schlagen die Tests fehl, wird nichts veröffentlicht.
- **Speicherung:** localStorage (`griffbrett-trainer:v1`), nur auf dem Gerät.

### Struktur

```
src/
  App.jsx              Oberfläche (Menü, Stimmgerät, Diagnose, Einstellungen, Datenschutz)
  index.js             Einstieg
  tailwind-input.css   Tailwind + eigene Ergänzungen (Safe Area)
  audio/
    pitch.js           YIN-Tonhöhenerkennung (rein rechnerisch, in Node testbar)
    fft.js             Radix-2-FFT für die Korrelation in YIN
    detector.js        Notenverfolgung: Pegelschwelle, Stabilitätsfenster, Oktavausreißer, Anschlag
    mic.js             Mikrofon, AudioContext, Messschleife, iOS-Unterbrechungen
    synth.js           synthetische Testsignale
    selftest.js        Selbsttest (Node-Tests und Diagnose)
  lib/
    notes.js           Tonnamen (H/B oder B/B♭, ♯/♭/beide), Frequenz ↔ MIDI ↔ Cent
    tunings.js         Stimmungs-Presets (Daten)
    fretboard.js       Saite × Bund ↔ Ton, Saitennamen
    storage.js         Einstellungen/Lernstand im localStorage
public/                index.html, manifest.json, icons/
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
npm test          # Tonerkennung, Notenverfolgung, Griffbrett-Logik
npm run build     # → _site/
npm run serve     # http://localhost:5173 (Mikrofon geht auf localhost auch ohne https)
npm run icons     # Icons neu erzeugen
```

## Roadmap

### Version 1 (als Nächstes)
- **Ton finden:** „F auf der A-Saite“; geprüft werden Tonklasse **und** Lage (Bund 0–12 bzw. 0–24 auf genau dieser Saite). Reaktionszeit wird gemessen. Feedback auf einem Mini-Griffbrett. Untermodus „Ein Ton – alle Saiten“. Fallback ohne Mikrofon: Bund antippen (zählt schwächer).
- **Adaptive Wiederholung:** Lerneinheit = Saite × Bund; Leitner-Boxen mit Reaktionszeit („sitzt“ = schnell und richtig an mehreren Tagen); progressive Einführung (E-Saiten → A → D/G → H → tiefe H → Vorzeichen).
- **Heatmap** des Griffbretts (senkrecht im Hochformat), „X von Y Positionen sitzen“, Übungskalender statt Streak.
- **Session** 3/5/10 Minuten mit einem Tipp, Mischung fällig/neu/Wiederholung, Zusammenfassung mit sichtbarem Zuwachs, Wake Lock.
- **Gamification, erwachsen:** Tagesziel-Ring, Bestwerte, Meilensteine, Freischaltung durch Können, optionaler Challenge-Modus. Nichts bestraft.
- **Export/Import** des Lernstands (JSON), Zurücksetzen, Backup-Erinnerung. Hell-Modus optional. Service Worker für Offline-Nutzung.

### Ausbaustufe 2: Stufen & Intervalle
Grundton setzen, Aufgaben wie „kleine Terz“, „Quinte auf der nächsthöheren Saite“, „♭7 darunter“. Lerneinheit = Intervall × Saitenwechsel. Später Dreiklänge/Arpeggien in CAGED-Formen, Tonleitern und Modes als Stufenfolgen.

### Ausbaustufe 3: „Was spiele ich da eigentlich?“
Grundton wählen, frei improvisieren; die App zeigt live die gespielten Töne **als Stufen** auf dem Griffbrett (Lage aus den letzten Tönen schätzen). Auswertung: Stufenhäufigkeit, Abgleich mit Tonleitern/Modes in Klartext, daraus Übungen für Stufe 2.

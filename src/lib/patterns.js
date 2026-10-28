// Griffmuster „n Töne pro Saite“ (3NPS, 2NPS): aufeinanderfolgende Töne der Tonleiter,
// jeweils n auf einer Saite, von der tiefsten zur höchsten Saite.
// Muster k beginnt auf der tiefsten Saite mit Stufe k der Tonleiter (tiefste Lage ab Bund 0).
// 3NPS ist für 7-tönige Skalen gedacht (Dur, Moll, Modi), 2NPS für Pentatoniken – beides
// funktioniert aber mit jeder Skala.
import { degreeOf } from './scales.js';

/** Nächster Ton der Tonleiter oberhalb von midi. */
function nextScaleTone(rootPc, scale, midi) {
  let m = midi + 1;
  while (degreeOf(rootPc, scale, m) == null) m++;
  return m;
}

/**
 * Muster: { notes: [{ string, fret, midi, semis }], startFret }
 * position: 0 … steps.length−1 (Startstufe auf der tiefsten Saite)
 */
export function npsPattern(strings, rootPc, scale, nps, position) {
  const startPc = (rootPc + scale.steps[position % scale.steps.length]) % 12;
  let startMidi = strings[0];
  while (((startMidi % 12) + 12) % 12 !== startPc) startMidi++;
  for (let octave = 0; octave < 3; octave++) {
    const notes = [];
    let m = startMidi + octave * 12;
    strings.forEach((open, s) => {
      for (let i = 0; i < nps; i++) {
        if (s > 0 || i > 0) m = nextScaleTone(rootPc, scale, m);
        notes.push({ string: s, fret: m - open, midi: m, semis: degreeOf(rootPc, scale, m) });
      }
    });
    // Ein Ton unterhalb der Leersaite (Sonderfall H-Saite) → eine Oktave höher beginnen
    if (notes.every((n) => n.fret >= 0)) return { notes, startFret: notes[0].fret };
  }
  return { notes: [], startFret: 0 };
}

/** Übungsfolge: aufwärts, dann abwärts (oberster Ton nicht doppelt). */
export function patternSequence(pattern) {
  const up = pattern.notes;
  return [...up, ...up.slice(0, -1).reverse()];
}

/** Spannweite in Bünden pro Saite (für die Anzeige „Bund 3–8“). */
export function patternRange(pattern) {
  const frets = pattern.notes.map((n) => n.fret);
  return { from: Math.min(...frets), to: Math.max(...frets) };
}

export function patternKey(tuningId, rootPc, scaleId, nps, position) {
  return `${tuningId}:${rootPc}:${scaleId}:${nps}:${position}`;
}

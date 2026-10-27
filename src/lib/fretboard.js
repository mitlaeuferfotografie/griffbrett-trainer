// Griffbrett-Logik. Saitenindex 0 = tiefste Saite. Rechnet immer mit den
// Leersaiten der aktiven Stimmung (siehe tunings.js).
import { pcName, pitchClass } from './notes.js';

export function noteAt(strings, stringIdx, fret) {
  return strings[stringIdx] + fret;
}

/** Bund, auf dem `midi` auf dieser Saite liegt, oder null (außerhalb 0…fretMax). */
export function fretOnString(strings, stringIdx, midi, fretMax = 12) {
  const fret = Math.round(midi) - strings[stringIdx];
  return fret >= 0 && fret <= fretMax ? fret : null;
}

/** Alle Positionen eines exakten Tons (mit Oktave) im Bereich 0…fretMax. */
export function positionsForMidi(strings, midi, fretMax = 12) {
  const out = [];
  strings.forEach((_, s) => {
    const fret = fretOnString(strings, s, midi, fretMax);
    if (fret !== null) out.push({ string: s, fret });
  });
  return out;
}

/** Alle Bünde einer Tonklasse auf einer Saite (z. B. E auf A-Saite → [7, 19]). */
export function fretsForPitchClass(strings, stringIdx, pc, fretMax = 12) {
  const out = [];
  for (let f = 0; f <= fretMax; f++) if (pitchClass(strings[stringIdx] + f) === pc) out.push(f);
  return out;
}

/**
 * Saitenname, z. B. „tiefe E-Saite“, „A-Saite“, „hohe E-Saite“.
 * Kommt eine Tonklasse mehrfach vor, heißt die tiefste „tiefe …“ und die
 * höchste Saite des Instruments „hohe …“.
 */
export function stringName(strings, stringIdx, opts) {
  const pc = pitchClass(strings[stringIdx]);
  const name = `${pcName(pc, opts)}-Saite`;
  const same = strings.map((m, i) => (pitchClass(m) === pc ? i : -1)).filter((i) => i >= 0);
  if (same.length < 2) return name;
  if (stringIdx === same[0]) return `tiefe ${name}`;
  if (stringIdx === strings.length - 1) return `hohe ${name}`;
  return name;
}

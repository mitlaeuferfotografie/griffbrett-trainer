// Tonnamen, Frequenz ↔ MIDI-Nummer ↔ Cent.
// MIDI-Konvention: 69 = a' (A4), 60 = c' (C4). Tonhöhen werden intern immer als
// MIDI-Zahl gerechnet; Namen entstehen erst bei der Anzeige.

export const NAMES = {
  de: {
    sharp: ['C', 'Cis', 'D', 'Dis', 'E', 'F', 'Fis', 'G', 'Gis', 'A', 'Ais', 'H'],
    flat: ['C', 'Des', 'D', 'Es', 'E', 'F', 'Ges', 'G', 'As', 'A', 'B', 'H'],
  },
  int: {
    sharp: ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'],
    flat: ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'],
  },
};

export const NATURAL_PCS = [0, 2, 4, 5, 7, 9, 11];

export function isNatural(midi) {
  return NATURAL_PCS.includes(pitchClass(midi));
}

export function pitchClass(midi) {
  return ((Math.round(midi) % 12) + 12) % 12;
}

/** Wissenschaftliche Oktavzahl: C4 = c' (MIDI 60). */
export function octaveOf(midi) {
  return Math.floor(Math.round(midi) / 12) - 1;
}

/**
 * Name einer Tonklasse.
 * opts.naming: 'de' (H/B) | 'int' (B/B♭); opts.accidentals: 'sharp' | 'flat' | 'both'
 */
export function pcName(pc, opts = {}) {
  const set = NAMES[opts.naming === 'int' ? 'int' : 'de'];
  const sharp = set.sharp[pc];
  const flat = set.flat[pc];
  if (opts.accidentals === 'both' && sharp !== flat) return `${sharp}/${flat}`;
  return opts.accidentals === 'flat' ? flat : sharp;
}

export function noteName(midi, opts = {}, { octave = false } = {}) {
  const name = pcName(pitchClass(midi), opts);
  return octave ? `${name}${octaveOf(midi)}` : name;
}

export function midiToFreq(midi, a4 = 440) {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

/** Gleitkomma-MIDI-Zahl, z. B. 69.12 = a' + 12 Cent. */
export function freqToMidi(freq, a4 = 440) {
  return 69 + 12 * Math.log2(freq / a4);
}

/** Nächster Halbton und Abweichung in Cent (−50 … +50). */
export function nearestNote(freq, a4 = 440) {
  const m = freqToMidi(freq, a4);
  const midi = Math.round(m);
  return { midi, cents: (m - midi) * 100 };
}

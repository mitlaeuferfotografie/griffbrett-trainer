// Stimmungen als Daten. Saiten von tief nach hoch, als MIDI-Zahl.
// Neue Stimmung = neuer Eintrag hier, die Oberfläche liest nur diese Liste.
import { pcName } from './notes.js';

export const TUNINGS = [
  { id: 'std-6', strings: [40, 45, 50, 55, 59, 64], label: () => 'Standard' },
  { id: 'drop-d-6', strings: [38, 45, 50, 55, 59, 64], label: (o) => `Drop ${pcName(2, o)}` },
  { id: 'std-7', strings: [35, 40, 45, 50, 55, 59, 64], label: () => 'Standard' },
  { id: 'drop-a-7', strings: [33, 40, 45, 50, 55, 59, 64], label: (o) => `Drop ${pcName(9, o)}` },
];

export const DEFAULT_TUNING = { 6: 'std-6', 7: 'std-7' };

export function tuningsFor(stringCount) {
  return TUNINGS.filter((t) => t.strings.length === stringCount);
}

export function getTuning(id, stringCount) {
  const t = TUNINGS.find((x) => x.id === id && (!stringCount || x.strings.length === stringCount));
  return t || TUNINGS.find((x) => x.id === DEFAULT_TUNING[stringCount || 6]);
}

/** „E-A-D-G-H-E“ */
export function tuningNotes(tuning, opts) {
  return tuning.strings.map((m) => pcName(((m % 12) + 12) % 12, opts)).join('-');
}

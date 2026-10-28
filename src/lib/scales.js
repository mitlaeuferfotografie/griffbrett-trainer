// Tonarten und Skalen: Stufen, korrekte Schreibweise (G-Dur hat Fis, nicht Ges),
// Vorzeichen, Paralleltonart, Positionen auf dem Griffbrett.
import { pitchClass } from './notes.js';

export const SCALES = [
  { id: 'major', name: 'Dur', short: 'Dur', steps: [0, 2, 4, 5, 7, 9, 11], family: 'major' },
  { id: 'minor', name: 'Moll (natürlich)', short: 'Moll', steps: [0, 2, 3, 5, 7, 8, 10], family: 'minor' },
  { id: 'harmonic', name: 'Harmonisch Moll', short: 'harmonisch Moll', steps: [0, 2, 3, 5, 7, 8, 11], family: 'minor' },
  { id: 'melodic', name: 'Melodisch Moll', short: 'melodisch Moll', steps: [0, 2, 3, 5, 7, 9, 11], family: 'minor' },
  { id: 'pent-major', name: 'Dur-Pentatonik', short: 'Dur-Pentatonik', steps: [0, 2, 4, 7, 9], family: 'major' },
  { id: 'pent-minor', name: 'Moll-Pentatonik', short: 'Moll-Pentatonik', steps: [0, 3, 5, 7, 10], family: 'minor' },
  { id: 'blues', name: 'Blues', short: 'Blues', steps: [0, 3, 5, 6, 7, 10], family: 'minor' },
  { id: 'dorian', name: 'Dorisch', short: 'Dorisch', steps: [0, 2, 3, 5, 7, 9, 10], family: 'mode' },
  { id: 'phrygian', name: 'Phrygisch', short: 'Phrygisch', steps: [0, 1, 3, 5, 7, 8, 10], family: 'mode' },
  { id: 'lydian', name: 'Lydisch', short: 'Lydisch', steps: [0, 2, 4, 6, 7, 9, 11], family: 'mode' },
  { id: 'mixolydian', name: 'Mixolydisch', short: 'Mixolydisch', steps: [0, 2, 4, 5, 7, 9, 10], family: 'mode' },
  { id: 'locrian', name: 'Lokrisch', short: 'Lokrisch', steps: [0, 1, 3, 5, 6, 8, 10], family: 'mode' },
];

export function getScale(id) {
  return SCALES.find((s) => s.id === id) || SCALES[0];
}

const DEGREE = { 0: '1', 1: '♭2', 2: '2', 3: '♭3', 4: '3', 5: '4', 6: '♭5', 7: '5', 8: '♭6', 9: '6', 10: '♭7', 11: '7' };

/** Stufenbezeichnung eines Halbtonabstands in dieser Skala (Lydisch: ♯4 statt ♭5). */
export function degreeLabel(scale, semis) {
  if (scale.id === 'lydian' && semis === 6) return '♯4';
  return DEGREE[semis];
}

/** Stufennummer 1–7 (für die Buchstabenfolge) */
function degreeNumber(label) {
  return Number(label.replace(/[♭♯]/g, ''));
}

// Stammtöne C D E F G A H(B)
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];

/** Name eines Tons aus Stammton (0 = C … 6 = H/B) und Vorzeichen (−2 … +2). */
export function spellName(letter, acc, naming = 'de') {
  if (naming === 'int') {
    const base = 'CDEFGAB'[letter];
    return base + ({ '-2': '𝄫', '-1': '♭', 0: '', 1: '♯', 2: '𝄪' }[acc] ?? '');
  }
  const base = 'CDEFGAH'[letter];
  if (acc === 0) return base;
  if (letter === 6) return { '-2': 'Heses', '-1': 'B', 1: 'His', 2: 'Hisis' }[acc];
  if (acc > 0) return base + 'is'.repeat(acc);
  // Es, As (statt Ees, Aes); Eses, Asas
  if (letter === 2 || letter === 5) return base + 's' + 'es'.repeat(-acc - 1);
  return base + 'es'.repeat(-acc);
}

function spellWithRootLetter(rootPc, rootLetter, scale) {
  return scale.steps.map((semis) => {
    const label = degreeLabel(scale, semis);
    const letter = (rootLetter + degreeNumber(label) - 1) % 7;
    const pc = (rootPc + semis) % 12;
    let acc = (((pc - LETTER_PC[letter]) % 12) + 12) % 12;
    if (acc > 6) acc -= 12;
    return { semis, label, pc, letter, acc };
  });
}

const accCount = (notes) => notes.reduce((n, x) => n + Math.abs(x.acc), 0);

/**
 * Skala mit korrekter Schreibweise. Bei schwarzen Tasten als Grundton wird die Variante
 * mit weniger Vorzeichen gewählt (Gleichstand: `prefer` 'sharp' | 'flat').
 * Rückgabe: [{ semis, label, pc, letter, acc }]
 */
export function spellScale(rootPc, scale, prefer = 'flat') {
  const natural = LETTER_PC.indexOf(rootPc);
  if (natural >= 0) return spellWithRootLetter(rootPc, natural, scale);
  const sharp = spellWithRootLetter(rootPc, LETTER_PC.indexOf(rootPc - 1), scale);
  const flat = spellWithRootLetter(rootPc, LETTER_PC.indexOf((rootPc + 1) % 12), scale);
  const a = accCount(sharp);
  const b = accCount(flat);
  if (a !== b) return a < b ? sharp : flat;
  return prefer === 'sharp' ? sharp : flat;
}

/** Name der Tonart, z. B. „G-Dur“, „e-Moll“, „D Dorisch“, „A Moll-Pentatonik“ */
export function keyName(rootPc, scale, naming = 'de', prefer) {
  const root = spellScale(rootPc, scale, prefer)[0];
  const name = spellName(root.letter, root.acc, naming);
  if (scale.id === 'major') return `${name}-Dur`;
  if (scale.id === 'minor') return naming === 'de' ? `${name.toLowerCase()}-Moll` : `${name}-Moll`;
  if (scale.id === 'harmonic' || scale.id === 'melodic') {
    return `${naming === 'de' ? name.toLowerCase() : name}-Moll ${scale.id === 'harmonic' ? 'harmonisch' : 'melodisch'}`;
  }
  return `${name} ${scale.short}`;
}

/** Vorzeichen (nur für Dur/Moll/Modi sinnvoll): { count, type: '♯'|'♭'|'', notes: [Namen] } */
export function keySignature(rootPc, scale, naming = 'de', prefer) {
  if (scale.steps.length !== 7 || scale.id === 'harmonic' || scale.id === 'melodic') return null;
  const notes = spellScale(rootPc, scale, prefer).filter((n) => n.acc !== 0);
  if (!notes.length) return { count: 0, type: '', notes: [] };
  const type = notes[0].acc > 0 ? '♯' : '♭';
  // Reihenfolge des Quintenzirkels
  const order = type === '♯' ? [3, 0, 4, 1, 5, 2, 6] : [6, 2, 5, 1, 4, 0, 3];
  const sorted = order.map((l) => notes.find((n) => n.letter === l)).filter(Boolean);
  return { count: notes.length, type, notes: sorted.map((n) => spellName(n.letter, n.acc, naming)) };
}

/** Paralleltonart für Dur/Moll: { rootPc, scaleId } */
export function relativeKey(rootPc, scale) {
  if (scale.id === 'major') return { rootPc: (rootPc + 9) % 12, scaleId: 'minor' };
  if (scale.id === 'minor') return { rootPc: (rootPc + 3) % 12, scaleId: 'major' };
  if (scale.id === 'pent-major') return { rootPc: (rootPc + 9) % 12, scaleId: 'pent-minor' };
  if (scale.id === 'pent-minor') return { rootPc: (rootPc + 3) % 12, scaleId: 'pent-major' };
  return null;
}

/** Stufe eines Tons in der Skala (Halbtöne über dem Grundton) oder null. */
export function degreeOf(rootPc, scale, midi) {
  const semis = (((pitchClass(midi) - rootPc) % 12) + 12) % 12;
  return scale.steps.includes(semis) ? semis : null;
}

/** Farbklasse je Stufe: Grundton, Terz, Quinte hervorgehoben, übrige neutral. */
export function degreeRole(semis) {
  if (semis === 0) return 'root';
  if (semis === 3 || semis === 4) return 'third';
  if (semis === 6 || semis === 7) return 'fifth';
  return 'other';
}

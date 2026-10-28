// CAGED: die fünf offenen Akkordgriffe C, A, G, E, D als verschiebbare Formen.
// Jede Form ist als offener Griff hinterlegt (Bünde je Saite, null = nicht gespielt) und wird
// um `shift` Bünde verschoben, bis ihr Grundton dem gewünschten Grundton entspricht.
// Dazu ein Lage-Fenster (Bünde relativ zur offenen Form), in dem Arpeggio und Tonleiter liegen.
// Gilt für die Standardstimmung (Quarten, große Terz G→H); bei 7 Saiten für die oberen sechs.
import { degreeOf } from './scales.js';
import { status, STATUS_ORDER } from './srs.js';
import { UNLOCK_WIRD, UNLOCK_SITZT } from './curriculum.js';

export const CAGED_ORDER = ['C', 'A', 'G', 'E', 'D'];

export const QUALITIES = {
  major: { id: 'major', label: 'Dur', triad: [0, 4, 7], scales: ['major', 'pent-major'] },
  minor: { id: 'minor', label: 'Moll', triad: [0, 3, 7], scales: ['minor', 'pent-minor'] },
};

// grip: tiefe E- bis hohe E-Saite; rootPc: Grundton der offenen Form; win: Lage-Fenster
export const SHAPES = {
  major: {
    C: { grip: [null, 3, 2, 0, 1, 0], rootPc: 0, win: [0, 3] },
    A: { grip: [null, 0, 2, 2, 2, 0], rootPc: 9, win: [-1, 2] },
    G: { grip: [3, 2, 0, 0, 0, 3], rootPc: 7, win: [-1, 3] },
    E: { grip: [0, 2, 2, 1, 0, 0], rootPc: 4, win: [-1, 2] },
    D: { grip: [null, null, 0, 2, 3, 2], rootPc: 2, win: [-1, 3] },
  },
  minor: {
    C: { grip: [null, 3, 1, 0, 1, 3], rootPc: 0, win: [0, 3] },
    A: { grip: [null, 0, 2, 2, 1, 0], rootPc: 9, win: [0, 3] },
    G: { grip: [3, 1, 0, 0, 3, 3], rootPc: 7, win: [0, 3] },
    E: { grip: [0, 2, 2, 0, 0, 0], rootPc: 4, win: [0, 3] },
    D: { grip: [null, null, 0, 2, 3, 1], rootPc: 2, win: [0, 3] },
  },
};

const STD_STEPS = [5, 5, 5, 4, 5];

/** Index der tiefsten der sechs Standard-Saiten oder null, wenn die Stimmung nicht passt. */
export function cagedBase(strings) {
  const base = strings.length - 6;
  if (base < 0) return null;
  for (let i = 0; i < 5; i++) if (strings[base + i + 1] - strings[base + i] !== STD_STEPS[i]) return null;
  return base;
}

const mod12 = (x) => ((x % 12) + 12) % 12;

/**
 * Alle Lagen der Formen für Grundton/Tongeschlecht bis fretMax, sortiert entlang des Halses.
 * [{ id: 'E', key: 'E:5', shift, lo, hi, grip: [{string, fret, midi, semis}], arp: [...] }]
 */
export function cagedPositions(strings, rootPc, quality = 'major', fretMax = 24) {
  const base = cagedBase(strings);
  if (base == null) return [];
  const q = QUALITIES[quality];
  const out = [];
  for (const id of CAGED_ORDER) {
    const sh = SHAPES[quality][id];
    const first = mod12(rootPc - sh.rootPc);
    for (let shift = first; shift <= fretMax; shift += 12) {
      const gripFrets = sh.grip.filter((f) => f != null).map((f) => f + shift);
      if (Math.max(...gripFrets) > fretMax) continue;
      const lo = Math.max(0, shift + sh.win[0]);
      const hi = Math.min(fretMax, shift + sh.win[1]);
      const grip = [];
      sh.grip.forEach((f, i) => {
        if (f == null) return;
        const s = base + i;
        const midi = strings[s] + f + shift;
        grip.push({ string: s, fret: f + shift, midi, semis: mod12(midi - rootPc) });
      });
      const arp = tonesInWindow(strings, base, lo, hi, (m) => q.triad.includes(mod12(m - rootPc)), rootPc);
      out.push({ id, key: `${id}:${shift}`, shift, lo, hi, grip, arp });
    }
  }
  return out.sort((a, b) => a.lo - b.lo || a.hi - b.hi);
}

function tonesInWindow(strings, base, lo, hi, accept, rootPc) {
  const notes = [];
  for (let s = base; s < base + 6; s++) {
    for (let f = lo; f <= hi; f++) {
      const midi = strings[s] + f;
      if (accept(midi)) notes.push({ string: s, fret: f, midi, semis: mod12(midi - rootPc) });
    }
  }
  return notes;
}

/** Töne einer Tonleiter im Fenster einer Lage. */
export function scaleInPosition(strings, pos, rootPc, scale) {
  const base = cagedBase(strings);
  return tonesInWindow(strings, base, pos.lo, pos.hi, (m) => degreeOf(rootPc, scale, m) != null, rootPc);
}

/**
 * Spielfolge (aufwärts nach Tonhöhe, jeder Ton einmal). Liegt ein Ton doppelt im Fenster
 * (z. B. G- und H-Saite), zählt der auf der höheren Saite – so bleibt die Hand in der Lage.
 */
export function playOrder(notes) {
  const byMidi = new Map();
  for (const n of notes) {
    const prev = byMidi.get(n.midi);
    if (!prev || n.string > prev.string) byMidi.set(n.midi, n);
  }
  return [...byMidi.values()].sort((a, b) => a.midi - b.midi);
}

/** Grundton-Saite der Form (für Hinweise wie „Grundton auf der A-Saite“): tiefster Grundton im Griff. */
export function rootOfGrip(pos) {
  return pos.grip.filter((n) => n.semis === 0).sort((a, b) => a.midi - b.midi)[0];
}

export function shapeLabel(id) {
  return `${id}-Form`;
}

// ---------- CAGED-Übung (Lernstand progress.caged) ----------
// Lerneinheit = Tongeschlecht × Form × Grundton, Schlüssel "<major|minor>:<Form>:<Tonklasse>" (nie ändern).
// Aufgabe: „D-Dur · A-Form“ – Lage selbst finden, Arpeggio der Form aufwärts spielen.
// Reaktionszeit = Zeit bis zum ersten richtigen Ton (das Finden der Lage ist die Leistung).
// Richtig, wenn höchstens CAGED_MAX_MISSES falsche Töne dazwischen lagen.

export const CAGED_MAX_MISSES = 1;
/** Höchster Bund für Aufgaben: der ganze CAGED-Kreis braucht mehr als 12 Bünde. */
export const CAGED_FRET_LIMIT = 15;

export const CAGED_GROUPS = [
  { id: 'c1', quality: 'major', shapes: ['E', 'A'], label: 'Dur: E- und A-Form' },
  { id: 'c2', quality: 'major', shapes: ['C', 'G', 'D'], label: 'Dur: C-, G- und D-Form' },
  { id: 'c3', quality: 'minor', shapes: ['E', 'A'], label: 'Moll: E- und A-Form' },
  { id: 'c4', quality: 'minor', shapes: ['C', 'G', 'D'], label: 'Moll: C-, G- und D-Form' },
];

export function cagedKey(quality, shape, rootPc) {
  return `${quality}:${shape}:${rootPc}`;
}

export function parseCagedKey(key) {
  const [quality, shape, rootPc] = key.split(':');
  return { quality, shape, rootPc: Number(rootPc) };
}

/** Aktive Lerneinheiten der ersten `unlocked` Gruppen: [{ key, quality, shape, rootPc, group }] */
export function cagedUnits(unlocked) {
  const out = [];
  CAGED_GROUPS.slice(0, unlocked).forEach((g, gi) => {
    for (const shape of g.shapes) for (let r = 0; r < 12; r++) out.push({ key: cagedKey(g.quality, shape, r), quality: g.quality, shape, rootPc: r, group: gi });
  });
  return out;
}

function share(list, units, min) {
  if (!list.length) return 0;
  return list.filter((u) => STATUS_ORDER[status(units[u.key])] >= STATUS_ORDER[min]).length / list.length;
}

export function computeCagedUnlocked(units, stored = 1) {
  let n = Math.max(1, stored || 1);
  while (n < CAGED_GROUPS.length) {
    const list = cagedUnits(n);
    if (share(list, units, 'wird') >= UNLOCK_WIRD && share(list, units, 'sitzt') >= UNLOCK_SITZT) n++;
    else break;
  }
  return n;
}

export function cagedUnlockProgress(units, unlocked) {
  if (unlocked >= CAGED_GROUPS.length) return null;
  const list = cagedUnits(unlocked);
  return { next: CAGED_GROUPS[unlocked], value: Math.min(1, share(list, units, 'wird') / UNLOCK_WIRD, share(list, units, 'sitzt') / UNLOCK_SITZT) };
}

/**
 * „Vom Grundton aus“: vom tiefsten Grundton der Form hoch bis zum höchsten Ton, hinunter bis
 * zum tiefsten Ton und zurück zum Grundton. Beginnt die Form mit dem Grundton: einfach aufwärts.
 */
export function rootFirstOrder(seq) {
  const i = seq.findIndex((n) => n.semis === 0);
  if (i <= 0) return seq;
  return [...seq.slice(i), ...seq.slice(0, seq.length - 1).reverse(), ...seq.slice(1, i + 1)];
}

/**
 * Konkrete Aufgabe: tiefste Lage der Form bis CAGED_FRET_LIMIT. Spielfolge: Arpeggio aufwärts
 * ab dem tiefsten Ton der Form, mit fromRoot ab dem Grundton (rootFirstOrder).
 */
export function makeCagedTask(strings, unit, kind, { fromRoot = false } = {}) {
  const pos = cagedPositions(strings, unit.rootPc, unit.quality, CAGED_FRET_LIMIT).filter((p) => p.id === unit.shape)[0];
  if (!pos) return null;
  return { key: unit.key, kind, quality: unit.quality, shape: unit.shape, rootPc: unit.rootPc, pos, seq: fromRoot ? rootFirstOrder(playOrder(pos.arp)) : playOrder(pos.arp) };
}

// Ausbaustufe 2: Intervalle als Griff-Formen.
//
// Lerneinheit = Form: Intervall (Halbtöne) × Saitenwechsel (0, +1, +2) × Bundabstand.
// Schlüssel "<halbtöne>:<saiten>:<bunde>", z. B. "7:1:2" = Quinte eine Saite höher, zwei
// Bünde weiter. Der Bundabstand macht die Form eindeutig – auch den Sonderfall
// G→H-Saite (große Terz statt Quarte zwischen den Saiten), der eine eigene Form ergibt.
// Nur Formen innerhalb einer Hand-Lage (|Bundabstand| ≤ MAX_STRETCH).
import { pitchClass } from './notes.js';
import { status, STATUS_ORDER } from './srs.js';
import { UNLOCK_WIRD, UNLOCK_SITZT } from './curriculum.js';

export const MAX_STRETCH = 4;
export const STRING_OFFSETS = [0, 1, 2];

export const INTERVALS = [
  { semis: 1, degree: '♭2', name: 'kleine Sekunde' },
  { semis: 2, degree: '2', name: 'große Sekunde' },
  { semis: 3, degree: '♭3', name: 'kleine Terz' },
  { semis: 4, degree: '3', name: 'große Terz' },
  { semis: 5, degree: '4', name: 'Quarte' },
  { semis: 6, degree: '♭5', name: 'Tritonus' },
  { semis: 7, degree: '5', name: 'Quinte' },
  { semis: 8, degree: '♭6', name: 'kleine Sexte' },
  { semis: 9, degree: '6', name: 'große Sexte' },
  { semis: 10, degree: '♭7', name: 'kleine Septime' },
  { semis: 11, degree: '7', name: 'große Septime' },
  { semis: 12, degree: '8', name: 'Oktave' },
];

export function intervalInfo(semis) {
  return INTERVALS.find((i) => i.semis === semis);
}

/** Progressive Einführung: welche Intervalle in welcher Stufe dazukommen. */
export const INTERVAL_GROUPS = [
  { id: 'i1', semis: [12, 7], label: 'Oktave & Quinte' },
  { id: 'i2', semis: [5, 4, 3], label: 'Quarte & Terzen' },
  { id: 'i3', semis: [2, 10, 9], label: 'Sekunde, kleine Septime, große Sexte' },
  { id: 'i4', semis: [11, 1, 8, 6], label: 'Große Septime, kleine Sekunde, kleine Sexte, Tritonus' },
];

export function shapeKey(semis, offset, fretDelta) {
  return `${semis}:${offset}:${fretDelta}`;
}

export function parseShapeKey(key) {
  const [semis, offset, fretDelta] = key.split(':').map(Number);
  return { semis, offset, fretDelta };
}

/** Alle Formen, die es in dieser Stimmung gibt, mit den Saitenpaaren, auf denen sie vorkommen. */
export function shapesFor(strings) {
  const map = new Map();
  for (const { semis } of INTERVALS) {
    for (const offset of STRING_OFFSETS) {
      for (let s = 0; s + offset < strings.length; s++) {
        const fretDelta = semis - (strings[s + offset] - strings[s]);
        if (Math.abs(fretDelta) > MAX_STRETCH) continue;
        if (offset === 0 && semis === 12) continue; // Oktave auf derselben Saite = 12 Bünde
        const key = shapeKey(semis, offset, fretDelta);
        if (!map.has(key)) map.set(key, { key, semis, offset, fretDelta, rootStrings: [] });
        map.get(key).rootStrings.push(s);
      }
    }
  }
  return [...map.values()];
}

/** Aktive Formen (freigeschaltete Intervall-Gruppen), mit Gruppenindex für die Einführung. */
export function activeShapes(strings, unlocked) {
  const shapes = shapesFor(strings);
  const out = [];
  INTERVAL_GROUPS.slice(0, unlocked).forEach((g, gi) => {
    for (const semis of g.semis) {
      shapes
        .filter((sh) => sh.semis === semis)
        .sort((a, b) => a.offset - b.offset || Math.abs(a.fretDelta) - Math.abs(b.fretDelta))
        .forEach((sh) => out.push({ ...sh, group: gi }));
    }
  });
  return out;
}

function share(shapes, units, min) {
  if (!shapes.length) return 0;
  return shapes.filter((s) => STATUS_ORDER[status(units[s.key])] >= STATUS_ORDER[min]).length / shapes.length;
}

export function computeIntervalUnlocked(strings, units, stored = 1) {
  let n = Math.max(1, stored || 1);
  while (n < INTERVAL_GROUPS.length) {
    const sh = activeShapes(strings, n);
    if (share(sh, units, 'wird') >= UNLOCK_WIRD && share(sh, units, 'sitzt') >= UNLOCK_SITZT) n++;
    else break;
  }
  return n;
}

export function intervalUnlockProgress(strings, units, unlocked) {
  if (unlocked >= INTERVAL_GROUPS.length) return null;
  const sh = activeShapes(strings, unlocked);
  return {
    next: INTERVAL_GROUPS[unlocked],
    value: Math.min(1, share(sh, units, 'wird') / UNLOCK_WIRD, share(sh, units, 'sitzt') / UNLOCK_SITZT),
  };
}

/**
 * Konkrete Aufgabe zu einer Form: zufälliger Grundton (Saite + Bund), sodass Grund- und
 * Zielton im Bereich 1 … fretMax liegen (keine Leersaiten, damit beide sichtbar sind).
 */
export function makeIntervalTask(strings, shape, fretMax, rand = Math.random) {
  const options = [];
  for (const s of shape.rootStrings) {
    for (let f = 1; f <= fretMax; f++) {
      const tf = f + shape.fretDelta;
      if (tf >= 1 && tf <= fretMax) options.push({ rootString: s, rootFret: f });
    }
  }
  if (!options.length) return null;
  const o = options[Math.floor(rand() * options.length)];
  const rootMidi = strings[o.rootString] + o.rootFret;
  return {
    key: shape.key,
    semis: shape.semis,
    offset: shape.offset,
    fretDelta: shape.fretDelta,
    rootString: o.rootString,
    rootFret: o.rootFret,
    rootMidi,
    string: o.rootString + shape.offset,
    fret: o.rootFret + shape.fretDelta,
    targetMidi: rootMidi + shape.semis,
    pc: pitchClass(rootMidi + shape.semis),
  };
}

/** Richtig = exakt der Zielton (mit Oktave). */
export function judgeInterval(strings, task, midi) {
  const m = Math.round(midi);
  const fret = m - strings[task.string];
  return { correct: m === task.targetMidi, playedFret: fret >= 0 && fret <= 24 ? fret : null, creditKey: task.key };
}

export function offsetLabel(offset) {
  return offset === 0 ? 'gleiche Saite' : offset === 1 ? 'eine Saite höher' : 'zwei Saiten höher';
}

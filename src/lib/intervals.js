// Ausbaustufe 2: Intervalle als Griff-Formen.
//
// Lerneinheit = Form: Intervall (Halbtöne, mit Vorzeichen) × Saitenwechsel × Bundabstand.
// Schlüssel "<halbtöne>:<saiten>:<bünde>", z. B. "7:1:2" = Quinte eine Saite höher, zwei
// Bünde weiter; "-5:-1:0" = Quinte darunter (Stufe 5 der tieferen Oktave), eine Saite
// tiefer, gleicher Bund. Der Bundabstand macht die Form eindeutig – auch den Sonderfall
// G→H-Saite, der eine eigene Form ergibt.
//
// Aufwärts: Zielton = Grundton + Intervall (Saitenwechsel 0, +1, +2).
// Abwärts („♭7 darunter“): dieselbe Stufe eine Oktave tiefer, also Grundton − (12 − Intervall),
// bei der Oktave Grundton − 12 (Saitenwechsel 0, −1, −2).
// Nur Formen innerhalb einer Hand-Lage (|Bundabstand| ≤ MAX_STRETCH).
import { pitchClass } from './notes.js';
import { status, STATUS_ORDER } from './srs.js';
import { UNLOCK_WIRD, UNLOCK_SITZT } from './curriculum.js';

export const MAX_STRETCH = 4;
const OFFSETS = { up: [0, 1, 2], down: [0, -1, -2] };

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

/** Stufe (1 … 12 Halbtöne) zu einem vorzeichenbehafteten Abstand. */
export function degreeSemis(semis) {
  if (semis > 0) return semis;
  return semis === -12 ? 12 : semis + 12;
}

export function intervalInfo(semis) {
  return INTERVALS.find((i) => i.semis === degreeSemis(semis));
}

/**
 * Anzeige: { degree: '♭7', name: 'kleine Septime', down: true, distance: 'große Sekunde abwärts' }
 * Abwärts ist die Stufe gemeint (♭7 darunter = Ganzton tiefer), distance nennt den Abstand.
 */
export function shapeInfo(semis) {
  const i = intervalInfo(semis);
  const down = semis < 0;
  return { degree: i.degree, name: i.name, down, distance: down ? `${INTERVALS.find((x) => x.semis === -semis).name} abwärts` : i.name };
}

/** Progressive Einführung: welche Stufen in welcher Gruppe dazukommen (jeweils auf- und abwärts). */
export const INTERVAL_GROUPS = [
  { id: 'i1', semis: [12, 7], label: 'Oktave & Quinte' },
  { id: 'i2', semis: [5, 4, 3], label: 'Quarte & Terzen' },
  { id: 'i3', semis: [2, 10, 9], label: 'Sekunde, kleine Septime, große Sexte' },
  { id: 'i4', semis: [11, 1, 8, 6], label: 'Große Septime, kleine Sekunde, kleine Sexte, Tritonus' },
];

export const DIRECTIONS = ['both', 'up', 'down'];

export function shapeKey(semis, offset, fretDelta) {
  return `${semis}:${offset}:${fretDelta}`;
}

export function parseShapeKey(key) {
  const [semis, offset, fretDelta] = key.split(':').map(Number);
  return { semis, offset, fretDelta };
}

function signedSteps(dir) {
  const up = INTERVALS.map((i) => i.semis);
  const down = INTERVALS.map((i) => (i.semis === 12 ? -12 : i.semis - 12));
  return dir === 'up' ? up : dir === 'down' ? down : [...up, ...down];
}

/** Alle Formen dieser Stimmung (Richtung 'both' | 'up' | 'down'), mit möglichen Grundton-Saiten. */
export function shapesFor(strings, dir = 'both') {
  const map = new Map();
  for (const semis of signedSteps(dir)) {
    for (const offset of semis > 0 ? OFFSETS.up : OFFSETS.down) {
      if (offset === 0 && Math.abs(semis) === 12) continue; // Oktave auf derselben Saite = 12 Bünde
      for (let s = 0; s < strings.length; s++) {
        const t = s + offset;
        if (t < 0 || t >= strings.length) continue;
        const fretDelta = semis - (strings[t] - strings[s]);
        if (Math.abs(fretDelta) > MAX_STRETCH) continue;
        const key = shapeKey(semis, offset, fretDelta);
        if (!map.has(key)) map.set(key, { key, semis, deg: degreeSemis(semis), offset, fretDelta, rootStrings: [] });
        map.get(key).rootStrings.push(s);
      }
    }
  }
  return [...map.values()];
}

/** Aktive Formen (freigeschaltete Gruppen) mit Gruppenindex für die Einführung. */
export function activeShapes(strings, unlocked, dir = 'both') {
  const shapes = shapesFor(strings, dir);
  const out = [];
  INTERVAL_GROUPS.slice(0, unlocked).forEach((g, gi) => {
    for (const deg of g.semis) {
      shapes
        .filter((sh) => sh.deg === deg)
        .sort((a, b) => b.semis - a.semis || Math.abs(a.offset) - Math.abs(b.offset) || Math.abs(a.fretDelta) - Math.abs(b.fretDelta))
        .forEach((sh) => out.push({ ...sh, group: gi }));
    }
  });
  return out;
}

function share(shapes, units, min) {
  if (!shapes.length) return 0;
  return shapes.filter((s) => STATUS_ORDER[status(units[s.key])] >= STATUS_ORDER[min]).length / shapes.length;
}

export function computeIntervalUnlocked(strings, units, stored = 1, dir = 'both') {
  let n = Math.max(1, stored || 1);
  while (n < INTERVAL_GROUPS.length) {
    const sh = activeShapes(strings, n, dir);
    if (share(sh, units, 'wird') >= UNLOCK_WIRD && share(sh, units, 'sitzt') >= UNLOCK_SITZT) n++;
    else break;
  }
  return n;
}

export function intervalUnlockProgress(strings, units, unlocked, dir = 'both') {
  if (unlocked >= INTERVAL_GROUPS.length) return null;
  const sh = activeShapes(strings, unlocked, dir);
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
  return ['zwei Saiten tiefer', 'eine Saite tiefer', 'gleiche Saite', 'eine Saite höher', 'zwei Saiten höher'][offset + 2];
}

/** Kurzform für Kästchen: "+1 +2" = eine Saite höher, zwei Bünde weiter */
export function shapeShort(shape) {
  const o = shape.offset === 0 ? '=' : shape.offset > 0 ? `+${shape.offset}` : `−${-shape.offset}`;
  const f = shape.fretDelta === 0 ? '0' : shape.fretDelta > 0 ? `+${shape.fretDelta}` : `−${-shape.fretDelta}`;
  return `${o} ${f}`;
}

// ---------- Zielton benennen ----------
// Schreibweise über Stammton + Intervallnummer (große Terz über Es = G, übermäßige … ♭5 über C = Ges),
// nicht über Tonklassen. Bei schwarzem Grundton gewinnt die Schreibweise mit weniger Vorzeichen
// (Grundton + Zielton zusammen), Gleichstand → Vorliebe ♯/♭.

const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const wrapAcc = (d) => {
  let a = (((d % 12) + 12) % 12);
  if (a > 6) a -= 12;
  return a;
};

/** Intervallnummer (2 … 8) einer Form, z. B. ♭3 → 3, ♭5 → 5, Oktave → 8. */
export function intervalNumber(semis) {
  return Number(intervalInfo(semis).degree.replace(/[♭♯]/g, ''));
}

function spellPair(rootPc, rootLetter, semis) {
  const rootAcc = wrapAcc(rootPc - LETTER_PC[rootLetter]);
  const letter = (rootLetter + intervalNumber(semis) - 1) % 7;
  const pc = (((rootPc + semis) % 12) + 12) % 12;
  return { root: { letter: rootLetter, acc: rootAcc }, target: { letter, acc: wrapAcc(pc - LETTER_PC[letter]), pc } };
}

/** { root: {letter, acc}, target: {letter, acc, pc} } für Grundton (MIDI) und Abstand (Halbtöne, mit Vorzeichen). */
export function spellInterval(rootMidi, semis, prefer = 'sharp') {
  const rootPc = pitchClass(rootMidi);
  const natural = LETTER_PC.indexOf(rootPc);
  if (natural >= 0) return spellPair(rootPc, natural, semis);
  const sharp = spellPair(rootPc, LETTER_PC.indexOf(rootPc - 1), semis);
  const flat = spellPair(rootPc, LETTER_PC.indexOf((rootPc + 1) % 12), semis);
  const cost = (x) => Math.abs(x.root.acc) + Math.abs(x.target.acc) + (Math.abs(x.target.acc) > 1 ? 2 : 0);
  if (cost(sharp) !== cost(flat)) return cost(sharp) < cost(flat) ? sharp : flat;
  return prefer === 'flat' ? flat : sharp;
}

const RARE = new Set(['2:1', '6:1', '0:-1', '3:-1']); // Eis, His, Ces, Fes

/**
 * Vier Antworten (richtige + 3 naheliegende Fehler), gemischt: [{ letter, acc, correct }].
 * Fehlertypen: gleicher Stammton mit anderem Vorzeichen (große/kleine Verwechslung),
 * Nachbar-Stammton (verzählt), enharmonische Verwechslung (nur wenn der Zielton ein Vorzeichen hat).
 */
export function nameChoices(target, rand = Math.random) {
  const pool = [];
  for (let letter = 0; letter < 7; letter++) {
    for (const acc of [-1, 0, 1]) {
      if (letter === target.letter && acc === target.acc) continue;
      if (RARE.has(`${letter}:${acc}`) && letter !== target.letter) continue;
      const pc = (LETTER_PC[letter] + acc + 12) % 12;
      const dp = Math.min((pc - target.pc + 12) % 12, (target.pc - pc + 12) % 12);
      const dl = Math.min((letter - target.letter + 7) % 7, (target.letter - letter + 7) % 7);
      let score;
      if (dp === 0) score = target.acc !== 0 ? 1 : 99;
      else if (dl === 0 && dp === 1) score = 0;
      else if (dl === 1 && dp <= 2) score = 0.6;
      else if (dp <= 2) score = 1.5;
      else score = 5 + dp;
      if (score < 99) pool.push({ letter, acc, score: score + rand() * 0.7 });
    }
  }
  pool.sort((a, b) => a.score - b.score);
  const out = [{ letter: target.letter, acc: target.acc, correct: true }, ...pool.slice(0, 3).map(({ letter, acc }) => ({ letter, acc, correct: false }))];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------- Tippen oder Kopf: automatische Wahl ----------
// Gemerkt wird je Kombination Grundton + Abstand (nicht je Form), denn der Name hängt nur davon ab:
// names["<halbtöne>:<grundton-tonklasse>"] = { streak, seen }.
// Auto: antippen, bis der Name NAME_KNOWN-mal in Folge stimmte; danach Kopf-Modus,
// mit Stichprobe (NAME_CHECK_SHARE) zum Antippen. Ein Fehler setzt die Serie zurück.

export const NAME_KNOWN = 3;
export const NAME_CHECK_SHARE = 0.2;

export function nameKey(task) {
  return `${task.semis}:${pitchClass(task.rootMidi)}`;
}

/** 'off' | 'tap' | 'head' für diese Aufgabe */
export function chooseNameMode(mode, names, key, rand = Math.random) {
  if (mode !== 'auto') return mode === 'tap' || mode === 'head' ? mode : 'off';
  const st = names && names[key];
  if (!st || st.streak < NAME_KNOWN) return 'tap';
  return rand() < NAME_CHECK_SHARE ? 'tap' : 'head';
}

export function applyNameAnswer(stat, ok) {
  const s = stat || { streak: 0, seen: 0 };
  return { streak: ok ? s.streak + 1 : 0, seen: s.seen + 1 };
}

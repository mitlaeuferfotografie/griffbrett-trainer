// Ausbaustufe 3: „Was spiele ich da eigentlich?“
// Freies Spiel wird als Folge erkannter Töne aufgezeichnet (nur Tonhöhe + Zeit, kein Audio).
// Auswertung: Stufenverteilung relativ zum Grundton, passende Tonleitern/Modi, Klartext.
import { pitchClass } from './notes.js';
import { SCALES, getScale, degreeLabel } from './scales.js';

const SEVEN = ['major', 'minor', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian', 'harmonic', 'melodic'];
const PENTA = ['pent-minor', 'pent-major', 'blues'];

const ADJ = {
  major: 'nach Dur (ionisch)',
  minor: 'nach natürlichem Moll (äolisch)',
  dorian: 'dorisch',
  phrygian: 'phrygisch',
  lydian: 'lydisch',
  mixolydian: 'mixolydisch',
  locrian: 'lokrisch',
  harmonic: 'nach harmonisch Moll',
  melodic: 'nach melodisch Moll',
};

const DEGREE_NAME = {
  1: 'kleine Sekunde (♭2)',
  2: 'große Sekunde (2)',
  3: 'kleine Terz (♭3)',
  4: 'große Terz (3)',
  5: 'Quarte (4)',
  6: 'Tritonus (♭5)',
  7: 'Quinte (5)',
  8: 'kleine Sexte (♭6)',
  9: 'große Sexte (6)',
  10: 'kleine Septime (♭7)',
  11: 'große Septime (7)',
};

// „mit der großen Sexte als Farbton“ (Dativ mit Artikel)
const DEGREE_DATIVE = {
  1: 'der kleinen Sekunde (♭2)',
  2: 'der großen Sekunde (2)',
  3: 'der kleinen Terz (♭3)',
  4: 'der großen Terz (3)',
  5: 'der Quarte (4)',
  6: 'dem Tritonus (♭5)',
  7: 'der Quinte (5)',
  8: 'der kleinen Sexte (♭6)',
  9: 'der großen Sexte (6)',
  10: 'der kleinen Septime (♭7)',
  11: 'der großen Septime (7)',
};

/**
 * Gewichtete Stufenverteilung. events: [{ midi, time (ms) }] in zeitlicher Folge.
 * Gewicht = Dauer bis zum nächsten Ton (0,15 … 1,5 s) – lange Töne zählen mehr als Durchgänge.
 */
export function degreeWeights(events, rootPc) {
  const w = new Array(12).fill(0);
  events.forEach((e, i) => {
    const next = events[i + 1];
    const dur = next ? (next.time - e.time) / 1000 : 0.6;
    const weight = Math.max(0.15, Math.min(1.5, dur));
    w[(((pitchClass(e.midi) - rootPc) % 12) + 12) % 12] += weight;
  });
  return w;
}

export function shares(weights) {
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  return weights.map((x) => x / total);
}

/** Anteil der gespielten Töne (gewichtet), der in der Skala liegt. */
export function coverage(weights, scale) {
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  return scale.steps.reduce((sum, s) => sum + weights[s], 0) / total;
}

/**
 * Skalen nach Passung sortiert: höchste Abdeckung zuerst; bei (fast) gleicher Abdeckung
 * gewinnt die Skala, deren Töne auch genutzt wurden (weniger ungenutzte Stufen).
 */
export function rankScales(weights, ids = SCALES.map((s) => s.id), minShare = 0.03) {
  const sh = shares(weights);
  return ids
    .map((id) => {
      const scale = getScale(id);
      const unused = scale.steps.filter((s) => sh[s] < minShare);
      return { scale, coverage: coverage(weights, scale), unused };
    })
    .sort((a, b) => {
      if (Math.abs(a.coverage - b.coverage) > 0.02) return b.coverage - a.coverage;
      return a.unused.length - b.unused.length;
    });
}

/** Grundton automatisch: Kombination aus Grundton und Skala mit der besten Passung; bei Gleichstand der häufigere Ton. */
export function guessRoot(events) {
  let best = null;
  const pcWeights = degreeWeights(events, 0);
  for (let r = 0; r < 12; r++) {
    const w = degreeWeights(events, r);
    const top = rankScales(w, [...SEVEN.slice(0, 7), ...PENTA])[0];
    const score = top.coverage * 10 - top.unused.length * 0.05 + shares(pcWeights)[r] * 2;
    if (!best || score > best.score) best = { rootPc: r, score };
  }
  return best ? best.rootPc : 0;
}

/**
 * Auswertung in Klartext.
 * Rückgabe: { lines: [Text], best7, bestPenta, outside: [{ semis, share }], neverUsed: [semis], weights }
 */
export function describePlaying(events, rootPc) {
  const weights = degreeWeights(events, rootPc);
  const sh = shares(weights);
  const lines = [];
  if (events.length < 8) {
    return { lines: ['Zu wenige Töne für eine Auswertung – spiel etwas länger (mindestens 8 Töne).'], weights, best7: null, bestPenta: null, outside: [], neverUsed: [] };
  }
  const best7 = rankScales(weights, SEVEN)[0];
  const bestPenta = rankScales(weights, PENTA)[0];
  const minor = sh[3] > sh[4];
  const third = sh[3] + sh[4] < 0.03 ? null : minor ? 'Moll' : 'Dur';

  if (bestPenta.coverage >= 0.75) { // Farbtöne dürfen zusammen bis ca. 25 % ausmachen
    const extras = [];
    for (let s = 1; s < 12; s++) if (sh[s] >= 0.04 && !bestPenta.scale.steps.includes(s)) extras.push(s);
    let line = `Du hast überwiegend ${bestPenta.scale.name} gespielt`;
    if (extras.length) {
      line += `, mit ${extras.map((s) => DEGREE_DATIVE[s]).join(' und ')} als Farbton`;
      if (best7.coverage >= 0.95) line += `. Das klingt ${ADJ[best7.scale.id]}.`;
      else line += '.';
    } else line += '.';
    lines.push(line);
  } else {
    lines.push(`Deine Töne passen am besten zu ${best7.scale.name} (${Math.round(best7.coverage * 100)} % der gespielten Töne) – das klingt ${ADJ[best7.scale.id]}.`);
  }
  if (third) lines.push(`Grundcharakter: ${third} (${minor ? 'kleine' : 'große'} Terz ${Math.round((minor ? sh[3] : sh[4]) * 100)} %).`);

  const outside = [];
  for (let s = 1; s < 12; s++) if (sh[s] >= 0.02 && !best7.scale.steps.includes(s)) outside.push({ semis: s, share: sh[s] });
  if (outside.length) {
    lines.push(`Außerhalb von ${best7.scale.name}: ${outside.map((o) => `${DEGREE_NAME[o.semis]} ${Math.round(o.share * 100)} %`).join(', ')} – oft chromatische Durchgänge oder Blue Notes.`);
  }
  const neverUsed = best7.scale.steps.filter((s) => s !== 0 && sh[s] < 0.02);
  if (neverUsed.length) {
    lines.push(`Diese Töne von ${best7.scale.name} hast du (fast) nie gespielt: ${neverUsed.map((s) => degreeLabel(best7.scale, s)).join(', ')}. Probier sie bewusst aus.`);
  }
  return { lines, best7, bestPenta, outside, neverUsed, weights };
}

/**
 * Wahrscheinliche Position eines Tons: unter allen Kandidaten (Saite, Bund) der, der am
 * nächsten an den zuletzt gespielten Positionen liegt (Hand bleibt meist in der Lage).
 */
export function estimatePosition(candidates, recent) {
  if (!candidates.length) return null;
  if (!recent.length) return [...candidates].sort((a, b) => a.fret - b.fret)[0];
  const last = recent.slice(-4);
  const meanFret = last.reduce((a, p) => a + p.fret, 0) / last.length;
  const lastString = last[last.length - 1].string;
  return [...candidates].sort(
    (a, b) => Math.abs(a.fret - meanFret) + Math.abs(a.string - lastString) * 0.6 - (Math.abs(b.fret - meanFret) + Math.abs(b.string - lastString) * 0.6),
  )[0];
}

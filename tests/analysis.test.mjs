import test from 'node:test';
import assert from 'node:assert/strict';
import { degreeWeights, rankScales, describePlaying, guessRoot, estimatePosition } from '../src/lib/analysis.js';
import { positionsForMidi } from '../src/lib/fretboard.js';
import { getTuning } from '../src/lib/tunings.js';

const STD = getTuning('std-6').strings;
// Tonfolge mit gleichmäßigem Abstand (0,4 s)
const play = (midis) => midis.map((midi, i) => ({ midi, time: i * 400 }));
const rep = (arr, n) => Array.from({ length: n }, () => arr).flat();

const A = 9;
const PENT_A = [57, 60, 62, 64, 67, 69]; // A C D E G A

test('Moll-Pentatonik wird erkannt', () => {
  const r = describePlaying(play(rep(PENT_A, 4)), A);
  assert.equal(r.bestPenta.scale.id, 'pent-minor');
  assert.match(r.lines[0], /überwiegend Moll-Pentatonik gespielt\./);
  assert.match(r.lines.join(' '), /Grundcharakter: Moll/);
});

test('Pentatonik + große Sexte → „klingt dorisch“', () => {
  const notes = rep([...PENT_A, 66], 4); // Fis = große Sexte über A
  const r = describePlaying(play(notes), A);
  assert.equal(r.best7.scale.id, 'dorian');
  assert.match(r.lines[0], /mit der großen Sexte \(6\) als Farbton\. Das klingt dorisch\./);
});

test('Pentatonik + kleine Sexte → äolisch', () => {
  const r = describePlaying(play(rep([...PENT_A, 65], 4)), A);
  assert.equal(r.best7.scale.id, 'minor');
  assert.match(r.lines[0], /natürlichem Moll/);
});

test('Dur-Tonleiter mit großer Septime → ionisch; mit kleiner Septime → mixolydisch', () => {
  const C = 0;
  const ion = describePlaying(play(rep([60, 62, 64, 65, 67, 69, 71, 72], 3)), C);
  assert.equal(ion.best7.scale.id, 'major');
  const mix = describePlaying(play(rep([60, 62, 64, 65, 67, 69, 70, 72], 3)), C);
  assert.equal(mix.best7.scale.id, 'mixolydian');
  assert.match(mix.lines.join(' '), /mixolydisch/);
});

test('Ungenutzte Töne und Töne außerhalb werden genannt', () => {
  const r = describePlaying(play(rep([...PENT_A, 63], 4)), A); // Es = ♭5 (Blue Note)
  assert.ok(r.lines.some((l) => l.includes('Tritonus')), r.lines.join(' | '));
  assert.ok(r.neverUsed.length > 0);
});

test('Zu wenige Töne: freundlicher Hinweis', () => {
  assert.match(describePlaying(play([57, 60]), A).lines[0], /Zu wenige Töne/);
});

test('Lange Töne zählen mehr als kurze Durchgänge', () => {
  const ev = [
    { midi: 57, time: 0 },
    { midi: 58, time: 1500 }, // langer Grundton
    { midi: 60, time: 1600 }, // kurzer Durchgang
    { midi: 64, time: 3000 },
  ];
  const w = degreeWeights(ev, A);
  assert.ok(w[0] > w[1] * 5);
});

test('Grundton automatisch', () => {
  assert.equal(guessRoot(play(rep([57, 60, 62, 64, 67, 57, 57], 4))), A);
  assert.equal(guessRoot(play(rep([64, 67, 69, 71, 74, 64, 64], 4))), 4); // e-Moll-Pentatonik
});

test('Rangfolge bevorzugt die kleinere passende Skala', () => {
  const w = degreeWeights(play(rep(PENT_A, 3)), A);
  const top = rankScales(w)[0];
  assert.equal(top.scale.id, 'pent-minor');
});

test('Positionsschätzung bleibt in der Lage', () => {
  // A (57) liegt u. a. auf tiefer E-Saite Bund 17, A-Saite Bund 12, D-Saite Bund 7, G-Saite Bund 2
  const cands = positionsForMidi(STD, 57, 24);
  const recent = [
    { string: 2, fret: 5 },
    { string: 2, fret: 7 },
    { string: 3, fret: 5 },
  ];
  assert.deepEqual(estimatePosition(cands, recent), { string: 2, fret: 7 });
  assert.equal(estimatePosition(cands, []).fret, Math.min(...cands.map((c) => c.fret)));
});

import { estimatePath } from '../src/lib/analysis.js';
const cand = (m) => positionsForMidi(STD, m, 24);

test('Phrase um den 12. Bund über zwei Oktaven wird oben erkannt (nicht in den ersten Bünden)', () => {
  // A-Moll-Pentatonik, Box in der 12. Lage
  const phrase = [57, 60, 62, 64, 67, 69, 72, 74, 76, 79, 76, 74, 72, 69, 67];
  const path = estimatePath(phrase, cand, 'auto');
  assert.ok(path.every((p) => p.fret >= 10 && p.fret <= 17), JSON.stringify(path));
});

test('Mehrdeutige Phrase: Vorgabe „Hoch“ bzw. „Tief“ entscheidet', () => {
  const phrase = [52, 55, 57, 60, 62, 64]; // passt tief (Bund 0–5) und hoch (Bund 12–15)
  const high = estimatePath(phrase, cand, 'high');
  assert.ok(high.every((p) => p.fret >= 9), JSON.stringify(high));
  const low = estimatePath(phrase, cand, 'low');
  assert.ok(low.every((p) => p.fret <= 7), JSON.stringify(low));
});

test('Weg bleibt in einer Hand-Lage statt zu springen', () => {
  const phrase = [45, 47, 48, 50, 52, 53];
  const path = estimatePath(phrase, cand, 'mid');
  const frets = path.map((p) => p.fret);
  assert.ok(Math.max(...frets) - Math.min(...frets) <= 5, JSON.stringify(path));
});

test('Saitenwechsel statt weiter Sprünge auf einer Saite (Box-Muster, 5. Lage)', () => {
  // A-Moll-Pentatonik Box 1 aufwärts: jede Saite 2 Töne, Bund 5–8
  const phrase = [45, 48, 50, 52, 55, 57, 60, 62, 64, 67, 69, 72];
  const path = estimatePath(phrase, cand, 'auto');
  assert.ok(path.every((p) => p.fret >= 5 && p.fret <= 8), JSON.stringify(path));
  // nie mehr als 3 Bünde Sprung zwischen zwei Tönen auf derselben Saite
  for (let i = 1; i < path.length; i++) {
    if (path[i].string === path[i - 1].string) assert.ok(Math.abs(path[i].fret - path[i - 1].fret) <= 3, JSON.stringify(path));
  }
});

test('Lauf in hoher Lage: Saitenwechsel statt Rutschen auf der hohen E-Saite', () => {
  // E-Moll-Pentatonik um Bund 12: D-Saite 12/14, G 12/14, H 12/15, E 12/15
  const phrase = [62, 64, 67, 69, 71, 74, 76, 79];
  const path = estimatePath(phrase, cand, 'auto');
  assert.ok(path.every((p) => p.fret >= 11 && p.fret <= 16), JSON.stringify(path));
  assert.ok(new Set(path.map((p) => p.string)).size >= 4, JSON.stringify(path));
});

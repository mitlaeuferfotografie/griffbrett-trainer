import test from 'node:test';
import assert from 'node:assert/strict';
import {
  shapesFor, activeShapes, makeIntervalTask, judgeInterval, computeIntervalUnlocked, intervalUnlockProgress,
  INTERVAL_GROUPS, MAX_STRETCH, parseShapeKey,
} from '../src/lib/intervals.js';
import { newUnit } from '../src/lib/srs.js';
import { getTuning } from '../src/lib/tunings.js';
import { mulberry32 } from '../src/audio/synth.js';

const STD = getTuning('std-6').strings;
const S7 = getTuning('std-7', 7).strings;

test('Formen: Quinte eine Saite höher normal +2 Bünde, über G→H +3 Bünde', () => {
  const fifths = shapesFor(STD).filter((s) => s.semis === 7 && s.offset === 1);
  const normal = fifths.find((s) => s.fretDelta === 2);
  const gh = fifths.find((s) => s.fretDelta === 3);
  assert.deepEqual(normal.rootStrings, [0, 1, 2, 4]); // E→A, A→D, D→G, H→E
  assert.deepEqual(gh.rootStrings, [3]); // G→H
});

test('Formen: Oktave zwei Saiten höher +2 Bünde bzw. +3 über die H-Saite', () => {
  const oct = shapesFor(STD).filter((s) => s.semis === 12 && s.offset === 2);
  assert.deepEqual(oct.map((s) => s.fretDelta).sort(), [2, 3]);
  assert.equal(shapesFor(STD).some((s) => s.semis === 12 && s.offset === 0), false);
});

test('Nur Formen innerhalb einer Hand-Lage', () => {
  for (const s of shapesFor(STD)) assert.ok(Math.abs(s.fretDelta) <= MAX_STRETCH);
  // gleiche Saite: nur bis zur Quarte
  assert.deepEqual([...new Set(shapesFor(STD).filter((s) => s.offset === 0).map((s) => s.semis))].sort((a, b) => a - b), [1, 2, 3, 4]);
});

test('7-Saiter: tiefe H-Saite → E-Saite ist eine Quarte wie E→A', () => {
  const fourth = shapesFor(S7).find((s) => s.semis === 5 && s.offset === 1 && s.fretDelta === 0);
  assert.ok(fourth.rootStrings.includes(0));
});

test('Einführung: erst Oktave und Quinte', () => {
  const a = activeShapes(STD, 1);
  assert.ok(a.length > 0);
  assert.ok(a.every((s) => s.semis === 12 || s.semis === 7));
  assert.equal(activeShapes(STD, INTERVAL_GROUPS.length).length, shapesFor(STD).length);
});

test('Aufgabe: Grund- und Zielton im Bundbereich, Zielton = Grundton + Intervall', () => {
  const rand = mulberry32(4);
  for (const shape of shapesFor(STD)) {
    for (let i = 0; i < 20; i++) {
      const t = makeIntervalTask(STD, shape, 12, rand);
      assert.ok(t, shape.key);
      assert.ok(t.rootFret >= 1 && t.rootFret <= 12);
      assert.ok(t.fret >= 1 && t.fret <= 12);
      assert.equal(t.targetMidi, t.rootMidi + shape.semis);
      assert.equal(STD[t.string] + t.fret, t.targetMidi, 'Zielton liegt auf der Zielsaite');
    }
  }
});

test('Prüfung: exakt der Zielton, Oktave daneben ist falsch', () => {
  const shape = shapesFor(STD).find((s) => s.semis === 7 && s.offset === 1 && s.fretDelta === 2);
  const t = makeIntervalTask(STD, shape, 12, () => 0); // tiefe E-Saite Bund 1 → F, Quinte C auf A-Saite Bund 3
  assert.equal(t.rootMidi, 41);
  assert.equal(t.targetMidi, 48);
  assert.equal(judgeInterval(STD, t, 48).correct, true);
  assert.equal(judgeInterval(STD, t, 60).correct, false);
  assert.equal(judgeInterval(STD, t, 47).playedFret, 2);
  assert.deepEqual(parseShapeKey(t.key), { semis: 7, offset: 1, fretDelta: 2 });
});

test('Freischaltung der Intervall-Gruppen durch Können', () => {
  assert.equal(computeIntervalUnlocked(STD, {}, 1), 1);
  const units = Object.fromEntries(activeShapes(STD, 1).map((s) => [s.key, { ...newUnit(0), n: 3, box: 3 }]));
  assert.equal(computeIntervalUnlocked(STD, units, 1), 2);
  assert.equal(intervalUnlockProgress(STD, {}, 1).next.id, 'i2');
  assert.equal(intervalUnlockProgress(STD, {}, INTERVAL_GROUPS.length), null);
});

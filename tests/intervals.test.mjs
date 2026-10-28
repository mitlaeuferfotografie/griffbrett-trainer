import test from 'node:test';
import assert from 'node:assert/strict';
import {
  shapesFor, activeShapes, shapeInfo, offsetLabel, degreeSemis, makeIntervalTask, judgeInterval, computeIntervalUnlocked, intervalUnlockProgress,
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
  // gleiche Saite aufwärts: nur bis zur großen Terz; abwärts entsprechend 7, ♭7, 6, ♭6 darunter
  assert.deepEqual([...new Set(shapesFor(STD, 'up').filter((s) => s.offset === 0).map((s) => s.semis))].sort((a, b) => a - b), [1, 2, 3, 4]);
  assert.deepEqual([...new Set(shapesFor(STD, 'down').filter((s) => s.offset === 0).map((s) => s.semis))].sort((a, b) => a - b), [-4, -3, -2, -1]);
});

test('7-Saiter: tiefe H-Saite → E-Saite ist eine Quarte wie E→A', () => {
  const fourth = shapesFor(S7).find((s) => s.semis === 5 && s.offset === 1 && s.fretDelta === 0);
  assert.ok(fourth.rootStrings.includes(0));
});

test('Einführung: erst Oktave und Quinte', () => {
  const a = activeShapes(STD, 1);
  assert.ok(a.length > 0);
  assert.ok(a.every((s) => s.deg === 12 || s.deg === 7));
  assert.ok(a.some((s) => s.semis < 0), 'auch abwärts');
  assert.ok(activeShapes(STD, 1, 'up').every((s) => s.semis > 0));
  assert.equal(activeShapes(STD, INTERVAL_GROUPS.length).length, shapesFor(STD).length);
});

test('Aufgabe: Grund- und Zielton im Bundbereich, Zielton = Grundton + Intervall', () => {
  const rand = mulberry32(4);
  for (const shape of shapesFor(STD, 'both')) {
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

test('Abwärts: „5 darunter“ eine Saite tiefer = gleicher Bund (Quarte zwischen den Saiten)', () => {
  const sh = shapesFor(STD, 'down').find((x) => x.semis === -5 && x.offset === -1 && x.fretDelta === 0);
  assert.ok(sh);
  assert.equal(sh.deg, 7);
  assert.deepEqual(sh.rootStrings, [1, 2, 3, 5]); // A→E, D→A, G→D, hohe E→H (H→G ist nur eine große Terz)
  const t = makeIntervalTask(STD, sh, 12, () => 0); // Grundton A-Saite Bund 1 (B), 5 darunter = E (tiefe E-Saite Bund 1)
  assert.equal(t.targetMidi, t.rootMidi - 5);
  assert.equal(t.string, 0);
  assert.equal(STD[t.string] + t.fret, t.targetMidi);
});

test('Abwärts: Oktave darunter zwei Saiten tiefer, ♭7 darunter = Ganzton tiefer', () => {
  assert.ok(shapesFor(STD, 'down').some((x) => x.semis === -12 && x.offset === -2));
  assert.equal(degreeSemis(-2), 10);
  assert.deepEqual(shapeInfo(-2), { degree: '♭7', name: 'kleine Septime', down: true, distance: 'große Sekunde abwärts' });
  assert.equal(shapeInfo(-5).distance, 'Quarte abwärts', 'Stufe 5 darunter = Quarte tiefer');
  assert.equal(shapeInfo(-12).distance, 'Oktave abwärts');
  assert.equal(shapeInfo(7).distance, 'Quinte');
  assert.equal(offsetLabel(-1), 'eine Saite tiefer');
  assert.equal(offsetLabel(2), 'zwei Saiten höher');
});

test('Richtung: Aufwärts-Schlüssel bleiben unverändert (Lernstand gültig)', () => {
  const up = shapesFor(STD, 'up').map((x) => x.key);
  assert.ok(up.includes('7:1:2'));
  assert.ok(up.every((k) => !k.startsWith('-')));
  assert.equal(shapesFor(STD).length, shapesFor(STD, 'up').length + shapesFor(STD, 'down').length);
});

import { spellInterval, nameChoices, intervalNumber } from '../src/lib/intervals.js';
import { spellName } from '../src/lib/scales.js';

const nm = (x) => spellName(x.letter, x.acc);
const sp = (rootMidi, semis, prefer) => {
  const r = spellInterval(rootMidi, semis, prefer);
  return [nm(r.root), nm(r.target)];
};

test('Zielton benennen: Schreibweise über die Intervallnummer', () => {
  assert.deepEqual(sp(48, 4), ['C', 'E']); // große Terz
  assert.deepEqual(sp(48, 3), ['C', 'Es']); // kleine Terz
  assert.deepEqual(sp(51, 4), ['Es', 'G']); // große Terz über Es (nicht Dis–Fisis)
  assert.deepEqual(sp(57, 3), ['A', 'C']); // kleine Terz über A
  assert.deepEqual(sp(48, 6), ['C', 'Ges']); // ♭5 über C
  assert.deepEqual(sp(52, 10), ['E', 'D']); // kleine Septime
  assert.deepEqual(sp(59, 7), ['H', 'Fis']); // Quinte über H
  assert.deepEqual(sp(54, 4), ['Fis', 'Ais']); // Gleichstand → ♯
  assert.deepEqual(sp(54, 4, 'flat'), ['Ges', 'B']);
  assert.deepEqual(sp(48, 12), ['C', 'C']);
  // abwärts: Stufe in der tieferen Oktave
  assert.deepEqual(sp(48, -2), ['C', 'B']); // ♭7 darunter
  assert.deepEqual(sp(55, -5), ['G', 'D']); // 5 darunter
  assert.equal(intervalNumber(-12), 8);
});

test('Zielton benennen: vier verschiedene Antworten, genau eine richtig, naheliegende Fehler', () => {
  const rand = mulberry32(3);
  for (let root = 40; root < 64; root++) {
    for (const semis of [1, 3, 4, 6, 7, 10, -2, -5, 12]) {
      const { target } = spellInterval(root, semis);
      const ch = nameChoices(target, rand);
      assert.equal(ch.length, 4);
      assert.equal(ch.filter((c) => c.correct).length, 1);
      assert.equal(new Set(ch.map(nm)).size, 4);
    }
  }
  // große Terz über C: kleine Terz (Es) ist praktisch immer dabei
  const { target } = spellInterval(48, 4);
  let es = 0;
  for (let i = 0; i < 50; i++) if (nameChoices(target, rand).some((c) => nm(c) === 'Es')) es++;
  assert.ok(es >= 40, String(es));
});

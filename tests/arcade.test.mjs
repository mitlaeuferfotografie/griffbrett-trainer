import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fallMs, spawnGapMs, rateTiming, points, autoStartLevel, buildPool, pickNote, createRun,
  registerHit, registerMiss, registerWrong, HITS_PER_LEVEL, LIVES, MAX_LEVEL,
} from '../src/lib/arcade.js';
import { buildGroups, activePositions } from '../src/lib/curriculum.js';
import { newUnit } from '../src/lib/srs.js';
import { getTuning } from '../src/lib/tunings.js';
import { mulberry32 } from '../src/audio/synth.js';

const STD = getTuning('std-6').strings;

test('Tempo: Stufe 1 = 6 s, wird stetig schneller, Stufe 10 ≈ 1,5 s', () => {
  assert.equal(fallMs(1), 6000);
  for (let l = 2; l <= MAX_LEVEL; l++) assert.ok(fallMs(l) < fallMs(l - 1));
  assert.ok(fallMs(10) > 1300 && fallMs(10) < 1700, String(fallMs(10)));
  assert.ok(spawnGapMs(5) < fallMs(5));
  assert.equal(fallMs(99), fallMs(MAX_LEVEL));
});

test('Timing-Zonen', () => {
  assert.equal(rateTiming(0.3), 'early');
  assert.equal(rateTiming(0.7), 'good');
  assert.equal(rateTiming(0.95), 'perfect');
  assert.equal(rateTiming(1.1), 'perfect');
  assert.equal(rateTiming(1.2), 'miss');
});

test('Punkte steigen mit Stufe, Qualität und Serie', () => {
  assert.equal(points(1, 'good', 0), 100);
  assert.equal(points(1, 'perfect', 0), 150);
  assert.equal(points(3, 'good', 0), 300);
  assert.equal(points(1, 'good', 10), 200);
});

test('Stufe steigt alle 8 Treffer, sinkt nach 2 verpassten in Folge', () => {
  let run = createRun(2);
  for (let i = 0; i < HITS_PER_LEVEL; i++) run = registerHit(run, 'good').run;
  assert.equal(run.level, 3);
  assert.equal(run.maxLevel, 3);
  run = registerMiss(run);
  assert.equal(run.level, 3);
  run = registerMiss(run);
  assert.equal(run.level, 2);
  assert.equal(run.lives, LIVES - 2);
  assert.equal(run.maxLevel, 3);
  assert.equal(run.combo, 0);
});

test('Falscher Ton kostet kein Leben, nur die Serie', () => {
  let run = registerHit(createRun(1), 'perfect').run;
  run = registerWrong(run);
  assert.equal(run.lives, LIVES);
  assert.equal(run.combo, 0);
  assert.equal(run.maxCombo, 1);
});

test('Automatische Startstufe aus Fortschritt und bisheriger Höchststufe', () => {
  const pool = activePositions(buildGroups(STD), STD, 12, { unlocked: 1 });
  assert.equal(autoStartLevel({}, pool, 0), 1);
  const units = Object.fromEntries(pool.map((p) => [p.key, { ...newUnit(0), n: 3, box: 3 }]));
  assert.equal(autoStartLevel(units, pool, 0), 6);
  assert.equal(autoStartLevel({}, pool, 9), 7);
  assert.equal(autoStartLevel({}, pool, 4), 2);
});

test('Tonvorrat und Auswahl', () => {
  const positions = activePositions(buildGroups(STD), STD, 12, { unlocked: 2 });
  assert.equal(buildPool('learned', { strings: STD, fretMax: 12, positions, units: {} }).length, positions.length);
  const units = Object.fromEntries(positions.slice(0, 6).map((p) => [p.key, { ...newUnit(0), n: 1, box: 1 }]));
  assert.equal(buildPool('learned', { strings: STD, fretMax: 12, positions, units }).length, 6);
  const naturals = buildPool('naturals', { strings: STD, fretMax: 24, positions, units });
  assert.equal(naturals.length, 6 * 7);
  const rand = mulberry32(3);
  let last = null;
  for (let i = 0; i < 50; i++) {
    const n = pickNote(naturals, last, rand);
    if (last) assert.notEqual(n.string, last.string);
    assert.equal(n.pc, ((n.midi % 12) + 12) % 12);
    last = n;
  }
});

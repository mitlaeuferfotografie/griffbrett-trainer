import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCALES, getScale, spellScale, spellName, keyName, keySignature, relativeKey, degreeOf, degreeLabel, degreeRole,
} from '../src/lib/scales.js';

const names = (rootPc, id, naming = 'de', prefer) => spellScale(rootPc, getScale(id), prefer).map((n) => spellName(n.letter, n.acc, naming));

test('Dur-Tonleitern richtig geschrieben', () => {
  assert.deepEqual(names(0, 'major'), ['C', 'D', 'E', 'F', 'G', 'A', 'H']);
  assert.deepEqual(names(7, 'major'), ['G', 'A', 'H', 'C', 'D', 'E', 'Fis']);
  assert.deepEqual(names(5, 'major'), ['F', 'G', 'A', 'B', 'C', 'D', 'E']);
  assert.deepEqual(names(3, 'major'), ['Es', 'F', 'G', 'As', 'B', 'C', 'D']);
  assert.deepEqual(names(4, 'major'), ['E', 'Fis', 'Gis', 'A', 'H', 'Cis', 'Dis']);
  assert.deepEqual(names(1, 'major'), ['Des', 'Es', 'F', 'Ges', 'As', 'B', 'C'], 'Des-Dur (5 ♭) statt Cis-Dur (7 ♯)');
  assert.deepEqual(names(7, 'major', 'int'), ['G', 'A', 'B', 'C', 'D', 'E', 'F♯']);
});

test('Moll und Modi', () => {
  assert.deepEqual(names(9, 'minor'), ['A', 'H', 'C', 'D', 'E', 'F', 'G']);
  assert.deepEqual(names(4, 'minor'), ['E', 'Fis', 'G', 'A', 'H', 'C', 'D']);
  assert.deepEqual(names(9, 'harmonic'), ['A', 'H', 'C', 'D', 'E', 'F', 'Gis']);
  assert.deepEqual(names(2, 'dorian'), ['D', 'E', 'F', 'G', 'A', 'H', 'C']);
  assert.deepEqual(names(5, 'lydian'), ['F', 'G', 'A', 'H', 'C', 'D', 'E']);
  assert.equal(degreeLabel(getScale('lydian'), 6), '♯4');
  assert.equal(degreeLabel(getScale('blues'), 6), '♭5');
});

test('Pentatonik und Blues', () => {
  assert.deepEqual(names(9, 'pent-minor'), ['A', 'C', 'D', 'E', 'G']);
  assert.deepEqual(names(9, 'blues'), ['A', 'C', 'D', 'Es', 'E', 'G']);
  assert.deepEqual(names(7, 'pent-major'), ['G', 'A', 'H', 'D', 'E']);
});

test('Schwarze Tasten: weniger Vorzeichen gewinnt', () => {
  assert.deepEqual(names(6, 'minor'), ['Fis', 'Gis', 'A', 'H', 'Cis', 'D', 'E'], 'fis-Moll (3 ♯) statt ges-Moll');
  assert.deepEqual(names(10, 'major'), ['B', 'C', 'D', 'Es', 'F', 'G', 'A']);
  assert.deepEqual(names(8, 'minor'), ['Gis', 'Ais', 'H', 'Cis', 'Dis', 'E', 'Fis'], 'gis-Moll (5 ♯) statt as-Moll (7 ♭)');
  // Gleichstand Fis-Dur / Ges-Dur → Vorliebe
  assert.equal(names(6, 'major', 'de', 'sharp')[0], 'Fis');
  assert.equal(names(6, 'major', 'de', 'flat')[0], 'Ges');
});

test('Notennamen deutsch: Sonderfälle', () => {
  assert.equal(spellName(6, -1), 'B');
  assert.equal(spellName(6, 0), 'H');
  assert.equal(spellName(2, -1), 'Es');
  assert.equal(spellName(5, -1), 'As');
  assert.equal(spellName(1, -1), 'Des');
  assert.equal(spellName(3, 1), 'Fis');
  assert.equal(spellName(2, -2), 'Eses');
  assert.equal(spellName(6, -1, 'int'), 'B♭');
});

test('Tonartnamen, Vorzeichen, Paralleltonart', () => {
  assert.equal(keyName(7, getScale('major')), 'G-Dur');
  assert.equal(keyName(4, getScale('minor')), 'e-Moll');
  assert.equal(keyName(2, getScale('dorian')), 'D Dorisch');
  assert.equal(keyName(9, getScale('pent-minor')), 'A Moll-Pentatonik');
  assert.deepEqual(keySignature(2, getScale('major')), { count: 2, type: '♯', notes: ['Fis', 'Cis'] });
  assert.deepEqual(keySignature(3, getScale('major')), { count: 3, type: '♭', notes: ['B', 'Es', 'As'] });
  assert.deepEqual(keySignature(9, getScale('minor')), { count: 0, type: '', notes: [] });
  assert.equal(keySignature(9, getScale('pent-minor')), null);
  assert.deepEqual(relativeKey(7, getScale('major')), { rootPc: 4, scaleId: 'minor' });
  assert.deepEqual(relativeKey(9, getScale('minor')), { rootPc: 0, scaleId: 'major' });
});

test('Stufen auf dem Griffbrett', () => {
  const g = getScale('major');
  assert.equal(degreeOf(7, g, 55), 0); // G
  assert.equal(degreeOf(7, g, 66), 11); // Fis
  assert.equal(degreeOf(7, g, 65), null); // F gehört nicht zu G-Dur
  assert.equal(degreeRole(0), 'root');
  assert.equal(degreeRole(3), 'third');
  assert.equal(degreeRole(7), 'fifth');
  assert.equal(degreeRole(10), 'other');
  for (const s of SCALES) assert.equal(s.steps[0], 0);
});

import { findKeys } from '../src/lib/scales.js';

test('Tonart-Finder: C-E-G mit C im Bass → C-Dur zuerst', () => {
  const r = findKeys([0, 4, 7], 0);
  assert.equal(r[0].rootPc, 0);
  assert.equal(r[0].scale.id, 'major');
  assert.ok(r.every((x) => x.missing.length === 0));
});

test('Tonart-Finder: A C D E G mit A im Bass → a-Moll-Pentatonik zuerst, a-Moll dabei', () => {
  const r = findKeys([9, 0, 2, 4, 7], 9);
  assert.equal(r[0].scale.id, 'pent-minor');
  assert.equal(r[0].rootPc, 9);
  assert.ok(r.some((x) => x.scale.id === 'minor' && x.rootPc === 9));
  assert.ok(r.some((x) => x.scale.id === 'major' && x.rootPc === 0));
});

test('Tonart-Finder: Fis im Spiel macht G-Dur/e-Moll wahrscheinlicher als C-Dur', () => {
  const r = findKeys([7, 11, 2, 6], 7); // G H D Fis
  assert.equal(r[0].rootPc, 7);
  assert.ok(!r.some((x) => x.scale.id === 'major' && x.rootPc === 0 && !x.missing.length));
});

test('Tonart-Finder: keine vollständige Tonart → Teiltreffer mit genau einem fehlenden Ton', () => {
  const r = findKeys([0, 1, 2, 3, 4], 0); // chromatisch, passt in keine Skala
  assert.ok(r.length > 0);
  assert.ok(r.every((x) => x.missing.length === 1));
  assert.deepEqual(findKeys([], null), []);
});

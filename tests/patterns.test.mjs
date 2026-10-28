import test from 'node:test';
import assert from 'node:assert/strict';
import { npsPattern, patternSequence, patternRange } from '../src/lib/patterns.js';
import { getScale } from '../src/lib/scales.js';
import { getTuning } from '../src/lib/tunings.js';

const STD = getTuning('std-6').strings;
const S7 = getTuning('std-7', 7).strings;
const frets = (p, s) => p.notes.filter((n) => n.string === s).map((n) => n.fret);

test('3NPS: e-Moll Muster 1 ab der Leersaite', () => {
  const p = npsPattern(STD, 4, getScale('minor'), 3, 0);
  assert.equal(p.notes.length, 18);
  assert.deepEqual(frets(p, 0), [0, 2, 3]); // E Fis G
  assert.deepEqual(frets(p, 1), [0, 2, 3]); // A H C
  assert.deepEqual(frets(p, 2), [0, 2, 4]); // D E Fis
  assert.deepEqual(frets(p, 3), [0, 2, 4]); // G A H
  assert.deepEqual(frets(p, 4), [1, 3, 5]); // C D E
  assert.deepEqual(frets(p, 5), [2, 3, 5]); // Fis G A
});

test('3NPS: A-Moll (Äolisch) Muster 1 ab Bund 5, klassisches 3NPS', () => {
  const p = npsPattern(STD, 9, getScale('minor'), 3, 0);
  assert.deepEqual(frets(p, 0), [5, 7, 8]);
  assert.deepEqual(frets(p, 1), [5, 7, 8]);
  assert.deepEqual(frets(p, 2), [5, 7, 9]);
  assert.deepEqual(frets(p, 3), [5, 7, 9]);
  assert.deepEqual(frets(p, 4), [6, 8, 10]);
  assert.deepEqual(frets(p, 5), [7, 8, 10]);
  assert.deepEqual(patternRange(p), { from: 5, to: 10 });
});

test('3NPS: jede Saite 3 Töne, alle Töne der Tonleiter, streng aufsteigend', () => {
  const scale = getScale('major');
  for (let pos = 0; pos < 7; pos++) {
    const p = npsPattern(STD, 7, scale, 3, pos);
    assert.equal(p.notes.length, 18);
    for (let i = 1; i < p.notes.length; i++) assert.ok(p.notes[i].midi > p.notes[i - 1].midi);
    assert.ok(p.notes.every((n) => n.fret >= 0 && n.semis != null));
    assert.equal(p.notes[0].semis, scale.steps[pos]);
  }
});

test('2NPS: a-Moll-Pentatonik Muster 1 = Box 1 (Bund 5–8)', () => {
  const p = npsPattern(STD, 9, getScale('pent-minor'), 2, 0);
  assert.equal(p.notes.length, 12);
  assert.deepEqual(frets(p, 0), [5, 8]);
  assert.deepEqual(frets(p, 1), [5, 7]);
  assert.deepEqual(frets(p, 2), [5, 7]);
  assert.deepEqual(frets(p, 3), [5, 7]);
  assert.deepEqual(frets(p, 4), [5, 8]);
  assert.deepEqual(frets(p, 5), [5, 8]);
});

test('7-Saiter: 21 Töne bei 3NPS', () => {
  const p = npsPattern(S7, 11, getScale('minor'), 3, 0);
  assert.equal(p.notes.length, 21);
  assert.equal(p.notes[0].string, 0);
});

test('Übungsfolge: hoch und wieder runter, oberster Ton einmal', () => {
  const p = npsPattern(STD, 9, getScale('pent-minor'), 2, 0);
  const seq = patternSequence(p);
  assert.equal(seq.length, 12 + 11);
  assert.equal(seq[11].midi, Math.max(...p.notes.map((n) => n.midi)));
  assert.equal(seq[seq.length - 1].midi, p.notes[0].midi);
});

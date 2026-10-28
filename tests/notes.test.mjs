import test from 'node:test';
import assert from 'node:assert/strict';
import { noteName, pcName, nearestNote, midiToFreq, octaveOf } from '../src/lib/notes.js';
import { TUNINGS, getTuning, tuningsFor, tuningNotes } from '../src/lib/tunings.js';
import { positionsForMidi, fretsForPitchClass, fretOnString, stringName } from '../src/lib/fretboard.js';

test('Tonnamen deutsch / international', () => {
  assert.equal(pcName(11, { naming: 'de' }), 'H');
  assert.equal(pcName(10, { naming: 'de', accidentals: 'flat' }), 'B');
  assert.equal(pcName(10, { naming: 'int', accidentals: 'flat' }), 'B♭');
  assert.equal(pcName(11, { naming: 'int' }), 'B');
  assert.equal(pcName(6, { naming: 'de', accidentals: 'both' }), 'Fis/Ges');
  assert.equal(pcName(3, { naming: 'de', accidentals: 'flat' }), 'Es');
  assert.equal(pcName(8, { naming: 'de', accidentals: 'flat' }), 'As');
  assert.equal(pcName(4, { accidentals: 'both' }), 'E');
  assert.equal(noteName(69, {}, { octave: true }), 'A4');
  assert.equal(octaveOf(40), 2);
});

test('Frequenz, Cent und Referenzton', () => {
  assert.ok(Math.abs(midiToFreq(33) - 55) < 1e-9);
  assert.ok(Math.abs(midiToFreq(35) - 61.735) < 0.01);
  const n = nearestNote(441);
  assert.equal(n.midi, 69);
  assert.ok(Math.abs(n.cents - 3.93) < 0.01);
  assert.ok(Math.abs(nearestNote(442, 442).cents) < 1e-9);
});

test('Stimmungen: Standard ist Vorgabe, 6 und 7 Saiten getrennt', () => {
  assert.equal(getTuning('gibt-es-nicht', 6).id, 'std-6');
  assert.equal(getTuning('std-6', 7).id, 'std-7');
  assert.ok(tuningsFor(6).every((t) => t.strings.length === 6));
  assert.ok(tuningsFor(7).every((t) => t.strings.length === 7));
  assert.equal(tuningNotes(getTuning('std-6'), {}), 'E-A-D-G-H-E');
  assert.equal(tuningNotes(getTuning('std-7', 7), {}), 'H-E-A-D-G-H-E');
  for (const t of TUNINGS) for (let i = 1; i < t.strings.length; i++) assert.ok(t.strings[i] > t.strings[i - 1]);
});

test('Griffbrett: Positionen und Prüfung „Ton auf dieser Saite“', () => {
  const std = getTuning('std-6').strings;
  // F auf der A-Saite = Bund 8
  assert.equal(fretOnString(std, 1, 53), 8);
  // F eine Oktave höher liegt nicht im Bereich 0–12 der A-Saite
  assert.equal(fretOnString(std, 1, 65), null);
  assert.equal(fretOnString(std, 1, 65, 24), 20);
  // E auf A-Saite: Bund 7 (und 19 bei 24 Bünden)
  assert.deepEqual(fretsForPitchClass(std, 1, 4, 12), [7]);
  assert.deepEqual(fretsForPitchClass(std, 1, 4, 24), [7, 19]);
  // E auf tiefer E-Saite: 0 und 12
  assert.deepEqual(fretsForPitchClass(std, 0, 4, 12), [0, 12]);
  // c' (MIDI 60) bis Bund 12
  assert.deepEqual(positionsForMidi(std, 60), [
    { string: 2, fret: 10 },
    { string: 3, fret: 5 },
    { string: 4, fret: 1 },
  ]);
});

test('Saitennamen', () => {
  const std = getTuning('std-6').strings;
  assert.equal(stringName(std, 0, {}), 'tiefe E-Saite');
  assert.equal(stringName(std, 5, {}), 'hohe E-Saite');
  assert.equal(stringName(std, 4, {}), 'H-Saite');
  const s7 = getTuning('std-7', 7).strings;
  assert.equal(stringName(s7, 0, {}), 'tiefe H-Saite');
  assert.equal(stringName(s7, 5, {}), 'H-Saite');
  assert.equal(stringName(s7, 1, {}), 'tiefe E-Saite');
  assert.equal(stringName(std, 4, { naming: 'int' }), 'B-Saite');
  assert.equal(stringName(std, 0, {}, { dative: true }), 'tiefen E-Saite');
  assert.equal(stringName(std, 5, {}, { dative: true }), 'hohen E-Saite');
  assert.equal(stringName(std, 1, {}, { dative: true }), 'A-Saite');
});

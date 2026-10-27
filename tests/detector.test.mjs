import test from 'node:test';
import assert from 'node:assert/strict';
import { createNoteTracker } from '../src/audio/detector.js';
import { createPitchDetector } from '../src/audio/pitch.js';
import { WAVEFORMS, synthesize, noise } from '../src/audio/synth.js';
import { midiToFreq } from '../src/lib/notes.js';

const loud = 0.1; // ≈ −20 dB
const frame = (time, midi, rms = loud, clarity = 0.95) => ({
  time,
  freq: midi == null ? null : midiToFreq(midi),
  clarity,
  rms,
});

test('Ton wird erst nach dem Stabilitätsfenster gemeldet, und nur einmal', () => {
  const tr = createNoteTracker({ stableFrames: 4 });
  const events = [];
  for (let i = 0; i < 20; i++) {
    const r = tr.update(frame(i * 16, 52.1));
    if (r.event) events.push({ i, ...r.event });
  }
  assert.equal(events.length, 1);
  assert.equal(events[0].i, 3);
  assert.equal(events[0].midi, 52);
});

test('Leise Frames (unter der Pegelschwelle) zählen nicht', () => {
  const tr = createNoteTracker({ minDb: -50 });
  for (let i = 0; i < 20; i++) assert.equal(tr.update(frame(i * 16, 52, 0.001)).event, null);
});

test('Einzelne Oktavausreißer unterbrechen den Ton nicht', () => {
  const tr = createNoteTracker();
  const events = [];
  const seq = [40, 40, 40, 40, 52, 40, 40, 28, 40, 40];
  seq.forEach((m, i) => {
    const r = tr.update(frame(i * 16, m));
    if (r.event) events.push(r.event.midi);
  });
  assert.deepEqual(events, [40]);
});

test('Tonwechsel erzeugt ein neues Ereignis', () => {
  const tr = createNoteTracker();
  const events = [];
  [...Array(8).fill(45), ...Array(8).fill(47)].forEach((m, i) => {
    const r = tr.update(frame(i * 16, m));
    if (r.event) events.push(r.event.midi);
  });
  assert.deepEqual(events, [45, 47]);
});

test('Erneuter Anschlag desselben Tons wird wieder gemeldet', () => {
  const tr = createNoteTracker();
  const events = [];
  let t = 0;
  const push = (m, rms) => {
    const r = tr.update(frame((t += 16), m, rms));
    if (r.event) events.push(r.event.midi);
  };
  for (let i = 0; i < 10; i++) push(50, 0.1);
  for (let i = 0; i < 10; i++) push(50, 0.02); // abgeklungen
  for (let i = 0; i < 10; i++) push(50, 0.2); // neuer Anschlag
  assert.deepEqual(events, [50, 50]);
});

test('Nach Stille wird der Ton freigegeben', () => {
  const tr = createNoteTracker({ releaseFrames: 5 });
  for (let i = 0; i < 8; i++) tr.update(frame(i * 16, 45));
  for (let i = 8; i < 14; i++) tr.update(frame(i * 16, null, 0));
  assert.equal(tr.update(frame(300, null, 0)).stable, null);
});

// Durchlauf wie im Browser: Audiostrom in überlappenden 4096er-Fenstern
function streamEvents(notes, { sampleRate = 48000, hop = 800, gapSec = 0.15, noteSec = 0.7 } = {}) {
  const wave = WAVEFORMS.find((w) => w.id === 'gitarre');
  const parts = [];
  notes.forEach((m, i) => {
    parts.push(noise(Math.round(gapSec * sampleRate), 0.0005, i + 1));
    parts.push(synthesize(wave, midiToFreq(m), { sampleRate, length: Math.round(noteSec * sampleRate), seed: i + 3, startTime: 0 }));
  });
  const total = parts.reduce((s, p) => s + p.length, 0);
  const audio = new Float32Array(total);
  let off = 0;
  for (const p of parts) {
    audio.set(p, off);
    off += p.length;
  }
  const det = createPitchDetector({ sampleRate });
  const tr = createNoteTracker();
  const events = [];
  for (let end = 4096; end <= total; end += hop) {
    const r = det.detect(audio.subarray(end - 4096, end));
    const u = tr.update({ time: (end / sampleRate) * 1000, ...r });
    if (u.event) events.push(u.event.midi);
  }
  return events;
}

test('Audiostrom: Tonfolge inkl. tiefer H-Saite und Wiederholung wird korrekt erkannt', () => {
  const seq = [35, 40, 45, 45, 53, 76];
  assert.deepEqual(streamEvents(seq), seq);
});

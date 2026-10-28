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

test('Standard-Schwelle −75 dB: leiser Ton (−70 dB) wird erkannt, Rauschen ohne klare Tonhöhe nicht', () => {
  const tr = createNoteTracker();
  const events = [];
  for (let i = 0; i < 10; i++) {
    const r = tr.update(frame(i * 16, 45, 0.0003));
    if (r.event) events.push(r.event.midi);
  }
  assert.deepEqual(events, [45]);
  const tr2 = createNoteTracker();
  for (let i = 0; i < 10; i++) assert.equal(tr2.update(frame(i * 16, 45, 0.0003, 0.5)).event, null);
});

import { TRACKER_FAST } from '../src/audio/detector.js';
import { pluckTone, roomNoise } from '../src/audio/synth.js';

function streamProfile(parts, profile, bufferSize, sampleRate = 48000) {
  const total = parts.reduce((a, p) => a + p.length, 0);
  const audio = new Float32Array(total);
  let off = 0;
  for (const p of parts) {
    audio.set(p, off);
    off += p.length;
  }
  const det = createPitchDetector({ sampleRate, bufferSize });
  const tr = createNoteTracker({ minDb: -75, ...profile });
  const events = [];
  for (let end = 4096; end <= total; end += 800) {
    const u = tr.update({ time: (end / sampleRate) * 1000, ...det.detect(audio.subarray(end - bufferSize, end)) });
    if (u.event) events.push(u.event.midi);
  }
  return events;
}

test('Schneller Modus: realistischer verzerrter Anschlag wird nicht doppelt gemeldet', () => {
  const seq = [45, 48, 50, 52, 55, 57, 55, 52];
  const parts = [roomNoise(1500)];
  seq.forEach((m, i) => parts.push(pluckTone(m, 300, { drive: 8, seed: i + 1 })));
  parts.push(roomNoise(1500));
  assert.deepEqual(streamProfile(parts, TRACKER_FAST, 2048), seq);
});

test('Hintergrundgeräusche (Brummen, Störton) erzeugen keine Töne – normal und schnell', () => {
  const parts = [roomNoise(4000, { seed: 3 })];
  assert.deepEqual(streamProfile(parts, {}, 4096), []);
  assert.deepEqual(streamProfile(parts, TRACKER_FAST, 2048), []);
});

import { TRACKER_ANSWER } from '../src/audio/detector.js';
import { synthesize as synth2, WAVEFORMS as W2 } from '../src/audio/synth.js';

test('Antwort-Profil: mitschwingende Leersaite (25 dB leiser) löst keinen Ton aus', () => {
  const sampleRate = 48000;
  const played = pluckTone(57, 600, { drive: 8, seed: 2 }); // A angeschlagen
  // danach klingt nur noch die tiefe E-Saite leise mit (≈ 25 dB unter dem Anschlag)
  const reso = synth2(W2.find((w) => w.id === 'gitarre'), 82.41, { sampleRate, length: Math.round(1.5 * sampleRate), startTime: 0 });
  const quiet = reso.map((x) => x * 0.03);
  const parts = [roomNoise(1000), played, quiet, roomNoise(500)];
  const ev = streamProfile(parts, TRACKER_ANSWER, 4096);
  assert.deepEqual(ev, [57]);
  // ohne das Profil würde die mitschwingende Saite als Ton gemeldet
  assert.ok(streamProfile(parts, {}, 4096).includes(40));
});

test('Antwort-Profil: normal gespielte Tonfolge wird vollständig erkannt', () => {
  const seq = [45, 48, 50, 52, 55, 57];
  const parts = [roomNoise(1000)];
  seq.forEach((m, i) => parts.push(pluckTone(m, 350, { drive: i % 2 ? 8 : 0, seed: i + 4 })));
  parts.push(roomNoise(800));
  assert.deepEqual(streamProfile(parts, TRACKER_ANSWER, 4096), seq);
});

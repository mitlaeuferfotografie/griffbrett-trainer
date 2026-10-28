import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnswerGate, WRONG_HOLD_MS } from '../src/audio/answer.js';
import { createNoteTracker, TRACKER_FAST } from '../src/audio/detector.js';
import { createPitchDetector } from '../src/audio/pitch.js';
import { WAVEFORMS, synthesize, noise } from '../src/audio/synth.js';
import { midiToFreq } from '../src/lib/notes.js';

// Frames wie im Browser: Tonhöhenfolge [midi, Dauer in ms] → Messungen alle 16 ms
function frames(seq) {
  const out = [];
  let t = 0;
  for (const [midi, ms] of seq) {
    for (let x = 0; x < ms; x += 16) {
      out.push({ time: t, freq: midi == null ? null : midiToFreq(midi), clarity: 0.95, rms: 0.1 });
      t += 16;
    }
  }
  return out;
}

function runGate(seq, target) {
  const tr = createNoteTracker();
  const gate = createAnswerGate();
  for (const f of frames(seq)) {
    const r = gate.update(tr.update(f), f.time, (m) => m === target);
    if (r) return r;
  }
  return null;
}

test('Slide durch mehrere Töne auf den richtigen Ton: richtig, kein Fehler', () => {
  // Slide von 50 nach 55 (je 80 ms pro Halbton), dann auf 55 halten
  const r = runGate([[50, 80], [51, 80], [52, 80], [53, 80], [54, 80], [55, 400]], 55);
  assert.deepEqual(r, { midi: 55, correct: true });
});

test('Stufenloser Slide (wie mit dem Finger auf der Saite) auf den richtigen Ton', () => {
  const tr = createNoteTracker();
  const gate = createAnswerGate();
  const out = [];
  let time = 0;
  const push = (m) => {
    const r = gate.update(tr.update({ time, freq: midiToFreq(m), clarity: 0.95, rms: 0.1 }), time, (x) => x === 55);
    if (r) out.push(r);
    time += 16;
  };
  for (let i = 0; i < 12; i++) push(50); // Startton kurz angeschlagen
  for (let i = 0; i <= 28; i++) push(50 + (5 * i) / 28); // 450 ms stufenlos nach oben
  for (let i = 0; i < 25; i++) push(55); // Ziel halten
  assert.deepEqual(out, [{ midi: 55, correct: true }]);
});

test('Kurzes Rutschgeräusch wird nicht als falsch gewertet', () => {
  const r = runGate([[48, 150], [null, 100], [55, 300]], 55);
  assert.deepEqual(r, { midi: 55, correct: true });
});

test('Falscher Ton zählt, wenn er gehalten wird', () => {
  const r = runGate([[53, WRONG_HOLD_MS + 300]], 55);
  assert.equal(r.correct, false);
  assert.equal(r.midi, 53);
});

test('Schnelles Profil: verzerrte Sechzehntel-Läufe (~110 ms pro Ton) werden vollständig erkannt', () => {
  const sampleRate = 48000;
  const wave = WAVEFORMS.find((w) => w.id === 'verzerrt');
  // A-Moll-Lauf über zwei Oktaven, tiefe bis mittlere Lage
  const seq = [45, 47, 48, 50, 52, 53, 55, 57, 59, 60, 62, 64, 62, 60, 59, 57, 55, 53, 52, 50, 48, 47, 45];
  const noteLen = Math.round(0.11 * sampleRate);
  const parts = [noise(4096, 0.0005, 3)];
  seq.forEach((m, i) => parts.push(synthesize(wave, midiToFreq(m), { sampleRate, length: noteLen, seed: i + 5, startTime: 0 })));
  const total = parts.reduce((a, p) => a + p.length, 0);
  const audio = new Float32Array(total);
  let off = 0;
  for (const p of parts) {
    audio.set(p, off);
    off += p.length;
  }
  const det = createPitchDetector({ sampleRate, bufferSize: 2048 });
  const tr = createNoteTracker(TRACKER_FAST);
  const events = [];
  for (let end = 2048; end <= total; end += 800) {
    const r = det.detect(audio.subarray(end - 2048, end));
    const u = tr.update({ time: (end / sampleRate) * 1000, ...r });
    if (u.event) events.push(u.event.midi);
  }
  assert.deepEqual(events, seq);
});

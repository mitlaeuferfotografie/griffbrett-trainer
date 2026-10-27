// Selbsttest der Tonerkennung mit synthetischen Signalen.
// Wird von den Node-Tests (tests/pitch.test.mjs) und der Diagnose-Ansicht genutzt.
import { createPitchDetector } from './pitch.js';
import { WAVEFORMS, synthesize } from './synth.js';
import { freqToMidi, midiToFreq } from '../lib/notes.js';

export const LOWEST_MIDI = 33; // A1 = 55 Hz (Drop A)
export const HIGHEST_MIDI = 88; // E6 ≈ 1318,5 Hz (hohe E-Saite, Bund 24)

/** Toleranz in Cent je Wellenform */
export const TOLERANCE = { rauschen: 8 };
const DEFAULT_TOLERANCE = 5;

export function runPitchSelfTest({ sampleRate = 48000, bufferSize = 4096, waveforms = WAVEFORMS } = {}) {
  const detector = createPitchDetector({ sampleRate, bufferSize });
  const results = [];
  let totalMs = 0;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  for (const wave of waveforms) {
    for (let midi = LOWEST_MIDI; midi <= HIGHEST_MIDI; midi++) {
      // leicht verstimmt (deterministisch −20 … +20 Cent), damit nicht nur glatte Werte geprüft werden
      const detune = ((midi * 37) % 41) - 20;
      const freq = midiToFreq(midi + detune / 100);
      const signal = synthesize(wave, freq, { sampleRate, length: bufferSize, seed: midi * 13 + 1 });
      const t0 = now();
      const r = detector.detect(signal);
      totalMs += now() - t0;
      const tol = TOLERANCE[wave.id] ?? DEFAULT_TOLERANCE;
      const cents = r.freq ? (freqToMidi(r.freq) - freqToMidi(freq)) * 100 : null;
      results.push({
        wave: wave.id,
        midi,
        freq,
        detected: r.freq,
        clarity: r.clarity,
        cents,
        ok: cents !== null && Math.abs(cents) <= tol,
      });
    }
  }
  const ok = results.filter((r) => r.ok).length;
  const maxCents = Math.max(...results.filter((r) => r.cents !== null).map((r) => Math.abs(r.cents)));
  return { sampleRate, bufferSize, results, ok, total: results.length, maxCents, msPerFrame: totalMs / results.length };
}

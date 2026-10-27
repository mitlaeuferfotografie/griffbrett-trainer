import test from 'node:test';
import assert from 'node:assert/strict';
import { createPitchDetector } from '../src/audio/pitch.js';
import { runPitchSelfTest, LOWEST_MIDI, HIGHEST_MIDI } from '../src/audio/selftest.js';
import { WAVEFORMS, synthesize, noise } from '../src/audio/synth.js';
import { midiToFreq, freqToMidi } from '../src/lib/notes.js';
import { TUNINGS } from '../src/lib/tunings.js';

for (const sampleRate of [44100, 48000]) {
  test(`Selbsttest 55–1320 Hz, alle Wellenformen, ${sampleRate} Hz`, () => {
    const r = runPitchSelfTest({ sampleRate });
    const fails = r.results.filter((x) => !x.ok).map((x) => `${x.wave} midi ${x.midi}: ${x.cents?.toFixed(1)} ct`);
    assert.equal(fails.length, 0, fails.slice(0, 15).join('\n'));
    assert.equal(r.total, WAVEFORMS.length * (HIGHEST_MIDI - LOWEST_MIDI + 1));
  });
}

test('Bereich deckt Drop A (55 Hz) bis hohe E-Saite Bund 24 ab', () => {
  assert.ok(midiToFreq(LOWEST_MIDI) <= 55.01);
  assert.ok(midiToFreq(HIGHEST_MIDI) >= 1318);
});

test('Alle Leersaiten aller Stimmungen, exakt gestimmt (< 2 Cent)', () => {
  const det = createPitchDetector({ sampleRate: 48000 });
  const wave = WAVEFORMS.find((w) => w.id === 'gitarre');
  for (const t of TUNINGS) {
    for (const m of t.strings) {
      const f = midiToFreq(m);
      const r = det.detect(synthesize(wave, f, { sampleRate: 48000, length: 4096 }));
      const cents = (freqToMidi(r.freq) - m) * 100;
      assert.ok(Math.abs(cents) < 2, `${t.id} Saite ${m}: ${cents.toFixed(2)} ct`);
    }
  }
});

test('Referenzton 435–445 Hz: Abweichung korrekt gegen eigenes a′', () => {
  const det = createPitchDetector({ sampleRate: 48000 });
  for (const a4 of [435, 440, 445]) {
    const f = midiToFreq(45, a4); // A-Saite
    const r = det.detect(synthesize(WAVEFORMS[0], f, { sampleRate: 48000, length: 4096 }));
    assert.ok(Math.abs((freqToMidi(r.freq, a4) - 45) * 100) < 1, `a′=${a4}`);
  }
});

test('Stille liefert keinen Ton', () => {
  const det = createPitchDetector({ sampleRate: 48000 });
  assert.equal(det.detect(new Float32Array(4096)).freq, null);
});

test('Weißes Rauschen liefert keinen Ton oder nur geringe Klarheit', () => {
  const det = createPitchDetector({ sampleRate: 48000 });
  for (let seed = 1; seed <= 20; seed++) {
    const r = det.detect(noise(4096, 0.1, seed));
    assert.ok(r.freq === null || r.clarity < 0.8, `seed ${seed}: ${r.freq} Hz, Klarheit ${r.clarity}`);
  }
});

test('Längerer Puffer: es werden die letzten Samples ausgewertet', () => {
  const det = createPitchDetector({ sampleRate: 48000 });
  const sig = synthesize(WAVEFORMS[0], 220, { sampleRate: 48000, length: 6000 });
  assert.ok(Math.abs(det.detect(sig).freq - 220) < 0.2);
});

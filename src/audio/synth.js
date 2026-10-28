// Synthetische Testsignale für die Tonerkennung (Node-Tests und Selbsttest in der App).

// Kleiner deterministischer Zufallsgenerator, damit Tests reproduzierbar sind.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GUITAR = [1, 0.8, 0.6, 0.45, 0.35, 0.25, 0.18, 0.12];

export const WAVEFORMS = [
  { id: 'sinus', label: 'Sinus', partials: [1] },
  { id: 'saege', label: 'Sägezahn', saw: true },
  { id: 'gitarre', label: 'Obertöne, abklingend', partials: GUITAR, decay: 0.6, inharmonicity: 1e-4 },
  { id: 'schwach', label: 'Schwacher Grundton', partials: [0.15, 1, 0.3, 0.6, 0.3, 0.2, 0.1], decay: 0.6, inharmonicity: 1e-4 },
  { id: 'oktav', label: 'Grundton fast weg (Oktavfalle)', partials: [0.08, 1, 0.08, 0.5, 0.05, 0.3], decay: 0.6, inharmonicity: 1e-4 },
  { id: 'rauschen', label: 'Obertöne + Rauschen (20 dB)', partials: GUITAR, decay: 0.6, inharmonicity: 1e-4, snrDb: 20 },
  { id: 'verzerrt', label: 'Verzerrt (übersteuerter Amp)', partials: GUITAR, decay: 0.6, inharmonicity: 1e-4, drive: 12, snrDb: 30 },
];

/**
 * Erzeugt `length` Samples eines Tons mit Frequenz `freq`.
 * Teiltöne über 90 % der Nyquist-Frequenz entfallen (keine Aliasing-Artefakte).
 */
export function synthesize(wave, freq, { sampleRate, length, seed = 1, startTime = 0.05 }) {
  const rand = mulberry32(seed);
  const out = new Float32Array(length);
  const nyq = sampleRate * 0.45;
  const partials = wave.saw
    ? Array.from({ length: Math.floor(nyq / freq) }, (_, i) => 1 / (i + 1))
    : wave.partials;
  const B = wave.inharmonicity || 0;
  partials.forEach((amp, i) => {
    const k = i + 1;
    const f = k * freq * Math.sqrt(1 + B * k * k);
    if (f >= nyq || amp === 0) return;
    const phase = rand() * 2 * Math.PI;
    const tauK = wave.decay ? wave.decay / k : 0;
    const w = (2 * Math.PI * f) / sampleRate;
    for (let n = 0; n < length; n++) {
      const t = startTime + n / sampleRate;
      const env = tauK ? Math.exp(-t / tauK) : 1;
      out[n] += amp * env * Math.sin(w * n + phase);
    }
  });
  let peak = 0;
  for (let n = 0; n < length; n++) peak = Math.max(peak, Math.abs(out[n]));
  const gain = peak > 0 ? 0.5 / peak : 0;
  let sum = 0;
  const drive = wave.drive || 0;
  const norm = drive ? Math.tanh(drive) : 1;
  for (let n = 0; n < length; n++) {
    out[n] *= gain;
    // Übersteuerung wie bei einem verzerrten Amp (weiche Begrenzung)
    if (drive) out[n] = (0.5 * Math.tanh(drive * 2 * out[n])) / norm;
    sum += out[n] * out[n];
  }
  if (wave.snrDb != null) {
    const sigRms = Math.sqrt(sum / length);
    const noiseRms = sigRms / Math.pow(10, wave.snrDb / 20);
    for (let n = 0; n < length; n++) out[n] += noiseRms * gaussian(rand);
  }
  return out;
}

export function noise(length, level, seed = 7) {
  const rand = mulberry32(seed);
  const out = new Float32Array(length);
  for (let n = 0; n < length; n++) out[n] = level * gaussian(rand);
  return out;
}

function gaussian(rand) {
  const u = Math.max(rand(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/**
 * Realistischer Anschlag: Geräuschimpuls (15 ms), Tonhöhe startet +25 Cent und pendelt ein,
 * Pegelspitze beim Anschlag, Abklingen; optional verzerrt (drive). Für Tests der Notenverfolgung.
 */
export function pluckTone(midi, ms, { sampleRate = 48000, drive = 0, seed = 1 } = {}) {
  const rand = mulberry32(seed);
  const n = Math.round((ms / 1000) * sampleRate);
  const out = new Float32Array(n);
  const f0 = 440 * Math.pow(2, (midi - 69) / 12);
  const amps = [1, 0.7, 0.5, 0.35, 0.25, 0.15];
  const ph = amps.map(() => 0);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const f = f0 * Math.pow(2, (25 * Math.exp(-t / 0.02)) / 1200);
    let x = 0;
    amps.forEach((a, k) => {
      ph[k] += (2 * Math.PI * f * (k + 1)) / sampleRate;
      x += a * Math.exp(-t * (k + 1) * 1.5) * Math.sin(ph[k]);
    });
    const env = Math.min(1, t / 0.004) * (1 + 0.8 * Math.exp(-t / 0.03)) * Math.exp(-t / 1.2);
    let v = 0.15 * env * x + (t < 0.015 ? 0.15 * gaussian(rand) * (1 - t / 0.015) : 0);
    if (drive) v = (Math.tanh(drive * v) / Math.tanh(drive)) * 0.5;
    out[i] = v + 0.002 * gaussian(rand);
  }
  return out;
}

/** Raumklang ohne Spiel: Rauschen, Netzbrummen (100 Hz) und ein zeitweiser tonaler Störton. */
export function roomNoise(ms, { sampleRate = 48000, seed = 9 } = {}) {
  const rand = mulberry32(seed);
  const n = Math.round((ms / 1000) * sampleRate);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    out[i] = 0.002 * gaussian(rand) + 0.004 * Math.sin(2 * Math.PI * 100 * t) + (Math.sin(2 * Math.PI * 1.5 * t) > 0.7 ? 0.002 * Math.sin(2 * Math.PI * 220 * t) : 0);
  }
  return out;
}

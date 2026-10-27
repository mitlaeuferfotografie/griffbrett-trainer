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
  for (let n = 0; n < length; n++) {
    out[n] *= gain;
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

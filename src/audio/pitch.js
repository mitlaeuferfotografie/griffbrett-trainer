// Einstimmige Tonhöhenerkennung nach YIN (de Cheveigné & Kawahara 2002).
// Reine Rechenfunktion ohne Browser-Abhängigkeit → in Node testbar.
//
// Ablauf pro Puffer:
//  1. Gleichanteil entfernen, Pegel (RMS) messen.
//  2. Differenzfunktion d(τ) = Σ (x[j] − x[j+τ])², die Kreuzkorrelation per FFT.
//  3. Kumulativ normierte Differenz d'(τ) (CMNDF).
//  4. Erste Mulde unter der Schwelle → Periode τ.
//  5. Oktavfehler-Korrektur: Ist d' bei 2τ oder 3τ deutlich tiefer, war τ nur
//     ein Oberton (typisch bei Gitarren mit schwachem Grundton) → längere Periode.
//  6. Parabel-Interpolation für Genauigkeit unter einem Sample.

import { createFFT, nextPow2 } from './fft.js';

export function createPitchDetector({
  sampleRate,
  bufferSize = 4096,
  minFreq = 50, // Drop A = 55 Hz, etwas Reserve für verstimmte Saiten
  maxFreq = 1500, // hohe E-Saite Bund 24 ≈ 1319 Hz
  threshold = 0.12,
  maxAperiodicity = 0.5,
} = {}) {
  if (!sampleRate) throw new Error('sampleRate fehlt');
  const N = bufferSize;
  const maxTau = Math.min(Math.ceil(sampleRate / minFreq), Math.floor(N / 2));
  const minTau = Math.max(2, Math.floor(sampleRate / maxFreq));
  const W = N - maxTau; // Integrationsfenster
  const M = nextPow2(N);
  const fft = createFFT(M);
  const aRe = new Float64Array(M);
  const aIm = new Float64Array(M);
  const bRe = new Float64Array(M);
  const bIm = new Float64Array(M);
  const x = new Float64Array(N);
  const prefix = new Float64Array(N + 1);
  const cm = new Float64Array(maxTau + 1);

  // Mulde um `center` herum suchen (±3 %, mind. ±2 Samples)
  function localMinNear(center) {
    const r = Math.max(2, Math.round(center * 0.03));
    const lo = Math.max(minTau, center - r);
    const hi = Math.min(maxTau - 1, center + r);
    let best = lo;
    for (let t = lo + 1; t <= hi; t++) if (cm[t] < cm[best]) best = t;
    return best;
  }

  // Parabel durch (τ−1, τ, τ+1): verfeinerte Lage und Tiefe der Mulde
  function refine(tau) {
    const y0 = cm[tau - 1];
    const y1 = cm[tau];
    const y2 = cm[tau + 1];
    const den = y0 - 2 * y1 + y2;
    if (den <= 0) return { tau, value: y1 };
    let shift = (0.5 * (y0 - y2)) / den;
    if (shift > 0.5) shift = 0.5;
    if (shift < -0.5) shift = -0.5;
    return { tau: tau + shift, value: Math.max(0, y1 - 0.25 * (y0 - y2) * shift) };
  }

  function detect(input) {
    const off = input.length - N;
    if (off < 0) throw new Error(`Puffer zu kurz (${input.length} < ${N})`);
    let mean = 0;
    for (let i = 0; i < N; i++) mean += input[off + i];
    mean /= N;
    let energy = 0;
    prefix[0] = 0;
    for (let i = 0; i < N; i++) {
      const v = input[off + i] - mean;
      x[i] = v;
      energy += v * v;
      prefix[i + 1] = energy;
    }
    const rms = Math.sqrt(energy / N);
    if (rms < 1e-7) return { freq: null, clarity: 0, rms };

    // Kreuzkorrelation r(τ) = Σ_{j<W} x[j]·x[j+τ] über FFT
    aRe.fill(0); aIm.fill(0); bRe.fill(0); bIm.fill(0);
    for (let i = 0; i < W; i++) aRe[i] = x[i];
    for (let i = 0; i < N; i++) bRe[i] = x[i];
    fft.forward(aRe, aIm);
    fft.forward(bRe, bIm);
    for (let k = 0; k < M; k++) {
      const re = aRe[k] * bRe[k] + aIm[k] * bIm[k]; // conj(A)·B
      const im = aRe[k] * bIm[k] - aIm[k] * bRe[k];
      aRe[k] = re;
      aIm[k] = im;
    }
    fft.inverse(aRe, aIm);

    const e1 = prefix[W];
    cm[0] = 1;
    let running = 0;
    for (let tau = 1; tau <= maxTau; tau++) {
      const e2 = prefix[tau + W] - prefix[tau];
      const d = Math.max(0, e1 + e2 - 2 * aRe[tau]);
      running += d;
      cm[tau] = running > 0 ? (d * tau) / running : 1;
    }

    let gmin = minTau;
    for (let t = minTau + 1; t < maxTau; t++) if (cm[t] < cm[gmin]) gmin = t;
    if (cm[gmin] > maxAperiodicity) return { freq: null, clarity: 1 - cm[gmin], rms };

    // Erste Mulde unter der (bei verrauschtem Signal angehobenen) Schwelle
    const thr = Math.max(threshold, cm[gmin] + 0.05);
    let tau = gmin;
    for (let t = minTau; t < maxTau; t++) {
      if (cm[t] < thr) {
        while (t + 1 < maxTau && cm[t + 1] < cm[t]) t++;
        tau = t;
        break;
      }
    }

    // Oktavfehler-Korrektur (Periode zu kurz erkannt)
    let best = refine(tau);
    for (let iter = 0; iter < 3; iter++) {
      let changed = false;
      for (const k of [2, 3]) {
        const c = Math.round(best.tau * k);
        if (c > maxTau - 1) break;
        const cand = refine(localMinNear(c));
        if (best.value > 0.02 && cand.value < 0.5 * best.value && cand.value < thr) {
          best = cand;
          changed = true;
          break;
        }
      }
      if (!changed) break;
    }

    return { freq: sampleRate / best.tau, clarity: 1 - best.value, rms };
  }

  return { detect, bufferSize: N, sampleRate, minTau, maxTau };
}

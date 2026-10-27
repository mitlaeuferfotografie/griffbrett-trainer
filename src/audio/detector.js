// Macht aus einzelnen Messungen (ca. 60 pro Sekunde) stabile Töne.
// Reine Logik ohne Browser-Abhängigkeit → in Node testbar.
//
// - Pegelschwelle: leise Frames (Raumrauschen) zählen nicht.
// - Stabilitätsfenster: Ein Ton gilt erst als erkannt, wenn `stableFrames`
//   Messungen hintereinander innerhalb von ±toleranceCents liegen.
// - Oktavausreißer (einzelne Frames genau ±12/±24 Halbtöne daneben) werden
//   übersprungen, statt den Ton zu unterbrechen.
// - Anschlag (Pegelsprung) startet die Erkennung neu, damit derselbe Ton beim
//   erneuten Anschlagen wieder als Ereignis gemeldet wird.
import { freqToMidi } from '../lib/notes.js';

export const TRACKER_DEFAULTS = {
  minDb: -50,
  minClarity: 0.8,
  stableFrames: 4,
  toleranceCents: 40,
  releaseFrames: 10,
  historySize: 8,
  onsetDb: 9,
  onsetWindow: 6,
  onsetRefractoryMs: 150,
};

export function rmsToDb(rms) {
  return rms > 0 ? 20 * Math.log10(rms) : -120;
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function createNoteTracker(options = {}) {
  const o = { ...TRACKER_DEFAULTS, ...options };
  let a4 = o.a4 ?? 440;
  let history = [];
  let outliers = 0;
  let invalid = 0;
  let stable = null; // { midi, midiFloat, since }
  let reattack = false;
  let lastOnset = -Infinity;
  const recentDb = [];

  function reset() {
    history = [];
    outliers = 0;
    invalid = 0;
    stable = null;
    reattack = false;
    recentDb.length = 0;
  }

  /**
   * frame: { time (ms), freq (Hz|null), clarity (0…1), rms }
   * Rückgabe: { valid, midiFloat, db, stable, event, onset }
   *   event = { type: 'note', midi, midiFloat, time } genau einmal pro erkanntem Ton
   */
  function update(frame) {
    const db = rmsToDb(frame.rms);
    let onset = false;
    if (recentDb.length >= o.onsetWindow) {
      const floor = Math.min(...recentDb);
      if (db - floor >= o.onsetDb && db > o.minDb + 3 && frame.time - lastOnset > o.onsetRefractoryMs) {
        onset = true;
        lastOnset = frame.time;
        history = [];
        outliers = 0;
        reattack = true;
      }
    }
    recentDb.push(db);
    if (recentDb.length > o.onsetWindow) recentDb.shift();

    const valid = frame.freq != null && db >= o.minDb && frame.clarity >= o.minClarity;
    if (!valid) {
      invalid++;
      if (invalid >= o.releaseFrames) {
        history = [];
        stable = null;
      }
      return { valid: false, midiFloat: null, db, stable, event: null, onset };
    }
    invalid = 0;

    const m = freqToMidi(frame.freq, a4);
    const tol = o.toleranceCents / 100;
    if (history.length) {
      const med = median(history);
      const diff = m - med;
      if (Math.abs(diff) > tol) {
        const octaves = Math.round(diff / 12);
        const isOctaveJump = octaves !== 0 && Math.abs(diff - octaves * 12) <= tol;
        if (isOctaveJump && outliers < o.stableFrames) {
          outliers++;
          return { valid: true, midiFloat: m, db, stable, event: null, onset };
        }
        history = [];
      }
    }
    outliers = 0;
    history.push(m);
    if (history.length > o.historySize) history.shift();

    let event = null;
    if (history.length >= o.stableFrames) {
      const recent = history.slice(-o.stableFrames);
      const med = median(recent);
      if (recent.every((x) => Math.abs(x - med) <= tol)) {
        const midi = Math.round(med);
        const midiFloat = median(history);
        if (!stable || stable.midi !== midi || reattack) {
          stable = { midi, midiFloat, since: frame.time };
          event = { type: 'note', midi, midiFloat, time: frame.time };
          reattack = false;
        } else {
          stable = { ...stable, midiFloat };
        }
      }
    }
    return { valid: true, midiFloat: m, db, stable, event, onset };
  }

  return {
    update,
    reset,
    setA4: (v) => { a4 = v; reset(); },
    setMinDb: (v) => { o.minDb = v; },
    get options() { return { ...o, a4 }; },
  };
}

// Mikrofon und Messschleife (Browser).
//
// iOS-Safari-Regeln:
// - startMic() muss direkt aus einem Klick-Handler aufgerufen werden: Der
//   AudioContext wird dort synchron angelegt und resume() angestoßen, erst
//   danach wird auf getUserMedia gewartet.
// - Beim Sperren des Bildschirms / App-Wechsel bricht die Audio-Session oft ab.
//   Beim Zurückkehren wird versucht fortzusetzen; klappt das nicht, geht der
//   Status auf 'interrupted' und die Oberfläche bittet um einen Tipp.
//
// Datenschutz: Das Signal wird nur im Speicher ausgewertet, nie aufgezeichnet
// oder übertragen. Der Analyser ist nicht mit den Lautsprechern verbunden.
import { createPitchDetector } from './pitch.js';

export const BUFFER_SIZE = 4096;

let state = { status: 'idle', error: null, sampleRate: null };
const statusListeners = new Set();
const frameListeners = new Set();

let ctx = null;
let stream = null;
let source = null;
let analyser = null;
let buffer = null;
let detector = null;
let raf = 0;
let running = false;

function setState(patch) {
  state = { ...state, ...patch };
  statusListeners.forEach((fn) => fn(state));
}

export function getMicState() {
  return state;
}

export function subscribeStatus(fn) {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}

/** fn({ time, freq, clarity, rms, computeMs }) – ca. 60 × pro Sekunde */
export function subscribeFrames(fn) {
  frameListeners.add(fn);
  return () => frameListeners.delete(fn);
}

function trackAlive() {
  return !!stream && stream.getAudioTracks().some((t) => t.readyState === 'live');
}

function loop() {
  if (!running) return;
  analyser.getFloatTimeDomainData(buffer);
  const t0 = performance.now();
  const r = detector.detect(buffer);
  const frame = { time: t0, freq: r.freq, clarity: r.clarity, rms: r.rms, computeMs: performance.now() - t0 };
  frameListeners.forEach((fn) => fn(frame));
  raf = requestAnimationFrame(loop);
}

function startLoop() {
  if (running) return;
  running = true;
  raf = requestAnimationFrame(loop);
}

function stopLoop() {
  running = false;
  cancelAnimationFrame(raf);
}

export async function startMic() {
  if (typeof window === 'undefined') return;
  if (!window.isSecureContext) return setState({ status: 'error', error: 'insecure' });
  if (!navigator.mediaDevices?.getUserMedia) return setState({ status: 'error', error: 'unsupported' });

  // synchron im Klick-Handler (iOS)
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!ctx || ctx.state === 'closed') {
    ctx = new AC({ latencyHint: 'interactive' });
    ctx.onstatechange = () => {
      if (state.status === 'running' && ctx.state !== 'running') {
        stopLoop();
        setState({ status: 'interrupted' });
      }
    };
  }
  const resumed = ctx.resume().catch(() => {});
  setState({ status: 'starting', error: null });

  try {
    if (!trackAlive()) {
      stream?.getTracks().forEach((t) => t.stop());
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        video: false,
      });
      stream.getAudioTracks().forEach((t) => {
        t.onended = () => {
          if (state.status === 'running') {
            stopLoop();
            setState({ status: 'interrupted' });
          }
        };
      });
      source?.disconnect();
      source = null;
    }
    await resumed;
    if (ctx.state !== 'running') await ctx.resume().catch(() => {});
    if (ctx.state !== 'running') {
      setState({ status: 'interrupted' });
      return;
    }
    if (!source) {
      source = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = BUFFER_SIZE;
      analyser.smoothingTimeConstant = 0;
      source.connect(analyser);
      buffer = new Float32Array(BUFFER_SIZE);
    }
    if (!detector || detector.sampleRate !== ctx.sampleRate) {
      detector = createPitchDetector({ sampleRate: ctx.sampleRate, bufferSize: BUFFER_SIZE });
    }
    setState({ status: 'running', error: null, sampleRate: ctx.sampleRate });
    startLoop();
  } catch (e) {
    const name = e?.name || '';
    const error =
      name === 'NotAllowedError' || name === 'SecurityError' ? 'denied'
      : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'nodevice'
      : name === 'NotReadableError' ? 'busy'
      : 'unknown';
    setState({ status: 'error', error, detail: String(e?.message || e) });
  }
}

/** Mikrofon freigeben (orangener Punkt in iOS verschwindet). */
export function stopMic() {
  stopLoop();
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  source?.disconnect();
  source = null;
  analyser = null;
  if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
  if (state.status !== 'error') setState({ status: 'idle' });
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'hidden') {
      if (state.status === 'running') stopLoop();
      return;
    }
    if (state.status !== 'running') return;
    if (!trackAlive()) {
      setState({ status: 'interrupted' });
      return;
    }
    if (ctx.state !== 'running') await ctx.resume().catch(() => {});
    if (ctx.state === 'running') startLoop();
    else setState({ status: 'interrupted' });
  });
}

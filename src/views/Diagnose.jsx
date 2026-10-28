import React, { useState, useRef } from 'react';
import { FlaskConical } from 'lucide-react';
import { getMicState } from '../audio/mic.js';
import { rmsToDb } from '../audio/detector.js';
import { runPitchSelfTest } from '../audio/selftest.js';
import { noteName, freqToMidi } from '../lib/notes.js';
import { getTuning } from '../lib/tunings.js';
import { positionsForMidi, stringName } from '../lib/fretboard.js';
import { useTracker, useMicFrames, useMicStatus } from '../ui/hooks.js';
import { Card, Header, LevelMeter, MicGate, fmtCents, BUILD } from '../ui/common.jsx';

// ==========================================
// DIAGNOSE (Hardware-Test)
// ==========================================

export function DiagnoseView({ settings, update, onBack }) {
  const mic = useMicStatus();
  const [selftest, setSelftest] = useState(null);
  const [running, setRunning] = useState(false);

  const runTest = () => {
    setRunning(true);
    setTimeout(() => {
      const sr = mic.sampleRate || 48000;
      const r = runPitchSelfTest({ sampleRate: sr });
      setSelftest(r);
      setRunning(false);
    }, 50);
  };

  return (
    <div>
      <Header title="Diagnose" onBack={onBack} />
      <MicGate settings={settings} update={update}>
        <LiveDiagnose settings={settings} />
      </MicGate>

      <Card className="mt-4">
        <div className="flex items-center gap-3 mb-3">
          <FlaskConical className="w-6 h-6 text-indigo-400" />
          <p className="font-black text-lg">Selbsttest</p>
        </div>
        <p className="text-slate-400 text-sm mb-4">
          Prüft die Tonerkennung auf diesem Gerät mit künstlichen Signalen (Sinus, Sägezahn, Obertöne, schwacher Grundton, Rauschen) von 55 bis 1320 Hz.
        </p>
        <button
          onClick={runTest}
          disabled={running}
          className="w-full py-3 rounded-2xl bg-slate-800 border-2 border-slate-700 font-bold active:scale-95 transition-transform disabled:opacity-50"
        >
          {running ? 'Läuft …' : 'Selbsttest starten'}
        </button>
        {selftest && (
          <div className="mt-4 text-sm tabular space-y-1">
            <p className={`font-bold ${selftest.ok === selftest.total ? 'text-emerald-400' : 'text-rose-400'}`}>
              {selftest.ok} von {selftest.total} Tönen korrekt
            </p>
            <p className="text-slate-300">Größte Abweichung: {selftest.maxCents.toFixed(1)} Cent</p>
            <p className="text-slate-300">Rechenzeit: {selftest.msPerFrame.toFixed(2)} ms pro Messung (Budget ca. 16 ms)</p>
            <p className="text-slate-500">Abtastrate {selftest.sampleRate} Hz, Puffer {selftest.bufferSize}</p>
            {selftest.results.filter((r) => !r.ok).slice(0, 10).map((r, i) => (
              <p key={i} className="text-rose-300">
                {r.wave}: {r.freq.toFixed(1)} Hz → {r.detected ? `${r.detected.toFixed(1)} Hz` : 'nichts'}
              </p>
            ))}
          </div>
        )}
      </Card>
      <p className="text-center text-xs text-slate-600 mt-4">Version {BUILD}</p>
    </div>
  );
}

export function LiveDiagnose({ settings }) {
  const tracker = useTracker(settings);
  const tuning = getTuning(settings.tuningId, settings.stringCount);
  const names = { naming: settings.naming, accidentals: settings.accidentals };
  const [live, setLive] = useState(null);
  const [events, setEvents] = useState([]);
  const stats = useRef({ n: 0, ms: 0, since: performance.now(), fps: 0, avgMs: 0 });
  const t0 = useRef(performance.now());

  useMicFrames((frame) => {
    const u = tracker.update(frame);
    const s = stats.current;
    s.n++;
    s.ms += frame.computeMs;
    if (frame.time - s.since > 1000) {
      s.fps = (s.n * 1000) / (frame.time - s.since);
      s.avgMs = s.ms / s.n;
      s.n = 0;
      s.ms = 0;
      s.since = frame.time;
    }
    if (u.event) {
      const ev = u.event;
      setEvents((list) => [{ ...ev, t: (ev.time - t0.current) / 1000 }, ...list].slice(0, 12));
    }
    setLive({ frame, u, fps: s.fps, avgMs: s.avgMs });
  });

  if (!live) return <Card className="text-slate-400">Warte auf Signal …</Card>;
  const { frame, u } = live;
  const raw = frame.freq ? freqToMidi(frame.freq, settings.a4) : null;
  const rawMidi = raw != null ? Math.round(raw) : null;
  const stable = u.stable;
  const positions = stable ? positionsForMidi(tuning.strings, stable.midi, settings.fretMax) : [];

  const Row = ({ k, v, dim }) => (
    <div className="flex justify-between py-1.5 border-b border-slate-800 last:border-0">
      <span className="text-slate-400">{k}</span>
      <span className={`font-bold tabular ${dim ? 'text-slate-500' : ''}`}>{v}</span>
    </div>
  );

  return (
    <>
      <Card>
        <div className="text-center mb-4">
          <div className="text-xs uppercase tracking-widest text-slate-500 mb-1">Stabil erkannt</div>
          <div className={`font-black text-6xl ${stable ? 'text-slate-50' : 'text-slate-700'}`}>
            {stable ? noteName(stable.midi, names, { octave: true }) : '–'}
          </div>
          <div className="text-sm text-slate-400 mt-2 min-h-[1.25rem]">
            {positions.map((p) => `${stringName(tuning.strings, p.string, names)} ${p.fret === 0 ? 'leer' : `Bund ${p.fret}`}`).join(' · ')}
          </div>
        </div>
        <LevelMeter db={u.db} minDb={settings.minDb} />
        <div className="mt-4 text-sm">
          <Row k="Frequenz (roh)" v={frame.freq ? `${frame.freq.toFixed(2)} Hz` : '–'} dim={!u.valid} />
          <Row
            k="Ton (roh)"
            v={rawMidi != null ? `${noteName(rawMidi, names, { octave: true })} ${fmtCents((raw - rawMidi) * 100)} ct` : '–'}
            dim={!u.valid}
          />
          <Row k="Klarheit" v={`${Math.round(frame.clarity * 100)} %`} dim={frame.clarity < 0.8} />
          <Row k="Pegel" v={`${Math.round(rmsToDb(frame.rms))} dB (Schwelle ${settings.minDb})`} />
          <Row k="Messungen/s" v={live.fps ? Math.round(live.fps) : '…'} />
          <Row k="Rechenzeit" v={live.avgMs ? `${live.avgMs.toFixed(2)} ms` : '…'} />
          <Row k="Abtastrate" v={`${getMicState().sampleRate} Hz`} />
        </div>
      </Card>
      <Card className="mt-4">
        <p className="font-black text-lg mb-2">Erkannte Töne</p>
        {events.length === 0 && <p className="text-slate-500 text-sm">Spiel einzelne Töne, sie erscheinen hier.</p>}
        <div className="text-sm tabular">
          {events.map((e, i) => {
            const c = Math.round((e.midiFloat - e.midi) * 100);
            return (
              <div key={`${e.time}-${i}`} className="flex justify-between py-1 border-b border-slate-800 last:border-0">
                <span className="text-slate-500 w-16">{e.t.toFixed(1)} s</span>
                <span className="font-bold flex-1">{noteName(e.midi, names, { octave: true })}</span>
                <span className="text-slate-400">{fmtCents(c)} ct</span>
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}

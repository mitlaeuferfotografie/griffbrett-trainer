import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Gauge, Activity, Settings, Play, Lock, ChevronLeft, Mic, MicOff, Shield, X, Minus, Plus, FlaskConical, Pause,
} from 'lucide-react';
import { startMic, stopMic, getMicState, subscribeStatus, subscribeFrames } from './audio/mic.js';
import { createNoteTracker, rmsToDb } from './audio/detector.js';
import { runPitchSelfTest } from './audio/selftest.js';
import { noteName, midiToFreq, freqToMidi, octaveOf } from './lib/notes.js';
import { getTuning, tuningsFor, tuningNotes, DEFAULT_TUNING } from './lib/tunings.js';
import { positionsForMidi, stringName } from './lib/fretboard.js';
import { loadData, saveData } from './lib/storage.js';

const BUILD = typeof __BUILD__ !== 'undefined' ? __BUILD__ : 'dev';
const IN_TUNE_CENTS = 3;

function fmtCents(c) {
  const r = Math.round(c);
  return `${r > 0 ? '+' : r < 0 ? '−' : '±'}${Math.abs(r)}`;
}

// ==========================================
// HOOKS
// ==========================================

function useMicStatus() {
  const [s, setS] = useState(getMicState());
  useEffect(() => subscribeStatus(setS), []);
  return s;
}

function useMicFrames(handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => subscribeFrames((f) => ref.current(f)), []);
}

/** Bildschirm wach halten, solange `active` (Fehler werden ignoriert). */
function useWakeLock(active) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return undefined;
    let lock = null;
    let cancelled = false;
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
      } catch {
        /* nicht verfügbar oder abgelehnt */
      }
    };
    request();
    const onVis = () => {
      if (document.visibilityState === 'visible' && !cancelled) request();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      lock?.release().catch(() => {});
    };
  }, [active]);
}

function useTracker(settings) {
  return useMemo(
    () => createNoteTracker({ a4: settings.a4, minDb: settings.minDb }),
    [settings.a4, settings.minDb],
  );
}

// ==========================================
// BAUSTEINE
// ==========================================

function Card({ children, className = '' }) {
  return <div className={`bg-slate-900 border-2 border-slate-800 rounded-3xl p-5 ${className}`}>{children}</div>;
}

function Header({ title, onBack, right }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Zurück"
          className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-900 border-2 border-slate-800 text-slate-300 active:scale-95 transition-transform"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}
      <h1 className="text-2xl font-black tracking-tight flex-1">{title}</h1>
      {right}
    </div>
  );
}

function Segmented({ options, value, onChange }) {
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={`flex-1 py-3 px-2 rounded-2xl border-2 font-bold text-sm transition-colors ${
            value === o.value
              ? 'bg-indigo-600 border-indigo-400 text-white'
              : 'bg-slate-950 border-slate-800 text-slate-300'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function LevelMeter({ db, minDb }) {
  const pct = (v) => Math.max(0, Math.min(100, ((v + 80) / 80) * 100));
  const above = db >= minDb;
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-400 mb-1 tabular">
        <span>Eingang</span>
        <span>{db > -120 ? `${Math.round(db)} dB` : '–'}</span>
      </div>
      <div className="relative h-3 rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-75 ${above ? 'bg-indigo-400' : 'bg-slate-600'}`}
          style={{ width: `${pct(db)}%` }}
        />
        <div className="absolute inset-y-0 w-0.5 bg-slate-200" style={{ left: `${pct(minDb)}%` }} />
      </div>
    </div>
  );
}

// ==========================================
// MIKROFON-ZUGANG
// ==========================================

const MIC_ERRORS = {
  denied: {
    title: 'Mikrofon nicht erlaubt',
    text: 'So erlaubst du es wieder: In Safari auf „aA“ in der Adressleiste → Website-Einstellungen → Mikrofon → Erlauben. Oder in den iOS-Einstellungen → Apps → Safari → Mikrofon. Danach die Seite neu laden.',
  },
  insecure: { title: 'Keine sichere Verbindung', text: 'Das Mikrofon funktioniert nur über https. Öffne die App über die GitHub-Pages-Adresse.' },
  unsupported: { title: 'Nicht unterstützt', text: 'Dieser Browser bietet keinen Mikrofonzugriff an.' },
  nodevice: { title: 'Kein Mikrofon gefunden', text: 'Es wurde kein Eingang gefunden.' },
  busy: { title: 'Mikrofon belegt', text: 'Eine andere App nutzt gerade das Mikrofon (z. B. ein Anruf). Beende sie und versuche es erneut.' },
  unknown: { title: 'Mikrofon-Fehler', text: 'Das Mikrofon konnte nicht gestartet werden.' },
};

function MicGate({ settings, update, children }) {
  const mic = useMicStatus();
  useWakeLock(mic.status === 'running');
  useEffect(() => () => stopMic(), []);

  if (mic.status === 'running') return children;

  const start = () => {
    if (!settings.micExplained) update({ micExplained: true });
    startMic();
  };

  if (mic.status === 'starting') {
    return <Card className="text-center text-slate-300 py-10">Mikrofon wird gestartet …</Card>;
  }

  if (mic.status === 'interrupted') {
    return (
      <Card className="text-center">
        <Pause className="w-10 h-10 mx-auto text-slate-400 mb-3" />
        <p className="font-bold text-lg mb-1">Mikrofon pausiert</p>
        <p className="text-slate-400 text-sm mb-5">iOS hat die Audioverbindung unterbrochen (Bildschirmsperre oder App-Wechsel).</p>
        <button onClick={start} className="w-full py-4 rounded-2xl bg-indigo-600 border-2 border-indigo-400 font-black text-lg active:scale-95 transition-transform">
          Fortsetzen
        </button>
      </Card>
    );
  }

  if (mic.status === 'error') {
    const e = MIC_ERRORS[mic.error] || MIC_ERRORS.unknown;
    return (
      <Card>
        <MicOff className="w-10 h-10 text-rose-400 mb-3" />
        <p className="font-bold text-lg mb-2">{e.title}</p>
        <p className="text-slate-300 text-sm leading-relaxed mb-5">{e.text}</p>
        {mic.error !== 'insecure' && mic.error !== 'unsupported' && (
          <button onClick={start} className="w-full py-4 rounded-2xl bg-slate-800 border-2 border-slate-700 font-bold active:scale-95 transition-transform">
            Erneut versuchen
          </button>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <Mic className="w-10 h-10 text-indigo-400 mb-3" />
      <p className="font-black text-xl mb-2">Mikrofon</p>
      <p className="text-slate-300 text-sm leading-relaxed mb-3">
        Die App hört über das Mikrofon, welchen Ton du spielst. Das Signal wird nur hier auf dem Gerät ausgewertet. Nichts wird aufgenommen, gespeichert oder übertragen.
      </p>
      {!settings.micExplained && <p className="text-slate-300 text-sm leading-relaxed mb-3">Gleich fragt Safari nach der Erlaubnis.</p>}
      <p className="text-slate-400 text-sm leading-relaxed mb-5">
        Tipp: Eine unverstärkte E-Gitarre ist fürs Handy-Mikrofon sehr leise. Besser leise über Amp oder Kopfhörer-Amp, oder die Westerngitarre.
      </p>
      <button onClick={start} className="w-full py-4 rounded-2xl bg-indigo-600 border-2 border-indigo-400 font-black text-lg active:scale-95 transition-transform">
        Mikrofon starten
      </button>
    </Card>
  );
}

// ==========================================
// STIMMGERÄT
// ==========================================

function TunerView({ settings, update, onBack }) {
  const tuning = getTuning(settings.tuningId, settings.stringCount);
  const names = { naming: settings.naming, accidentals: settings.accidentals };
  return (
    <div>
      <Header title="Stimmgerät" onBack={onBack} />
      <MicGate settings={settings} update={update}>
        <TunerDisplay settings={settings} tuning={tuning} names={names} />
      </MicGate>
      <div className="mt-4 flex flex-wrap gap-2">
        {tuningsFor(settings.stringCount).map((t) => (
          <button
            key={t.id}
            onClick={() => update({ tuningId: t.id })}
            className={`px-4 py-2 rounded-2xl border-2 text-sm font-bold ${
              t.id === tuning.id ? 'bg-indigo-600 border-indigo-400' : 'bg-slate-900 border-slate-800 text-slate-300'
            }`}
          >
            {t.label(names)}
          </button>
        ))}
        <span className="px-3 py-2 text-sm text-slate-400 tabular">a′ = {settings.a4} Hz</span>
      </div>
    </div>
  );
}

function TunerDisplay({ settings, tuning, names }) {
  const tracker = useTracker(settings);
  const [reading, setReading] = useState({ midiFloat: null, db: -120, held: false });
  const [target, setTarget] = useState(null); // Saitenindex oder null = automatisch
  const last = useRef({ value: null, time: -Infinity });

  useMicFrames((frame) => {
    const u = tracker.update(frame);
    let mf = u.stable ? u.stable.midiFloat : null;
    let held = false;
    if (mf != null) last.current = { value: mf, time: frame.time };
    else if (frame.time - last.current.time < 1200) {
      mf = last.current.value;
      held = true;
    }
    setReading({ midiFloat: mf, db: u.db, held });
  });

  const mf = reading.midiFloat;
  let label = '–';
  let octave = '';
  let cents = null;
  let hint = '';
  if (mf != null) {
    if (target != null) {
      const tm = tuning.strings[target];
      cents = (mf - tm) * 100;
      label = noteName(tm, names);
      octave = octaveOf(tm);
      if (cents < -50) hint = `zu tief (${noteName(Math.round(mf), names)})`;
      else if (cents > 50) hint = `zu hoch (${noteName(Math.round(mf), names)})`;
    } else {
      const midi = Math.round(mf);
      cents = (mf - midi) * 100;
      label = noteName(midi, names);
      octave = octaveOf(midi);
    }
  }
  const inTune = cents != null && Math.abs(cents) <= IN_TUNE_CENTS && !reading.held;
  const needle = cents == null ? 50 : 50 + Math.max(-50, Math.min(50, cents));
  const activeString = mf == null ? null : target ?? tuning.strings.findIndex((m) => m === Math.round(mf));

  return (
    <Card className={`transition-colors ${inTune ? 'border-emerald-500' : ''}`}>
      <div className={`text-center transition-opacity ${reading.held ? 'opacity-40' : ''}`}>
        <div className="flex items-start justify-center leading-none mt-2">
          <span className={`font-black text-[7.5rem] tracking-tight ${inTune ? 'text-emerald-400' : 'text-slate-50'}`}>{label}</span>
          <span className="text-2xl font-bold text-slate-500 mt-4 ml-1">{octave}</span>
        </div>
        <div className="h-8 text-xl font-bold tabular text-slate-300">
          {cents == null ? '' : hint || `${fmtCents(cents)} Cent`}
        </div>
      </div>

      {/* Skala −50 … +50 Cent */}
      <div className="relative h-16 mt-4 mb-2">
        {[-50, -25, 0, 25, 50].map((c) => (
          <div
            key={c}
            className={`absolute bottom-0 w-0.5 ${c === 0 ? 'h-16 bg-slate-400' : 'h-8 bg-slate-700'}`}
            style={{ left: `calc(${50 + c}% - 1px)` }}
          />
        ))}
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-slate-700" />
        {cents != null && (
          <div
            className={`absolute bottom-0 w-2 h-14 rounded-full transition-[left] duration-100 ${
              inTune ? 'bg-emerald-400' : 'bg-indigo-300'
            } ${reading.held ? 'opacity-40' : ''}`}
            style={{ left: `calc(${needle}% - 4px)` }}
          />
        )}
      </div>
      <div className="flex justify-between text-xs text-slate-500 tabular mb-5">
        <span>−50</span>
        <span>0</span>
        <span>+50</span>
      </div>

      {/* Saiten der aktiven Stimmung; antippen = Zielsaite festlegen */}
      <div className="flex gap-2 mb-2">
        {tuning.strings.map((m, i) => (
          <button
            key={i}
            onClick={() => setTarget(target === i ? null : i)}
            className={`flex-1 py-3 rounded-2xl border-2 font-black text-lg transition-colors ${
              activeString === i
                ? inTune
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                  : 'bg-indigo-500/20 border-indigo-400 text-white'
                : target === i
                  ? 'border-indigo-400 text-slate-200 bg-slate-950'
                  : 'border-slate-800 text-slate-400 bg-slate-950'
            }`}
          >
            {noteName(m, names)}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500 mb-4 text-center">
        {target == null ? 'Automatisch (chromatisch). Saite antippen, um sie als Ziel festzulegen.' : `Ziel: ${stringName(tuning.strings, target, names)} · nochmal tippen für automatisch`}
      </p>

      <LevelMeter db={reading.db} minDb={settings.minDb} />
      <div className="text-right text-xs text-slate-500 mt-1 tabular">
        {mf != null ? `${midiToFreq(mf, settings.a4).toFixed(1)} Hz` : ' '}
      </div>
    </Card>
  );
}

// ==========================================
// DIAGNOSE (Hardware-Test)
// ==========================================

function DiagnoseView({ settings, update, onBack }) {
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

function LiveDiagnose({ settings }) {
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

// ==========================================
// EINSTELLUNGEN
// ==========================================

function Section({ title, children }){
  return (
    <div className="mb-6">
      <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-2">{title}</p>
      {children}
    </div>
  );
}

function SettingsView({ settings, update, onBack, onPrivacy }) {
  const names = { naming: settings.naming, accidentals: settings.accidentals };
  const tunings = tuningsFor(settings.stringCount);
  const sharpLabel = settings.naming === 'int' ? 'F♯' : 'Fis';
  const flatLabel = settings.naming === 'int' ? 'G♭' : 'Ges';

  return (
    <div>
      <Header title="Einstellungen" onBack={onBack} />
      <Card>
        <Section title="Saiten">
          <Segmented
            options={[{ value: 6, label: '6 Saiten' }, { value: 7, label: '7 Saiten' }]}
            value={settings.stringCount}
            onChange={(n) => update({ stringCount: n, tuningId: DEFAULT_TUNING[n] })}
          />
        </Section>
        <Section title="Stimmung">
          <div className="flex flex-col gap-2">
            {tunings.map((t) => (
              <button
                key={t.id}
                onClick={() => update({ tuningId: t.id })}
                className={`flex justify-between items-center px-4 py-3 rounded-2xl border-2 font-bold ${
                  t.id === settings.tuningId ? 'bg-indigo-600 border-indigo-400' : 'bg-slate-950 border-slate-800 text-slate-300'
                }`}
              >
                <span>{t.label(names)}</span>
                <span className="text-sm font-normal opacity-80">{tuningNotes(t, names)}</span>
              </button>
            ))}
          </div>
        </Section>
        <Section title="Referenzton a′">
          <div className="flex items-center gap-3">
            <button
              onClick={() => update({ a4: Math.max(435, settings.a4 - 1) })}
              className="w-14 h-14 rounded-2xl bg-slate-950 border-2 border-slate-800 flex items-center justify-center active:scale-95"
              aria-label="tiefer"
            >
              <Minus className="w-6 h-6" />
            </button>
            <div className="flex-1 text-center font-black text-2xl tabular">{settings.a4} Hz</div>
            <button
              onClick={() => update({ a4: Math.min(445, settings.a4 + 1) })}
              className="w-14 h-14 rounded-2xl bg-slate-950 border-2 border-slate-800 flex items-center justify-center active:scale-95"
              aria-label="höher"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>
        </Section>
        <Section title="Tonnamen">
          <Segmented
            options={[{ value: 'de', label: 'Deutsch (H, B)' }, { value: 'int', label: 'International (B, B♭)' }]}
            value={settings.naming}
            onChange={(v) => update({ naming: v })}
          />
        </Section>
        <Section title="Vorzeichen">
          <Segmented
            options={[
              { value: 'sharp', label: sharpLabel },
              { value: 'flat', label: flatLabel },
              { value: 'both', label: `${sharpLabel}/${flatLabel}` },
            ]}
            value={settings.accidentals}
            onChange={(v) => update({ accidentals: v })}
          />
        </Section>
        <Section title={`Eingangsschwelle: ${settings.minDb} dB`}>
          <input
            type="range"
            min={-75}
            max={-25}
            step={1}
            value={settings.minDb}
            onChange={(e) => update({ minDb: Number(e.target.value) })}
            className="w-full accent-indigo-500"
          />
          <p className="text-xs text-slate-500 mt-1">Leiser als die Schwelle wird ignoriert. Höher stellen, wenn Raumgeräusche als Töne erkannt werden; tiefer, wenn leise Töne fehlen. Den Pegel siehst du live in der Diagnose.</p>
        </Section>
        <button onClick={onPrivacy} className="text-sm text-slate-400 underline underline-offset-2">
          Impressum · Datenschutz
        </button>
      </Card>
    </div>
  );
}

// ==========================================
// IMPRESSUM & DATENSCHUTZ
// ==========================================

const IMPRESSUM = {
  name: 'Peter Brandsch',
  street: 'Großhurdener Berg 40b',
  city: '51491 Overath',
  email: 'p.brandsch@gmx.de',
};

function LegalModal({ onClose }) {
  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border-2 border-slate-700 rounded-3xl max-w-lg w-full p-6 max-h-[85vh] overflow-y-auto relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} aria-label="Schließen" className="absolute top-4 right-4 text-slate-400 bg-slate-800 rounded-full p-2">
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-black mb-3">Impressum</h2>
        <div className="text-sm text-slate-300 leading-relaxed mb-6">
          <p>
            {IMPRESSUM.name}
            <br />
            {IMPRESSUM.street}
            <br />
            {IMPRESSUM.city}
          </p>
          <p className="mt-2">
            E-Mail:{' '}
            <a href={`mailto:${IMPRESSUM.email}`} className="text-indigo-300 underline underline-offset-2">
              {IMPRESSUM.email}
            </a>
          </p>
          <p className="mt-2">Verantwortlich für den Inhalt: {IMPRESSUM.name}, Anschrift wie oben.</p>
        </div>
        <div className="flex items-center gap-3 mb-3 pt-5 border-t-2 border-slate-800">
          <Shield className="w-6 h-6 text-indigo-400" />
          <h2 className="text-xl font-black">Datenschutz</h2>
        </div>
        <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
          <p>Verantwortlich: {IMPRESSUM.name} (Kontakt siehe Impressum). Der Griffbrett-Trainer ist ein privates, nicht-kommerzielles Projekt ohne Konten, Werbung oder Analyse-Dienste.</p>
          <div>
            <p className="font-bold text-slate-100 mb-1">Mikrofon</p>
            <p>Das Mikrofonsignal wird ausschließlich lokal in deinem Browser ausgewertet, um die Tonhöhe zu bestimmen. Es wird nicht aufgezeichnet, nicht gespeichert und nicht übertragen. Das Mikrofon ist nur aktiv, solange Stimmgerät, Diagnose oder eine Übung geöffnet ist.</p>
          </div>
          <div>
            <p className="font-bold text-slate-100 mb-1">Gespeicherte Daten</p>
            <p>Einstellungen und Lernstand liegen nur im lokalen Speicher (localStorage) dieses Geräts. Es gibt keine Cookies und keinen Server, der diese Daten erhält. Du kannst sie löschen, indem du die Website-Daten im Browser entfernst.</p>
          </div>
          <div>
            <p className="font-bold text-slate-100 mb-1">Hosting</p>
            <p>Die App wird über GitHub Pages (GitHub Inc., USA) ausgeliefert. Beim Aufruf verarbeitet GitHub technisch notwendige Verbindungsdaten wie die IP-Adresse. Alle Dateien der App werden von mitlaeuferfotografie.github.io geladen, es werden keine weiteren Drittanbieter eingebunden.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// MENÜ & APP
// ==========================================

function Tile({ icon: Icon, title, text, onClick, disabled, accent }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-4 p-5 rounded-3xl border-2 text-left transition-transform active:scale-[0.98] ${
        accent ? 'bg-indigo-600 border-indigo-400' : 'bg-slate-900 border-slate-800'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${accent ? 'bg-indigo-500' : 'bg-slate-800'}`}>
        <Icon className="w-7 h-7" />
      </div>
      <div className="flex-1">
        <div className="font-black text-lg">{title}</div>
        <div className={`text-sm ${accent ? 'text-indigo-100' : 'text-slate-400'}`}>{text}</div>
      </div>
      {disabled && <Lock className="w-5 h-5 text-slate-500" />}
    </button>
  );
}

function Menu({ settings, go, onPrivacy }) {
  const names = { naming: settings.naming, accidentals: settings.accidentals };
  const tuning = getTuning(settings.tuningId, settings.stringCount);
  return (
    <div>
      <div className="mb-6 mt-2">
        <h1 className="text-3xl font-black tracking-tight">Griffbrett-Trainer</h1>
        <p className="text-slate-400 mt-1">
          {tuning.label(names)} · {tuningNotes(tuning, names)} · a′ = {settings.a4} Hz
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <Tile icon={Play} title="Training" text="Folgt nach dem Hardware-Test" disabled />
        <Tile icon={Gauge} title="Stimmgerät" text="Chromatisch, mit Saitenanzeige" onClick={() => go('tuner', true)} accent />
        <Tile icon={Activity} title="Diagnose" text="Tonerkennung live prüfen, Selbsttest" onClick={() => go('diagnose', true)} />
        <Tile icon={Settings} title="Einstellungen" text="Saiten, Stimmung, Tonnamen, Referenzton" onClick={() => go('settings')} />
      </div>
      <div className="text-center mt-8 text-xs text-slate-500">
        <button onClick={onPrivacy} className="underline underline-offset-2">Impressum · Datenschutz</button>
        <p className="mt-2 text-slate-600">Version {BUILD}</p>
      </div>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(() => loadData());
  const [view, setView] = useState('menu');
  const [privacy, setPrivacy] = useState(false);
  const settings = data.settings;

  useEffect(() => {
    saveData(data);
  }, [data]);

  const update = useCallback((patch) => setData((d) => ({ ...d, settings: { ...d.settings, ...patch } })), []);

  // Mikrofon direkt im Tipp starten (iOS verlangt eine Nutzergeste), sofern schon erklärt
  const go = (v, needsMic) => {
    if (needsMic && settings.micExplained) startMic();
    setView(v);
    window.scrollTo(0, 0);
  };
  const back = () => go('menu');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 safe-area">
      <div className="max-w-md mx-auto">
        {view === 'menu' && <Menu settings={settings} go={go} onPrivacy={() => setPrivacy(true)} />}
        {view === 'tuner' && <TunerView settings={settings} update={update} onBack={back} />}
        {view === 'diagnose' && <DiagnoseView settings={settings} update={update} onBack={back} />}
        {view === 'settings' && <SettingsView settings={settings} update={update} onBack={back} onPrivacy={() => setPrivacy(true)} />}
      </div>
      {privacy && <LegalModal onClose={() => setPrivacy(false)} />}
    </div>
  );
}

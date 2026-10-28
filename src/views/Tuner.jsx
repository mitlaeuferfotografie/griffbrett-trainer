import React, { useState, useRef } from 'react';
import { noteName, midiToFreq, octaveOf } from '../lib/notes.js';
import { getTuning, tuningsFor } from '../lib/tunings.js';
import { stringName } from '../lib/fretboard.js';
import { useTracker, useMicFrames } from '../ui/hooks.js';
import { Card, Header, LevelMeter, MicGate, fmtCents } from '../ui/common.jsx';

const IN_TUNE_CENTS = 3;

// ==========================================
// STIMMGERÄT
// ==========================================

export function TunerView({ settings, update, onBack }) {
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

export function TunerDisplay({ settings, tuning, names }) {
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

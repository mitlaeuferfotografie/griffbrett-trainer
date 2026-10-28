import React, { useRef, useState } from 'react';
import { Mic } from 'lucide-react';
import { noteName } from '../lib/notes.js';
import { useMicFrames, useTracker } from './hooks.js';
import { Card } from './common.jsx';

// ==========================================
// GRIFFBRETT
// Vorgabe: dicke/tiefste Saite links, höchste rechts. Sattel oben, Bünde nach unten.
// ==========================================

export const STATUS_STYLE = {
  none: 'bg-slate-800 text-slate-500',
  unsicher: 'bg-orange-500 text-orange-950',
  wird: 'bg-amber-300 text-amber-950',
  sitzt: 'bg-emerald-500 text-emerald-950',
};
export const STATUS_LABEL = { none: 'nicht eingeführt', unsicher: 'unsicher', wird: 'wird', sitzt: 'sitzt' };
const MARKERS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24];

/**
 * cell(string, fret) → { className, label, ring } für Bund 1 … fretMax
 * (mit withOpen zusätzlich Bund 0 = Leersaiten über dem Sattel).
 * onCell(string, fret) macht Zellen antippbar (enabled(string, fret) schränkt ein).
 */
export function Fretboard({ strings, fretMax, names, cell, onCell, enabled, rowClass = 'h-7', withOpen = false }) {
  const cols = { gridTemplateColumns: `1.75rem repeat(${strings.length}, minmax(0, 1fr))` };
  const rows = [];
  for (let f = 1; f <= fretMax; f++) rows.push(f);
  const renderRows = (list) => (
    <div className="grid gap-1" style={cols}>
      {list.map((f) => (
          <React.Fragment key={f}>
            <div
              className={`flex items-center justify-end pr-1 text-[11px] tabular ${
                MARKERS.includes(f) ? 'font-black text-slate-300' : 'text-slate-600'
              } ${rowClass}`}
            >
              {f}
            </div>
            {strings.map((_, s) => {
              const c = cell(s, f) || {};
              const can = onCell && (!enabled || enabled(s, f));
              const cls = `${rowClass} rounded-md flex items-center justify-center text-[11px] font-bold leading-none ${c.className || 'bg-slate-900'} ${
                c.ring ? 'improved' : ''
              }`;
              return can ? (
                <button key={s} onClick={() => onCell(s, f)} className={`${cls} active:scale-95 transition-transform`}>
                  {c.label}
                </button>
              ) : (
                <div key={s} className={cls}>
                  {c.label}
                </div>
              );
            })}
          </React.Fragment>
        ))}
    </div>
  );
  return (
    <div className="select-none">
      <div className="grid gap-1" style={cols}>
        <div />
        {strings.map((m, s) => (
          <div key={s} className="text-center text-xs font-black text-slate-400">
            {noteName(m, names)}
          </div>
        ))}
      </div>
      {withOpen && <div className="mt-1">{renderRows([0])}</div>}
      <div className="grid gap-1 mt-1 mb-1" style={cols}>
        <div />
        <div className="h-1.5 rounded-full bg-slate-300" style={{ gridColumn: `span ${strings.length} / span ${strings.length}` }} />
      </div>
      {renderRows(rows)}
    </div>
  );
}

export function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
      {Object.keys(STATUS_STYLE).map((k) => (
        <span key={k} className="flex items-center gap-1.5">
          <span className={`w-3 h-3 rounded ${STATUS_STYLE[k]}`} />
          {STATUS_LABEL[k]}
        </span>
      ))}
    </div>
  );
}

/** Fortschrittsring (0 … 1) */
export function Ring({ value, size = 64, stroke = 7, children, done }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-800" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          className={`${done ? 'stroke-emerald-400' : 'stroke-indigo-400'} transition-[stroke-dashoffset] duration-500`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

export function ProgressBar({ value, className = 'bg-indigo-400' }) {
  return (
    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${className}`}
        style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }}
      />
    </div>
  );
}

export function fmtTime(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ==========================================
// ANTWORT ERKENNEN (Mikrofon / Antippen)
// ==========================================

/**
 * Hört auf den nächsten Ton für `task` (mit task.id und task.shownAt = performance.now()).
 * Schutz vor Fehlauslösung: 250 ms Sperrzeit nach Aufgabenwechsel; ein noch klingender
 * vorheriger Ton (blockMidi) zählt erst nach einem neuen Anschlag.
 */
export function MicAnswer({ settings, task, armed, blockMidi, onNote }) {
  const tracker = useTracker(settings);
  const st = useRef({ id: null, start: 0, onset: false, done: false });
  const [db, setDb] = useState(-120);
  const tick = useRef(0);

  useMicFrames((frame) => {
    const u = tracker.update(frame);
    if (++tick.current % 4 === 0) setDb(u.db);
    if (!task || !armed) return;
    if (st.current.id !== task.id) {
      st.current = { id: task.id, start: frame.time, onset: false, done: false };
      return;
    }
    const s = st.current;
    if (s.done) return;
    if (u.onset) s.onset = true;
    if (!u.event || frame.time - s.start < 250) return;
    if (u.event.midi === blockMidi && !s.onset) return;
    s.done = true;
    onNote(u.event.midi, Math.max(0, frame.time - task.shownAt), 'mic');
  });

  const above = db >= settings.minDb;
  return (
    <div className="flex items-center gap-3 mt-4">
      <Mic className={`w-5 h-5 flex-shrink-0 ${above ? 'text-indigo-400' : 'text-slate-600'}`} />
      <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-100 ${above ? 'bg-indigo-400' : 'bg-slate-600'}`}
          style={{ width: `${Math.max(0, Math.min(100, ((db + 90) / 90) * 100))}%` }}
        />
      </div>
    </div>
  );
}

/** Antippen statt spielen: nur die gefragte Saite ist aktiv. */
export function TapAnswer({ strings, fretMax, names, task, armed, onNote }) {
  return (
    <Card className="mt-4 p-3">
      <p className="text-xs text-slate-400 mb-2 text-center">Bund auf der gefragten Saite antippen</p>
      <Fretboard
        strings={strings}
        fretMax={fretMax}
        names={names}
        rowClass={fretMax > 12 ? 'h-6' : 'h-8'}
        cell={(s) => ({ className: s === task?.string ? 'bg-slate-700' : 'bg-slate-900 opacity-40' })}
        onCell={(s, f) => armed && task && onNote(strings[s] + f, Math.max(0, performance.now() - task.shownAt), 'tap')}
        enabled={(s) => s === task?.string}
      />
    </Card>
  );
}

/** Rückmeldung nach einer Antwort: Ziel grün, gespielter Bund (falls auf der Saite) orange. */
export function FeedbackBoard({ strings, fretMax, names, feedback, validFrets }) {
  const { task, playedFret, correct } = feedback;
  return (
    <Fretboard
      strings={strings}
      fretMax={fretMax}
      names={names}
      rowClass={fretMax > 12 ? 'h-3.5' : 'h-5'}
      cell={(s, f) => {
        if (s !== task.string) return { className: 'bg-slate-800/30' };
        if (validFrets.includes(f)) return { className: 'bg-emerald-500 text-emerald-950', label: noteName(strings[s] + f, names) };
        if (!correct && playedFret === f) return { className: 'bg-orange-500 text-orange-950', label: noteName(strings[s] + f, names) };
        return { className: 'bg-slate-800' };
      }}
    />
  );
}

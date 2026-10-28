import React, { useRef, useState, useMemo } from 'react';
import { Mic } from 'lucide-react';
import { noteName } from '../lib/notes.js';
import { useMicFrames, useTracker } from './hooks.js';
import { createAnswerGate } from '../audio/answer.js';
import { TRACKER_ANSWER } from '../audio/detector.js';
import { Card } from './common.jsx';

// ==========================================
// GRIFFBRETT
// Vorgabe des Nutzers: waagerecht wie die Gitarre auf dem Schoß – Sattel links, Bünde
// nach rechts, dicke (tiefste) Saite UNTEN, hohe E-Saite oben. Saiten als Linien (unten
// dicker), Bundstäbchen, Lagenpunkte (3, 5, 7, 9, 12 doppelt …), Töne als Punkte.
// Mehr als 12 Bünde werden als zwei Hälften untereinander gezeigt (0/1–12, 13–24).
// ==========================================

export const STATUS_STYLE = {
  none: 'bg-slate-600',
  unsicher: 'bg-orange-500 text-orange-950',
  wird: 'bg-amber-300 text-amber-950',
  sitzt: 'bg-emerald-500 text-emerald-950',
};
export const STATUS_LABEL = { none: 'nicht eingeführt', unsicher: 'unsicher', wird: 'wird', sitzt: 'sitzt' };
const MARKERS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24];
const DOUBLE = [12, 24];

const SIZES = {
  sm: { row: 18, dot: 15, small: 7, font: 8 },
  md: { row: 24, dot: 20, small: 8, font: 9 },
  lg: { row: 34, dot: 26, small: 10, font: 11 },
};

/**
 * cell(string, fret) → null (kein Punkt) oder { className, label, ring, small }.
 *   small: kleiner Punkt ohne Beschriftung (z. B. „nicht eingeführt“).
 * onCell(string, fret) macht Bundfelder antippbar (enabled(string, fret) schränkt ein).
 * withOpen: zusätzlich Bund 0 (Leersaiten) links vom Sattel.
 * highlightString: diese Saite farbig hervorheben (z. B. die gefragte Saite).
 * range: [von, bis] zeigt nur diesen Ausschnitt (z. B. der gespielten Lage folgend).
 */
export function Fretboard({ strings, fretMax, names, cell, onCell, enabled, size = 'md', withOpen = false, highlightString = null, range = null }) {
  const sz = SIZES[size] || SIZES.md;
  const parts = range ? [range] : fretMax > 12 ? [[withOpen ? 0 : 1, 12], [13, fretMax]] : [[withOpen ? 0 : 1, fretMax]];
  return (
    <div className="select-none space-y-3">
      {parts.map(([from, to]) => (
        <NeckPart
          key={from}
          strings={strings}
          from={from}
          to={to}
          names={names}
          cell={cell}
          onCell={onCell}
          enabled={enabled}
          sz={sz}
          highlightString={highlightString}
        />
      ))}
    </div>
  );
}

function NeckPart({ strings, from, to, names, cell, onCell, enabled, sz, highlightString }) {
  const n = strings.length;
  const order = strings.map((_, i) => n - 1 - i); // oberste Zeile = höchste Saite
  const frets = [];
  for (let f = from; f <= to; f++) frets.push(f);
  const height = n * sz.row;
  const hasNut = from <= 1;
  // Bund 0 schmaler, sonst gleich breit
  const cols = frets.map((f) => (f === 0 ? '1.4rem' : 'minmax(0, 1fr)')).join(' ');

  const renderCell = (s, f, row) => {
    const c = cell(s, f);
    const can = onCell && (!enabled || enabled(s, f));
    const dot =
      c && c.className ? (
        <span
          className={`rounded-full flex items-center justify-center font-black leading-none shadow ${c.className} ${c.ring ? 'improved' : ''}`}
          style={{ width: c.small ? sz.small : sz.dot, height: c.small ? sz.small : sz.dot, fontSize: sz.font }}
        >
          {c.small ? null : c.label}
        </span>
      ) : null;
    const style = { top: row * sz.row, height: sz.row };
    return can ? (
      <button
        key={s}
        onClick={() => onCell(s, f)}
        aria-label={`${noteName(strings[s], names)}-Saite Bund ${f}`}
        className="absolute inset-x-0 flex items-center justify-center active:bg-indigo-400/20 rounded"
        style={style}
      >
        {dot}
      </button>
    ) : (
      <div key={s} className="absolute inset-x-0 flex items-center justify-center pointer-events-none" style={style}>
        {dot}
      </div>
    );
  };

  return (
    <div>
      <div className="flex">
        {/* Saitennamen */}
        <div className="w-5 flex-shrink-0">
          {order.map((s) => (
            <div
              key={s}
              className={`flex items-center justify-end pr-1.5 text-[10px] font-black ${s === highlightString ? 'text-indigo-300' : 'text-slate-400'}`}
              style={{ height: sz.row }}
            >
              {noteName(strings[s], names)}
            </div>
          ))}
        </div>
        <div className="relative flex-1 min-w-0">
          {/* Saiten: unten dicker */}
          {order.map((s, row) => {
            const px = 1 + (1 - s / Math.max(1, n - 1)) * 2.2; // tiefste Saite ≈ 3 px, höchste 1 px
            return (
              <div
                key={s}
                className={`absolute left-0 right-0 ${s === highlightString ? 'bg-indigo-400' : 'bg-slate-500'}`}
                style={{ top: row * sz.row + sz.row / 2 - px / 2, height: s === highlightString ? px + 1 : px }}
              />
            );
          })}
          <div className="relative grid" style={{ gridTemplateColumns: cols, height }}>
            {frets.map((f, i) => (
              <div
                key={f}
                className={`relative ${f === 0 ? '' : 'border-r-2 border-slate-600'} ${
                  f !== 0 && i === (frets[0] === 0 ? 1 : 0) ? (hasNut ? 'border-l-[5px] border-l-slate-300' : 'border-l-2 border-l-slate-600') : ''
                }`}
              >
                {/* Lagenpunkte */}
                {MARKERS.includes(f) &&
                  (DOUBLE.includes(f) ? (
                    <>
                      <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-slate-700" style={{ top: sz.row * (n / 2 - 1) }} />
                      <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-slate-700" style={{ top: sz.row * (n / 2 + 1) }} />
                    </>
                  ) : (
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-slate-700" />
                  ))}
                {order.map((s, row) => renderCell(s, f, row))}
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Bundnummern */}
      <div className="flex mt-0.5">
        <div className="w-5 flex-shrink-0" />
        <div className="grid flex-1" style={{ gridTemplateColumns: cols }}>
          {frets.map((f) => (
            <div key={f} className={`text-center text-[9px] tabular ${MARKERS.includes(f) ? 'font-black text-slate-300' : 'text-slate-600'}`}>
              {f}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
      {Object.keys(STATUS_STYLE).map((k) => (
        <span key={k} className="flex items-center gap-1.5">
          <span className={`w-3 h-3 rounded-full ${STATUS_STYLE[k]}`} />
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
 * vorheriger Ton (blockMidi) zählt erst nach einem neuen Anschlag. Mit isCorrect(midi)
 * zählt ein richtiger Ton sofort, ein falscher erst nach 0,3 s stabilem Klang – Slides,
 * Rutsch- und Nebengeräusche werden so nicht als Fehler gewertet (src/audio/answer.js).
 */
export function MicAnswer({ settings, task, armed, blockMidi, onNote, isCorrect }) {
  // Antwort-Profil: Raumgeräusche und mitschwingende Saiten lösen keine Antwort aus
  const tracker = useTracker(settings, TRACKER_ANSWER);
  const gate = useMemo(() => createAnswerGate(), []);
  const st = useRef({ id: null, start: 0, onset: false, done: false });
  const [db, setDb] = useState(-120);
  const tick = useRef(0);

  useMicFrames((frame) => {
    const u = tracker.update(frame);
    if (++tick.current % 4 === 0) setDb(u.db);
    if (!task || !armed) return;
    if (st.current.id !== task.id) {
      st.current = { id: task.id, start: frame.time, onset: false, done: false };
      gate.reset();
      return;
    }
    const s = st.current;
    if (s.done) return;
    if (u.onset) s.onset = true;
    if (frame.time - s.start < 250) return;
    // noch klingender vorheriger Ton zählt nicht (außer nach neuem Anschlag)
    const uu = u.event && u.event.midi === blockMidi && !s.onset ? { ...u, event: null } : u;
    let midi = null;
    if (isCorrect) {
      const r = gate.update(uu, frame.time, isCorrect);
      if (r) midi = r.midi;
    } else if (uu.event) midi = uu.event.midi;
    if (midi == null) return;
    s.done = true;
    onNote(midi, Math.max(0, frame.time - task.shownAt), 'mic');
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
    <Card className="mt-4 landscape:mt-0 p-3">
      <p className="text-xs text-slate-400 mb-2 text-center">Bund auf der gefragten Saite antippen</p>
      <Fretboard
        strings={strings}
        fretMax={fretMax}
        names={names}
        size="lg"
        highlightString={task?.string}
        cell={() => null}
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
      highlightString={task.string}
      cell={(s, f) => {
        if (s !== task.string) return null;
        if (validFrets.includes(f)) return { className: 'bg-emerald-500 text-emerald-950', label: noteName(strings[s] + f, names) };
        if (!correct && playedFret === f) return { className: 'bg-orange-500 text-orange-950', label: noteName(strings[s] + f, names) };
        return null;
      }}
    />
  );
}

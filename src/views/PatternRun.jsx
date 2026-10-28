// Übung „Muster spielen“: ein 3NPS-/2NPS-Muster Ton für Ton auf- und abwärts spielen.
// Das Mikrofon prüft die Reihenfolge; falsche Töne halten nur auf. Zeit läuft ab dem ersten
// richtigen Ton, Bestzeit pro Muster. Zählt nicht im Lernstand.
import React, { useState, useRef, useEffect } from 'react';
import { Timer, Trophy, RotateCcw } from 'lucide-react';
import { noteName } from '../lib/notes.js';
import { degreeLabel } from '../lib/scales.js';
import { patternSequence, patternKey } from '../lib/patterns.js';
import { addPractice, fmtSec } from '../lib/stats.js';
import { startMic } from '../audio/mic.js';
import { useMicStatus } from '../ui/hooks.js';
import { Card, Header, MicGate, Split } from '../ui/common.jsx';
import { Fretboard, MicAnswer } from '../ui/board.jsx';

export function PatternRun({ settings, update, progress, setProgress, strings, names, tuningId, rootPc, scale, nps, position, pattern, title, onBack }) {
  const seq = patternSequence(pattern);
  const key = patternKey(tuningId, rootPc, scale.id, nps, position);
  const best = progress.bests.patterns?.[key];
  const mic = useMicStatus();
  const [index, setIndex] = useState(0);
  const [startAt, setStartAt] = useState(null);
  const [now, setNow] = useState(0);
  const [miss, setMiss] = useState(null);
  const [result, setResult] = useState(null);
  const lastMidi = useRef(null);
  const ids = useRef(1);
  const [task, setTask] = useState({ id: 1, shownAt: performance.now() });

  useEffect(() => {
    if (startAt == null || result) return undefined;
    const id = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(id);
  }, [startAt, result]);

  const rearm = () => {
    ids.current += 1;
    setTask({ id: ids.current, shownAt: performance.now() });
  };

  const onNote = (midi) => {
    if (result) return;
    lastMidi.current = midi;
    const expected = seq[index];
    if (Math.round(midi) !== expected.midi) {
      setMiss(midi);
      rearm();
      return;
    }
    setMiss(null);
    const t = performance.now();
    const start = startAt ?? t;
    if (startAt == null) setStartAt(t);
    if (index + 1 >= seq.length) {
      const ms = t - start;
      const isBest = best == null || ms < best;
      setProgress((p) => {
        let next = addPractice(p, Date.now(), { sec: Math.round(ms / 1000) });
        if (isBest) next = { ...next, bests: { ...next.bests, patterns: { ...(next.bests.patterns || {}), [key]: Math.round(ms) } } };
        return next;
      });
      setResult({ ms, isBest, prev: best });
      return;
    }
    setIndex(index + 1);
    rearm();
  };

  const restart = () => {
    if (settings.micExplained && mic.status !== 'running') startMic();
    setIndex(0);
    setStartAt(null);
    setResult(null);
    setMiss(null);
    lastMidi.current = null;
    rearm();
  };

  const expected = seq[index];
  const doneSet = new Set();
  if (!result) {
    // aufwärts gespielte Töne als erledigt markieren; auf dem Rückweg die ab der Spitze
    const peak = pattern.notes.length - 1;
    seq.slice(0, index).forEach((n, i) => {
      if (index <= peak || i > peak) doneSet.add(`${n.string}:${n.fret}`);
    });
  }

  const board = (
    <Fretboard
      strings={strings}
      fretMax={Math.max(...pattern.notes.map((n) => n.fret)) <= 12 ? 12 : 24}
      names={names}
      size="md"
      highlightString={result ? null : expected.string}
      cell={(s, f) => {
        const n = pattern.notes.find((x) => x.string === s && x.fret === f);
        if (!n) return null;
        const label = degreeLabel(scale, n.semis);
        if (result) return { className: 'bg-emerald-500 text-emerald-950', label };
        if (n === expected || (n.string === expected.string && n.fret === expected.fret)) return { className: 'bg-amber-400 text-amber-950 ring-2 ring-amber-200', label };
        if (doneSet.has(`${s}:${f}`)) return { className: 'bg-emerald-500 text-emerald-950', label };
        return { className: n.semis === 0 ? 'bg-indigo-400 text-white' : 'bg-indigo-500/70 text-white', label };
      }}
    />
  );

  const elapsed = startAt == null ? 0 : (result ? result.ms : now - startAt);
  const direction = index < pattern.notes.length ? 'aufwärts' : 'abwärts';

  return (
    <div>
      <Header
        title="Muster spielen"
        onBack={onBack}
        right={
          <span className="flex items-center gap-2 text-2xl font-black tabular">
            <Timer className="w-6 h-6 text-indigo-400" />
            {fmtSec(elapsed / 1000)}
          </span>
        }
      />
      <p className="text-slate-400 text-sm -mt-3 mb-3">{title}</p>
      <MicGate settings={settings} update={update}>
        <Split
          left={
            <Card className={`py-6 text-center ${result ? 'border-emerald-500' : miss != null ? 'border-orange-500' : ''}`}>
              {result ? (
                <>
                  <p className="text-slate-400">Geschafft</p>
                  <p className="text-6xl font-black tabular my-1">{fmtSec(result.ms / 1000)}</p>
                  <p className={`font-bold ${result.isBest ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {result.isBest ? (result.prev != null ? `Neue Bestzeit (bisher ${fmtSec(result.prev / 1000)})` : 'Erste Bestzeit') : `Bestzeit: ${fmtSec(result.prev / 1000)}`}
                  </p>
                  <button onClick={restart} className="mt-4 px-6 py-3 rounded-2xl bg-indigo-600 border-2 border-indigo-400 text-white font-black inline-flex items-center gap-2">
                    <RotateCcw className="w-5 h-5" /> Nochmal
                  </button>
                </>
              ) : (
                <>
                  <p className="text-slate-400 text-sm">
                    Ton {index + 1} von {seq.length} · {direction}
                  </p>
                  <p className="text-7xl font-black my-1">{noteName(expected.midi, names)}</p>
                  <p className="text-slate-300 font-bold">
                    Stufe {degreeLabel(scale, expected.semis)} · Bund {expected.fret}
                  </p>
                  <p className={`h-6 mt-1 font-bold ${miss != null ? 'text-orange-400' : 'text-slate-500 text-sm'}`}>
                    {miss != null ? `nicht ${noteName(miss, names)}` : startAt == null ? 'Zeit startet mit dem ersten Ton' : ''}
                  </p>
                  {best != null && (
                    <p className="text-xs text-slate-500 flex items-center justify-center gap-1">
                      <Trophy className="w-3.5 h-3.5" /> Bestzeit {fmtSec(best / 1000)}
                    </p>
                  )}
                </>
              )}
            </Card>
          }
          right={
            <>
              <Card className="p-3 mt-4">{board}</Card>
              {!result && (
                <MicAnswer
                  settings={settings}
                  task={task}
                  armed
                  blockMidi={lastMidi.current}
                  onNote={onNote}
                  isCorrect={(m) => Math.round(m) === seq[index].midi}
                />
              )}
              <p className="text-xs text-slate-500 text-center mt-3">Zählt nicht im Lernstand.</p>
            </>
          }
        />
      </MicGate>
    </div>
  );
}

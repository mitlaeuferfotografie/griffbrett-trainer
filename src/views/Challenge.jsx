// Challenge: alle natürlichen Töne einer Saite (Bund 1–12) so schnell wie möglich.
// Freiwillig, mit Bestzeit. Zählt bewusst NICHT im Lernstand, damit Zeitdruck die
// adaptive Wiederholung nicht verfälscht. Nur mit Mikrofon (Antippen wäre nicht vergleichbar).
import React, { useState, useRef, useEffect } from 'react';
import { Timer, Trophy } from 'lucide-react';
import { pcName, isNatural, pitchClass } from '../lib/notes.js';
import { getTuning } from '../lib/tunings.js';
import { stringName } from '../lib/fretboard.js';
import { judge } from '../lib/session.js';
import { fmtSec } from '../lib/stats.js';
import { startMic } from '../audio/mic.js';
import { useMicStatus } from '../ui/hooks.js';
import { Card, Header, MicGate, namesOf } from '../ui/common.jsx';
import { MicAnswer } from '../ui/board.jsx';
import { TaskText } from './Training.jsx';

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function naturalTasks(strings, s) {
  const out = [];
  for (let f = 1; f <= 12; f++) if (isNatural(strings[s] + f)) out.push({ string: s, fret: f, pc: pitchClass(strings[s] + f), key: `${strings[s]}:${f}` });
  return shuffle(out);
}

export function ChallengeView({ settings, update, progress, setProgress, onBack }) {
  const tuning = getTuning(settings.tuningId, settings.stringCount);
  const strings = tuning.strings;
  const names = namesOf(settings);
  const bests = progress.bests.challenge || {};
  const [stringIdx, setStringIdx] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [index, setIndex] = useState(0);
  const [task, setTask] = useState(null);
  const [miss, setMiss] = useState(false);
  const [startAt, setStartAt] = useState(0);
  const [now, setNow] = useState(0);
  const [result, setResult] = useState(null);
  const lastMidi = useRef(null);
  const ids = useRef(0);
  const mic = useMicStatus();

  // Zeit beginnt erst, wenn das Mikrofon läuft
  useEffect(() => {
    if (mic.status === 'running' && task && index === 0) {
      const t = performance.now();
      setStartAt(t);
      setNow(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mic.status]);

  useEffect(() => {
    if (!task) return undefined;
    if (mic.status !== 'running') return undefined;
    const id = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(id);
  }, [task, mic.status]);

  const show = (list, i) => {
    ids.current += 1;
    setIndex(i);
    setTask({ ...list[i], id: ids.current, shownAt: performance.now() });
  };

  const begin = (s) => {
    if (settings.micExplained) startMic();
    const list = naturalTasks(strings, s);
    setStringIdx(s);
    setTasks(list);
    setResult(null);
    const t = performance.now();
    setStartAt(t);
    setNow(t);
    show(list, 0);
  };

  const onNote = (midi) => {
    if (!task) return;
    lastMidi.current = midi;
    const ok = judge(strings, task, midi, 12).correct;
    if (!ok) {
      // kein Weiter, kein Abzug – nur kurzer Hinweis, gleiche Aufgabe neu scharf schalten
      setMiss(true);
      setTimeout(() => setMiss(false), 600);
      ids.current += 1;
      setTask({ ...task, id: ids.current });
      return;
    }
    setMiss(false);
    if (index + 1 < tasks.length) {
      show(tasks, index + 1);
      return;
    }
    const ms = performance.now() - startAt;
    const open = strings[stringIdx];
    const prev = bests[open];
    const isBest = prev == null || ms < prev;
    if (isBest) setProgress((p) => ({ ...p, bests: { ...p.bests, challenge: { ...(p.bests.challenge || {}), [open]: Math.round(ms) } } }));
    setResult({ ms, prev, isBest });
    setTask(null);
  };

  if (stringIdx == null || (!task && !result)) {
    return (
      <div>
        <Header title="Challenge" onBack={onBack} />
        <Card className="mb-4">
          <p className="text-slate-300 text-sm">
            Alle natürlichen Töne einer Saite bis Bund 12, in zufälliger Reihenfolge, so schnell wie möglich. Falsche Töne kosten nur Zeit. Zählt nicht im Lernstand.
          </p>
        </Card>
        <div className="flex flex-col gap-2">
          {strings.map((open, s) => (
            <button
              key={s}
              onClick={() => begin(s)}
              className="flex items-center justify-between px-5 py-4 rounded-2xl bg-slate-900 border-2 border-slate-800 active:scale-[0.98] transition-transform"
            >
              <span className="font-black text-lg">{stringName(strings, s, names)}</span>
              <span className="text-sm text-slate-400 tabular flex items-center gap-1.5">
                {bests[open] != null && <Trophy className="w-4 h-4" />}
                {bests[open] != null ? fmtSec(bests[open] / 1000) : 'noch keine Zeit'}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div>
        <Header title="Challenge" onBack={onBack} />
        <Card className="text-center py-10 mb-4">
          <p className="text-slate-400 mb-1">{stringName(strings, stringIdx, names)}</p>
          <p className="text-6xl font-black tabular">{fmtSec(result.ms / 1000)}</p>
          <p className={`mt-3 font-bold ${result.isBest ? 'text-emerald-400' : 'text-slate-400'}`}>
            {result.isBest
              ? result.prev != null
                ? `Neue Bestzeit (bisher ${fmtSec(result.prev / 1000)})`
                : 'Erste Bestzeit'
              : `Bestzeit: ${fmtSec(result.prev / 1000)}`}
          </p>
        </Card>
        <div className="flex gap-3">
          <button onClick={() => begin(stringIdx)} className="flex-1 py-4 rounded-2xl bg-indigo-600 border-2 border-indigo-400 font-black active:scale-95 transition-transform">
            Nochmal
          </button>
          <button onClick={() => { setStringIdx(null); setResult(null); }} className="flex-1 py-4 rounded-2xl bg-slate-800 border-2 border-slate-700 font-bold active:scale-95 transition-transform">
            Andere Saite
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header
        title="Challenge"
        onBack={() => { setTask(null); setStringIdx(null); }}
        right={
          <span className="flex items-center gap-2 text-2xl font-black tabular">
            <Timer className="w-6 h-6 text-indigo-400" />
            {fmtSec((now - startAt) / 1000)}
          </span>
        }
      />
      <div className="flex gap-1.5 mb-4">
        {tasks.map((_, i) => (
          <div key={i} className={`flex-1 h-2 rounded-full ${i < index ? 'bg-emerald-500' : i === index ? 'bg-indigo-400' : 'bg-slate-800'}`} />
        ))}
      </div>
      <MicGate settings={settings} update={update}>
        <Card className={`py-8 transition-colors ${miss ? 'border-orange-500' : ''}`}>
          <TaskText task={task} strings={strings} names={names} chip={miss ? <span className="text-orange-400 font-bold">nicht {pcName(pitchClass(lastMidi.current), names)}</span> : null} />
        </Card>
        <MicAnswer settings={settings} task={task} armed blockMidi={lastMidi.current} onNote={onNote} />
      </MicGate>
    </div>
  );
}

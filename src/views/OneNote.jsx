// Untermodus „Ein Ton – alle Saiten“: ein Ton nacheinander auf allen Saiten, tief nach hoch.
// Trainiert die Oktav-Verbindungen. Antworten zählen normal im Lernstand.
import React, { useState, useRef, useEffect } from 'react';
import { Shuffle, Check, X } from 'lucide-react';
import { pcName, NATURAL_PCS } from '../lib/notes.js';
import { getTuning } from '../lib/tunings.js';
import { stringName } from '../lib/fretboard.js';
import { applyAnswer, unitKey } from '../lib/srs.js';
import { judge, validFrets } from '../lib/session.js';
import { addPractice, fmtSec } from '../lib/stats.js';
import { startMic } from '../audio/mic.js';
import { useMicStatus, useWakeLock } from '../ui/hooks.js';
import { Card, Header, MicGate, namesOf } from '../ui/common.jsx';
import { MicAnswer, TapAnswer, FeedbackBoard } from '../ui/board.jsx';
import { TaskText, FeedbackText } from './Training.jsx';

function makeTasks(strings, pc, fretMax) {
  return strings.map((open, s) => {
    const fret = validFrets(strings, s, pc, fretMax).find((f) => f >= 1);
    return { string: s, fret, key: unitKey(open, fret), pc, kind: 'onenote' };
  });
}

export function OneNoteView({ settings, update, setProgress, onBack }) {
  const tuning = getTuning(settings.tuningId, settings.stringCount);
  const strings = tuning.strings;
  const names = namesOf(settings);
  const fretMax = settings.fretMax;
  const mic = useMicStatus();
  const [inputMode, setInputMode] = useState('mic');
  const [pc, setPc] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [index, setIndex] = useState(0);
  const [task, setTask] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [results, setResults] = useState([]);
  const timer = useRef(null);
  const lastMidi = useRef(null);
  const ids = useRef(0);
  const started = useRef(0);
  const visible = inputMode === 'tap' || mic.status === 'running';
  useWakeLock(pc != null && inputMode === 'tap');
  useEffect(() => () => clearTimeout(timer.current), []);

  const show = (list, i) => {
    ids.current += 1;
    setFeedback(null);
    setIndex(i);
    setTask({ ...list[i], id: ids.current, shownAt: performance.now() });
  };

  const start = (p) => {
    if (inputMode === 'mic' && settings.micExplained && mic.status !== 'running') startMic();
    const list = makeTasks(strings, p, fretMax);
    setPc(p);
    setTasks(list);
    setResults([]);
    started.current = Date.now();
    show(list, 0);
  };

  const finishRound = (res) => {
    const sec = Math.round((Date.now() - started.current) / 1000);
    setProgress((p) => addPractice(p, Date.now(), { sec }));
    setResults(res);
    setTask(null);
  };

  const answer = (midi, rtMs, mode) => {
    if (!task || feedback) return;
    const now = Date.now();
    const res = midi == null ? { correct: false, playedFret: null, creditKey: task.key } : judge(strings, task, midi, fretMax);
    const rt = midi == null ? null : rtMs / 1000;
    setProgress((p) => {
      const units = { ...p.units, [res.creditKey]: applyAnswer(p.units[res.creditKey], { correct: res.correct, rt, mode, now }) };
      return addPractice({ ...p, units }, now, { answers: 1, correct: res.correct ? 1 : 0 });
    });
    if (midi != null) lastMidi.current = midi;
    setFeedback({ ...res, rt, task, midi });
    const all = [...results, { string: task.string, correct: res.correct, rt }];
    setResults(all);
    timer.current = setTimeout(() => {
      if (index + 1 < tasks.length) show(tasks, index + 1);
      else finishRound(all);
    }, res.correct ? 900 : 2500);
  };

  const randomPc = () => {
    const pool = NATURAL_PCS.filter((p) => p !== pc);
    start(pool[Math.floor(Math.random() * pool.length)]);
  };

  // Auswahl
  if (pc == null) {
    return (
      <div>
        <Header title="Ein Ton – alle Saiten" onBack={onBack} />
        <Card>
          <p className="text-slate-300 text-sm mb-4">Ein Ton nacheinander auf allen Saiten, von der tiefsten zur höchsten. Trainiert die Oktav-Verbindungen.</p>
          <button onClick={randomPc} className="w-full py-4 mb-4 rounded-2xl bg-indigo-600 border-2 border-indigo-400 font-black text-lg flex items-center justify-center gap-2 active:scale-95 transition-transform">
            <Shuffle className="w-5 h-5" /> Zufälliger Ton
          </button>
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 12 }, (_, p) => (
              <button
                key={p}
                onClick={() => start(p)}
                className={`py-3 rounded-2xl border-2 font-black ${NATURAL_PCS.includes(p) ? 'bg-slate-950 border-slate-800 text-lg' : 'bg-slate-950 border-slate-800 text-slate-400 text-sm'}`}
              >
                {pcName(p, names)}
              </button>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  // Ergebnis
  if (!task) {
    return (
      <div>
        <Header title={`${pcName(pc, names)} – alle Saiten`} onBack={onBack} />
        <Card className="mb-4">
          {results.map((r) => (
            <div key={r.string} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
              <span className="font-bold">{stringName(strings, r.string, names)}</span>
              <span className="flex items-center gap-2 tabular">
                {r.rt != null && r.correct && <span className="text-slate-400">{fmtSec(r.rt)}</span>}
                {r.correct ? <Check className="w-5 h-5 text-emerald-400" /> : <X className="w-5 h-5 text-orange-400" />}
              </span>
            </div>
          ))}
        </Card>
        <div className="flex gap-3">
          <button onClick={randomPc} className="flex-1 py-4 rounded-2xl bg-indigo-600 border-2 border-indigo-400 font-black active:scale-95 transition-transform">
            Nächster Ton
          </button>
          <button onClick={() => setPc(null)} className="flex-1 py-4 rounded-2xl bg-slate-800 border-2 border-slate-700 font-bold active:scale-95 transition-transform">
            Ton wählen
          </button>
        </div>
      </div>
    );
  }

  // Ablauf
  return (
    <div>
      <Header title={`${pcName(pc, names)} – alle Saiten`} onBack={onBack} />
      <div className="flex gap-1.5 mb-4">
        {tasks.map((t, i) => {
          const r = results[i];
          return (
            <div
              key={i}
              className={`flex-1 h-2 rounded-full ${r ? (r.correct ? 'bg-emerald-500' : 'bg-orange-500') : i === index ? 'bg-indigo-400' : 'bg-slate-800'}`}
            />
          );
        })}
      </div>
      {visible && (
        <Card className={`py-8 ${feedback ? (feedback.correct ? 'border-emerald-500' : 'border-orange-500') : ''}`}>
          {!feedback ? (
            <TaskText task={task} strings={strings} names={names} />
          ) : (
            <>
              <FeedbackText feedback={feedback} strings={strings} names={names} fretMax={fretMax} />
              {!feedback.correct && (
                <div className="mt-5">
                  <FeedbackBoard
                    strings={strings}
                    fretMax={fretMax}
                    names={names}
                    feedback={feedback}
                    validFrets={validFrets(strings, feedback.task.string, feedback.task.pc, fretMax).filter((f) => f >= 1)}
                  />
                </div>
              )}
            </>
          )}
        </Card>
      )}
      {inputMode === 'mic' ? (
        <MicGate settings={settings} update={update} onTapMode={() => setInputMode('tap')}>
          <MicAnswer settings={settings} task={task} armed={!feedback} blockMidi={lastMidi.current} onNote={answer} />
        </MicGate>
      ) : (
        !feedback && <TapAnswer strings={strings} fretMax={fretMax} names={names} task={task} armed={!feedback} onNote={answer} />
      )}
    </div>
  );
}

// Ausbaustufe 2: Intervalle als Griff-Formen. Ein Grundton wird auf dem Griffbrett gezeigt,
// gefragt ist z. B. „♭3 – eine Saite höher“. Gespielt wird nur der Zielton (exakt, mit Oktave).
// Gleiche Lernlogik wie „Ton finden“, eigener Lernstand (progress.intervals).
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Pause, Play, Square, Check, X, Mic, Hand, Eye, TrendingUp, Unlock, Shapes } from 'lucide-react';
import { noteName } from '../lib/notes.js';
import { getTuning } from '../lib/tunings.js';
import { stringName } from '../lib/fretboard.js';
import { applyAnswer, status, FAST_SEC } from '../lib/srs.js';
import { createSession, pickTask, advanceSession } from '../lib/session.js';
import { addPractice, improvements, sessionSummary, evaluateMilestones, fmtSec } from '../lib/stats.js';
import {
  INTERVALS, INTERVAL_GROUPS, shapeInfo, activeShapes, shapesFor, makeIntervalTask, judgeInterval,
  computeIntervalUnlocked, intervalUnlockProgress, offsetLabel, parseShapeKey, shapeShort,
} from '../lib/intervals.js';
import { startMic } from '../audio/mic.js';
import { useMicStatus, useWakeLock } from '../ui/hooks.js';
import { Card, Header, MicGate, Segmented, Split, namesOf } from '../ui/common.jsx';
import { Fretboard, MicAnswer, ProgressBar, Legend, STATUS_STYLE, STATUS_LABEL, fmtTime } from '../ui/board.jsx';

const FEEDBACK_OK_MS = 1300;
const FEEDBACK_WRONG_MS = 3200;

function shapeLabel(key) {
  const { semis, offset, fretDelta } = parseShapeKey(key);
  const info = shapeInfo(semis);
  const d = fretDelta === 0 ? '±0' : fretDelta > 0 ? `+${fretDelta}` : `−${-fretDelta}`;
  return `${info.degree}${info.down ? ' darunter' : ''} · ${offsetLabel(offset)}, ${d} Bünde`;
}

const DIR_OPTIONS = [
  { value: 'both', label: 'Beides' },
  { value: 'up', label: 'Aufwärts' },
  { value: 'down', label: 'Abwärts' },
];

/** Übersicht aller Formen: Zeilen = Intervalle, Kästchen = Formen (=, +1, +2 Saiten; Bundabstand). */
export function ShapeMap({ strings, units, unlocked, highlight, dir = 'both' }) {
  const all = shapesFor(strings, dir);
  const activeKeys = new Set(activeShapes(strings, unlocked, dir).map((s) => s.key));
  return (
    <div className="space-y-1.5">
      {[...INTERVALS].reverse().map((iv) => {
        const shapes = all.filter((s) => s.deg === iv.semis).sort((a, b) => b.semis - a.semis || a.offset - b.offset || a.fretDelta - b.fretDelta);
        if (!shapes.length) return null;
        return (
          <div key={iv.semis} className="flex items-center gap-2">
            <span className="w-8 text-right font-black tabular">{iv.degree}</span>
            <div className="flex flex-wrap gap-1 flex-1">
              {shapes.map((s) => {
                const st = activeKeys.has(s.key) ? status(units[s.key]) : null;
                return (
                  <span
                    key={s.key}
                    title={shapeLabel(s.key)}
                    className={`px-1.5 h-6 min-w-[2.5rem] rounded-md text-[10px] font-bold flex items-center justify-center tabular ${
                      st ? STATUS_STYLE[st] : 'bg-slate-900 text-slate-700 border border-slate-800'
                    } ${highlight && highlight.has(s.key) ? 'improved' : ''}`}
                  >
                    {s.semis < 0 ? '↓ ' : ''}
                    {shapeShort(s)}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="text-[11px] text-slate-500 pt-1">Kästchen: Saitenwechsel (= gleiche, +1/+2 höher, −1/−2 tiefer) und Bundabstand, ↓ = darunter. Graue sind noch nicht freigeschaltet.</p>
    </div>
  );
}

function IntervalBoard({ strings, fretMax, names, task, feedback, onTap }) {
  const showTarget = !!feedback;
  return (
    <Fretboard
      strings={strings}
      fretMax={fretMax}
      names={names}
      size={onTap ? 'lg' : 'md'}
      highlightString={task.string}
      cell={(s, f) => {
        if (s === task.rootString && f === task.rootFret) return { className: 'bg-indigo-500 text-white', label: noteName(task.rootMidi, names) };
        if (showTarget && s === task.string && f === task.fret)
          return { className: 'bg-emerald-500 text-emerald-950', label: shapeInfo(task.semis).degree };
        if (showTarget && !feedback.correct && s === task.string && f === feedback.playedFret)
          return { className: 'bg-orange-500 text-orange-950', label: feedback.midi != null ? noteName(feedback.midi, names) : '' };
        return null;
      }}
      onCell={onTap}
      enabled={(s) => s === task.string}
    />
  );
}

export function IntervalsView({ settings, update, progress, setProgress, onBack }) {
  const tuning = getTuning(settings.tuningId, settings.stringCount);
  const strings = tuning.strings;
  const names = namesOf(settings);
  const ivp = progress.intervals;
  const dir = settings.intervalDir;
  const unlocked = computeIntervalUnlocked(strings, ivp.units, ivp.unlocked[tuning.id] || 1, dir);
  const next = intervalUnlockProgress(strings, ivp.units, unlocked, dir);
  const [phase, setPhase] = useState('home'); // home | run
  const [runKey, setRunKey] = useState(0);

  const begin = () => {
    if (settings.micExplained) startMic();
    setRunKey((k) => k + 1);
    setPhase('run');
  };

  if (phase === 'run') {
    return (
      <IntervalSession
        key={runKey}
        settings={settings}
        update={update}
        progress={progress}
        setProgress={setProgress}
        onAgain={begin}
        onHome={() => setPhase('home')}
      />
    );
  }

  return (
    <div>
      <Header title="Intervalle" onBack={onBack} />
      <Card className="mb-4">
        <p className="text-slate-300 text-sm">
          Ein Grundton wird auf dem Griffbrett gezeigt. Spiel das gefragte Intervall – darüber (gleiche Saite oder 1–2 Saiten höher) oder darunter („♭7 darunter“ = Stufe ♭7 der tieferen Oktave). So lernst du die Griff-Formen, auf denen Tonleitern, Arpeggien und CAGED aufbauen.
        </p>
        <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mt-4 mb-2">Richtung</p>
        <Segmented options={DIR_OPTIONS} value={dir} onChange={(v) => update({ intervalDir: v })} />
        <button onClick={() => update({ intervalRootFirst: !settings.intervalRootFirst })} className="w-full flex items-center justify-between pt-4">
          <span className="text-left">
            <span className="font-bold block">Grundton zuerst spielen</span>
            <span className="text-xs text-slate-400">Erst den Grundton, dann das Intervall – trainiert auch das Hören.</span>
          </span>
          <span className={`w-12 h-7 rounded-full p-1 transition-colors flex-shrink-0 ml-3 ${settings.intervalRootFirst ? 'bg-indigo-500' : 'bg-slate-700'}`}>
            <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${settings.intervalRootFirst ? 'translate-x-5' : ''}`} />
          </span>
        </button>
      </Card>
      <button
        onClick={begin}
        className="w-full py-5 mb-4 rounded-3xl bg-indigo-600 border-2 border-indigo-400 text-white font-black text-2xl flex items-center justify-center gap-3 active:scale-95 transition-transform"
      >
        <Play className="w-7 h-7" fill="currentColor" /> Start · {settings.sessionMinutes} Min
      </button>
      <Card className="mb-4">
        {next ? (
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-slate-400">
                Stufe {unlocked} von {INTERVAL_GROUPS.length} · als Nächstes: <span className="text-slate-200 font-bold">{next.next.label}</span>
              </span>
              <span className="text-slate-400 tabular">{Math.round(next.value * 100)} %</span>
            </div>
            <ProgressBar value={next.value} />
          </div>
        ) : (
          <p className="text-sm text-slate-400 mb-4">Alle Intervalle freigeschaltet.</p>
        )}
        <div className="flex items-center gap-3 mb-3">
          <Shapes className="w-6 h-6 text-indigo-400" />
          <p className="font-black text-lg">Formen</p>
        </div>
        <ShapeMap strings={strings} units={ivp.units} unlocked={unlocked} dir={dir} />
        <div className="mt-3">
          <Legend />
        </div>
      </Card>
    </div>
  );
}

function IntervalSession({ settings, update, progress, setProgress, onAgain, onHome }) {
  const tuning = getTuning(settings.tuningId, settings.stringCount);
  const strings = tuning.strings;
  const names = namesOf(settings);
  const fretMax = settings.fretMax;
  const dir = settings.intervalDir;
  const rootFirst = settings.intervalRootFirst;
  const shapes = useMemo(
    () => activeShapes(strings, computeIntervalUnlocked(strings, progress.intervals.units, progress.intervals.unlocked[tuning.id] || 1, dir), dir),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const mic = useMicStatus();
  const [inputMode, setInputMode] = useState('mic');
  const [phase, setPhase] = useState('run');
  const [task, setTask] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [summary, setSummary] = useState(null);

  const durationMs = settings.sessionMinutes * 60000;
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const elapsedRef = useRef(0);
  elapsedRef.current = elapsed;
  const sessionRef = useRef(createSession());
  const resultsRef = useRef([]);
  const beforeRef = useRef(progress.intervals.units);
  const timerRef = useRef(null);
  const lastMidiRef = useRef(null);
  const taskId = useRef(0);
  const finishedRef = useRef(false);
  const [stage, setStage] = useState('target'); // 'root' | 'target'
  const [rootHint, setRootHint] = useState(false);

  const inputModeRef = useRef(inputMode);
  inputModeRef.current = inputMode;
  const visible = inputMode === 'tap' || mic.status === 'running';
  const running = phase === 'run' && !paused && visible;
  useWakeLock(phase === 'run' && inputMode === 'tap');

  useEffect(() => {
    if (!running) return undefined;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      setElapsed((e) => e + (now - last));
      last = now;
    }, 250);
    return () => clearInterval(id);
  }, [running]);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearTimeout(timerRef.current);
    const now = Date.now();
    const results = resultsRef.current;
    const sec = Math.round(elapsedRef.current / 1000);
    let p = addPractice(progressRef.current, now, { sec });
    if (results.length) p = { ...p, totals: { ...p.totals, sessions: p.totals.sessions + 1 } };
    const prevUnlocked = p.intervals.unlocked[tuning.id] || 1;
    const unlockedNow = computeIntervalUnlocked(strings, p.intervals.units, prevUnlocked, dir);
    p = { ...p, intervals: { ...p.intervals, unlocked: { ...p.intervals.unlocked, [tuning.id]: unlockedNow } } };
    const ms = evaluateMilestones(p, strings, names, now);
    p = ms.progress;
    setProgress(() => p);
    setSummary({
      ...sessionSummary(results),
      improved: improvements(beforeRef.current, p.intervals.units),
      unlocked: INTERVAL_GROUPS.slice(prevUnlocked, unlockedNow).map((g) => g.label),
      milestones: ms.newly,
    });
    setPhase('summary');
  }, [strings, names, tuning.id, setProgress, dir]);

  const make = useCallback(
    (str, shape, kind) => ({ ...makeIntervalTask(str, shape, fretMax), kind }),
    [fretMax],
  );

  const nextTask = useCallback(() => {
    clearTimeout(timerRef.current);
    if (elapsedRef.current >= durationMs) {
      finish();
      return;
    }
    const t = pickTask({ strings, positions: shapes, units: progressRef.current.intervals.units, session: sessionRef.current, now: Date.now(), make });
    if (!t || t.rootMidi == null) {
      finish();
      return;
    }
    taskId.current += 1;
    setFeedback(null);
    setRootHint(false);
    setStage(rootFirst && inputModeRef.current === 'mic' ? 'root' : 'target');
    setTask({ ...t, id: taskId.current, shownAt: performance.now() });
  }, [strings, shapes, durationMs, finish, make, rootFirst]);

  useEffect(() => {
    nextTask();
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (running && task && !feedback) setTask((t) => (t ? { ...t, shownAt: performance.now() } : t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  useEffect(() => {
    if (phase === 'run' && elapsed >= durationMs && !feedback) finish();
  }, [elapsed, durationMs, feedback, phase, finish]);

  // Grundton-Stufe: erst der richtige Grundton, dann beginnt die Zeit für das Intervall
  const onMicNote = (midi, rtMs, mode) => {
    if (stage === 'root' && task) {
      lastMidiRef.current = midi;
      if (Math.round(midi) === task.rootMidi) {
        setRootHint(false);
        setStage('target');
        taskId.current += 1;
        setTask({ ...task, id: taskId.current, shownAt: performance.now() });
      } else {
        setRootHint(true);
        taskId.current += 1;
        setTask({ ...task, id: taskId.current });
      }
      return;
    }
    answer(midi, rtMs, mode);
  };

  const answer = (midi, rtMs, mode) => {
    if (!task || feedback || phase !== 'run') return;
    const now = Date.now();
    const res = midi == null ? { correct: false, playedFret: null, creditKey: task.key } : judgeInterval(strings, task, midi);
    const rt = midi == null ? null : rtMs / 1000;
    setProgress((p) => {
      const units = { ...p.intervals.units, [res.creditKey]: applyAnswer(p.intervals.units[res.creditKey], { correct: res.correct, rt, mode, now }) };
      return addPractice({ ...p, intervals: { ...p.intervals, units } }, now, { answers: 1, correct: res.correct ? 1 : 0 });
    });
    sessionRef.current = advanceSession(sessionRef.current, task, res.correct);
    resultsRef.current.push({ key: res.creditKey, correct: res.correct, rt, mode });
    if (midi != null) lastMidiRef.current = midi;
    setFeedback({ ...res, rt, midi });
    timerRef.current = setTimeout(nextTask, res.correct ? FEEDBACK_OK_MS : FEEDBACK_WRONG_MS);
  };

  const togglePause = () => {
    if (!paused) {
      clearTimeout(timerRef.current);
      setPaused(true);
    } else {
      setPaused(false);
      if (feedback) nextTask();
    }
  };

  if (phase === 'summary') {
    const highlight = new Set(summary.improved.map((i) => i.key));
    return (
      <div>
        <Header title="Session beendet" />
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            ['Antworten', summary.answers],
            ['richtig', summary.answers ? `${Math.round(summary.rate * 100)} %` : '–'],
            ['Ø Zeit', summary.avgRt != null ? fmtSec(summary.avgRt) : '–'],
          ].map(([k, v]) => (
            <div key={k} className="bg-slate-950 border-2 border-slate-800 rounded-2xl p-3 text-center">
              <div className="text-2xl font-black tabular">{v}</div>
              <div className="text-xs text-slate-400 mt-0.5">{k}</div>
            </div>
          ))}
        </div>
        <Card className="mb-4">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-6 h-6 text-indigo-400" />
            <p className="font-black text-lg">
              {summary.improved.length ? `${summary.improved.length} ${summary.improved.length === 1 ? 'Form' : 'Formen'} besser` : 'Geübt'}
            </p>
          </div>
          {summary.improved.length ? (
            <div className="flex flex-wrap gap-2">
              {summary.improved.slice(0, 12).map((i) => (
                <span key={i.key} className={`px-2.5 py-1 rounded-lg text-xs font-bold ${STATUS_STYLE[i.to]}`}>
                  {shapeLabel(i.key)} → {STATUS_LABEL[i.to]}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-slate-300 text-sm">„Sitzt“ braucht schnelle Antworten an mehreren Tagen – der Fortschritt zeigt sich über die nächsten Sessions.</p>
          )}
          {summary.unlocked.length > 0 && (
            <p className="mt-3 flex items-center gap-2 text-indigo-300 font-bold">
              <Unlock className="w-5 h-5" /> Neu freigeschaltet: {summary.unlocked.join(', ')}
            </p>
          )}
          {settings.showBests && summary.milestones.length > 0 && (
            <ul className="mt-3 text-sm font-bold space-y-1">
              {summary.milestones.map((m) => (
                <li key={m}>Meilenstein: {m}</li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="mb-4">
          <ShapeMap
            strings={strings}
            units={progress.intervals.units}
            unlocked={computeIntervalUnlocked(strings, progress.intervals.units, progress.intervals.unlocked[tuning.id] || 1, dir)}
            highlight={highlight}
            dir={dir}
          />
        </Card>
        <div className="flex gap-3">
          <button onClick={onAgain} className="flex-1 py-4 rounded-2xl bg-indigo-600 border-2 border-indigo-400 text-white font-black text-lg active:scale-95 transition-transform">
            Noch eine Runde
          </button>
          <button onClick={onHome} className="flex-1 py-4 rounded-2xl bg-slate-800 border-2 border-slate-700 font-bold active:scale-95 transition-transform">
            Fertig
          </button>
        </div>
      </div>
    );
  }

  const remaining = Math.max(0, durationMs - elapsed);
  const iv = task ? shapeInfo(task.semis) : null;

  return (
    <div>
      <Header
        title={fmtTime(remaining)}
        onBack={finish}
        right={
          <div className="flex gap-2">
            <button
              onClick={() => setInputMode(inputMode === 'mic' ? 'tap' : 'mic')}
              aria-label={inputMode === 'mic' ? 'Zu Antippen wechseln' : 'Zu Mikrofon wechseln'}
              className="w-12 h-12 rounded-2xl bg-slate-900 border-2 border-slate-800 flex items-center justify-center text-slate-300"
            >
              {inputMode === 'mic' ? <Mic className="w-5 h-5" /> : <Hand className="w-5 h-5" />}
            </button>
            <button
              onClick={togglePause}
              aria-label={paused ? 'Weiter' : 'Pause'}
              className="w-12 h-12 rounded-2xl bg-slate-900 border-2 border-slate-800 flex items-center justify-center"
            >
              {paused ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
            </button>
          </div>
        }
      />
      <div className="-mt-3 mb-4">
        <ProgressBar value={elapsed / durationMs} />
      </div>

      {paused ? (
        <Card className="text-center py-12">
          <p className="text-3xl font-black mb-2">Pause</p>
          <p className="text-slate-400 mb-6">Die Zeit ist angehalten.</p>
          <div className="flex gap-3">
            <button onClick={togglePause} className="flex-1 py-4 rounded-2xl bg-indigo-600 border-2 border-indigo-400 text-white font-black text-lg">
              Weiter
            </button>
            <button onClick={finish} className="flex-1 py-4 rounded-2xl bg-slate-800 border-2 border-slate-700 font-bold flex items-center justify-center gap-2">
              <Square className="w-4 h-4" /> Beenden
            </button>
          </div>
        </Card>
      ) : (
        <Split
          left={
          visible && task && (
            <Card className={`py-5 ${feedback ? (feedback.correct ? 'border-emerald-500' : 'border-orange-500') : ''}`}>
              <div className="text-center mb-4 min-h-[8.5rem]">
                {!feedback ? (
                  <>
                    <div className="font-black leading-none tracking-tight text-slate-50 text-8xl">
                      {iv.down && <span className="text-5xl align-top text-slate-400 mr-1">↓</span>}
                      {iv.degree}
                    </div>
                    <div className="text-xl font-bold text-slate-300 mt-2">{iv.down ? `Stufe ${iv.degree} darunter · ${iv.distance}` : iv.name}</div>
                    <div className="text-lg text-slate-400">
                      {offsetLabel(task.offset)} · Grundton {noteName(task.rootMidi, names)} auf der {stringName(strings, task.rootString, names, { dative: true })}
                    </div>
                    {stage === 'root' && (
                      <div className={`mt-3 inline-block px-4 py-1.5 rounded-full border-2 font-bold ${rootHint ? 'border-orange-500 text-orange-300' : 'border-indigo-400 text-indigo-200'}`}>
                        {rootHint ? 'Erst den Grundton' : 'Zuerst Grundton'} {noteName(task.rootMidi, names, { octave: true })} spielen
                      </div>
                    )}
                    {task.kind === 'new' && (
                      <span className="inline-block mt-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400 text-indigo-300 text-sm font-bold">neu</span>
                    )}
                  </>
                ) : feedback.correct ? (
                  <div className="flex items-center justify-center gap-3 text-emerald-400 pt-8">
                    <Check className="w-10 h-10" strokeWidth={3} />
                    <span className="text-3xl font-black">{noteName(task.targetMidi, names)}</span>
                    {feedback.rt != null && (
                      <span className={`text-xl font-bold tabular ${feedback.rt <= FAST_SEC ? 'text-emerald-300' : 'text-slate-400'}`}>{fmtSec(feedback.rt)}</span>
                    )}
                  </div>
                ) : (
                  <div className="pt-6">
                    <div className="flex items-center justify-center gap-3 text-orange-400">
                      <X className="w-10 h-10" strokeWidth={3} />
                      <span className="text-3xl font-black">{feedback.midi == null ? 'Lösung' : 'Daneben'}</span>
                    </div>
                    <p className="text-slate-300 mt-1">
                      {feedback.midi != null && <>Gespielt: {noteName(feedback.midi, names, { octave: true })} · </>}
                      Gesucht: {noteName(task.targetMidi, names, { octave: true })} ({stringName(strings, task.string, names)}, Bund {task.fret})
                    </p>
                  </div>
                )}
              </div>
              <div className="landscape:hidden">
                <IntervalBoard
                  strings={strings}
                  fretMax={fretMax}
                  names={names}
                  task={task}
                  feedback={feedback}
                  onTap={inputMode === 'tap' && !feedback ? (s, f) => answer(strings[s] + f, performance.now() - task.shownAt, 'tap') : undefined}
                />
              </div>
            </Card>
          )
          }
          right={
          <>
          {visible && task && (
            <Card className="hidden landscape:block p-3">
              <IntervalBoard
                strings={strings}
                fretMax={fretMax}
                names={names}
                task={task}
                feedback={feedback}
                onTap={inputMode === 'tap' && !feedback ? (s, f) => answer(strings[s] + f, performance.now() - task.shownAt, 'tap') : undefined}
              />
            </Card>
          )}
          {inputMode === 'mic' && (
            <MicGate settings={settings} update={update} onTapMode={() => setInputMode('tap')}>
              <MicAnswer
                settings={settings}
                task={task}
                armed={!feedback && running}
                blockMidi={lastMidiRef.current}
                onNote={onMicNote}
                isCorrect={(m) =>
                  !!task && (stage === 'root' ? Math.round(m) === task.rootMidi : judgeInterval(strings, task, m).correct)
                }
              />
            </MicGate>
          )}
          {visible && task && !feedback && (
            <button
              onClick={() => answer(null, 0, inputMode)}
              className="w-full mt-4 py-3 rounded-2xl bg-slate-900 border-2 border-slate-800 text-slate-400 font-bold flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4" /> Lösung zeigen
            </button>
          )}
          {inputMode === 'tap' && <p className="text-xs text-slate-500 text-center mt-3">Zielbund auf der Zielsaite antippen. Antippen zählt schwächer: höchstens bis „wird“.</p>}
          </>
          }
        />
      )}
    </div>
  );
}

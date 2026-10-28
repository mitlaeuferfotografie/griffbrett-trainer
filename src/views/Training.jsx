import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Pause, Play, Square, Check, X, Mic, Hand, Eye, TrendingUp, Award, Unlock } from 'lucide-react';
import { pcName, noteName } from '../lib/notes.js';
import { getTuning } from '../lib/tunings.js';
import { stringName } from '../lib/fretboard.js';
import { applyAnswer, status, FAST_SEC } from '../lib/srs.js';
import { buildGroups, computeUnlocked, activePositions, groupLabel, allPositions } from '../lib/curriculum.js';
import { createSession, pickTask, advanceSession, judge, validFrets } from '../lib/session.js';
import {
  addPractice, updateBests, evaluateMilestones, improvements, sessionSummary, todaySeconds, fmtSec,
} from '../lib/stats.js';
import { useMicStatus, useWakeLock } from '../ui/hooks.js';
import { Card, Header, MicGate, Split, namesOf } from '../ui/common.jsx';
import {
  Fretboard, FeedbackBoard, MicAnswer, TapAnswer, ProgressBar, Ring, Legend, STATUS_STYLE, STATUS_LABEL, fmtTime,
} from '../ui/board.jsx';

const FEEDBACK_OK_MS = 1300;
const FEEDBACK_WRONG_MS = 3000;

/** Großer Aufgabentext, aus ca. 1 m lesbar */
export function TaskText({ task, strings, names, chip }) {
  const label = pcName(task.pc, names);
  const size = label.length <= 2 ? 'text-[7rem]' : label.length <= 4 ? 'text-8xl' : 'text-7xl';
  return (
    <div className="text-center">
      <div className={`font-black leading-none tracking-tight text-slate-50 ${size}`}>{label}</div>
      <div className="text-2xl font-bold text-slate-300 mt-3">auf der {stringName(strings, task.string, names, { dative: true })}</div>
      <div className="h-7 mt-2">{chip}</div>
    </div>
  );
}

export function FeedbackText({ feedback, strings, names, fretMax = 12 }) {
  const { correct, rt, task, midi, playedFret } = feedback;
  if (correct) {
    return (
      <div className="flex items-center justify-center gap-3 text-emerald-400">
        <Check className="w-10 h-10" strokeWidth={3} />
        <span className="text-3xl font-black">Richtig</span>
        {rt != null && <span className={`text-xl font-bold tabular ${rt <= FAST_SEC ? 'text-emerald-300' : 'text-slate-400'}`}>{fmtSec(rt)}</span>}
      </div>
    );
  }
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-3 text-orange-400">
        <X className="w-10 h-10" strokeWidth={3} />
        <span className="text-3xl font-black">{midi == null ? 'Lösung' : 'Daneben'}</span>
      </div>
      <p className="text-slate-300 mt-1">
        {midi != null && (
          <>
            Gespielt: {noteName(midi, names)}
            {playedFret != null ? ` (Bund ${playedFret})` : ' (nicht auf dieser Saite)'} ·{' '}
          </>
        )}
        Gesucht: Bund {validFrets(strings, task.string, task.pc, fretMax).filter((f) => f >= 1).slice(0, 2).join(' / ')}
      </p>
    </div>
  );
}

export function TrainingView({ settings, update, progress, setProgress, onBack, onDone }) {
  const tuning = getTuning(settings.tuningId, settings.stringCount);
  const strings = tuning.strings;
  const names = namesOf(settings);
  const fretMax = settings.fretMax;
  const groups = useMemo(() => buildGroups(strings), [strings]);

  // aktive Positionen werden zu Beginn der Session festgelegt
  const positions = useMemo(() => {
    const unlocked = computeUnlocked(groups, strings, fretMax, progress.units, progress.unlocked[tuning.id] || 1);
    const manual = settings.groupMode === 'manual' ? settings.manualGroups : null;
    return activePositions(groups, strings, fretMax, { unlocked, manual });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const beforeRef = useRef(progress.units);
  const timerRef = useRef(null);
  const lastMidiRef = useRef(null);
  const taskId = useRef(0);
  const finishedRef = useRef(false);

  const visible = inputMode === 'tap' || mic.status === 'running';
  const running = phase === 'run' && !paused && visible;
  useWakeLock(phase === 'run' && inputMode === 'tap');

  // Zeit läuft nur, wenn wirklich geübt wird
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
    const prevUnlocked = p.unlocked[tuning.id] || 1;
    const unlockedNow = computeUnlocked(groups, strings, fretMax, p.units, prevUnlocked);
    p = { ...p, unlocked: { ...p.unlocked, [tuning.id]: unlockedNow } };
    const bests = updateBests(p, results, strings, names);
    p = bests.progress;
    const ms = evaluateMilestones(p, strings, names, now);
    p = ms.progress;
    setProgress(() => p);
    setSummary({
      ...sessionSummary(results),
      sec,
      practiced: new Set(results.map((r) => r.key)).size,
      improved: improvements(beforeRef.current, p.units),
      bests: bests.news,
      milestones: ms.newly,
      unlocked: settings.groupMode === 'manual' ? [] : groups.slice(prevUnlocked, unlockedNow).map((g) => groupLabel(g, strings, names)),
      todaySec: todaySeconds(p, now),
    });
    setPhase('summary');
  }, [groups, strings, fretMax, tuning.id, names, setProgress, settings.groupMode]);

  const nextTask = useCallback(() => {
    clearTimeout(timerRef.current);
    if (elapsedRef.current >= durationMs) {
      finish();
      return;
    }
    const t = pickTask({ strings, positions, units: progressRef.current.units, session: sessionRef.current, now: Date.now() });
    if (!t) {
      finish();
      return;
    }
    taskId.current += 1;
    setFeedback(null);
    setTask({ ...t, id: taskId.current, shownAt: performance.now() });
  }, [strings, positions, durationMs, finish]);

  useEffect(() => {
    nextTask();
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wenn die Aufgabe (wieder) sichtbar wird, beginnt die Reaktionszeit neu
  useEffect(() => {
    if (running && task && !feedback) setTask((t) => (t ? { ...t, shownAt: performance.now() } : t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  // Zeit abgelaufen, während auf eine Antwort gewartet wird
  useEffect(() => {
    if (phase === 'run' && elapsed >= durationMs && !feedback) finish();
  }, [elapsed, durationMs, feedback, phase, finish]);

  const answer = (midi, rtMs, mode) => {
    if (!task || feedback || phase !== 'run') return;
    const now = Date.now();
    const res = midi == null
      ? { correct: false, playedFret: null, creditKey: task.key }
      : judge(strings, task, midi, fretMax);
    const rt = midi == null ? null : rtMs / 1000;
    setProgress((p) => {
      const units = { ...p.units, [res.creditKey]: applyAnswer(p.units[res.creditKey], { correct: res.correct, rt, mode, now }) };
      return addPractice({ ...p, units }, now, { answers: 1, correct: res.correct ? 1 : 0 });
    });
    sessionRef.current = advanceSession(sessionRef.current, task, res.correct);
    resultsRef.current.push({ key: res.creditKey, string: task.string, open: strings[task.string], correct: res.correct, rt, mode });
    if (midi != null) lastMidiRef.current = midi;
    setFeedback({ ...res, rt, task, midi });
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
    return (
      <SessionSummary
        summary={summary}
        settings={settings}
        progress={progress}
        strings={strings}
        names={names}
        onAgain={onDone.again}
        onMenu={onDone.menu}
      />
    );
  }

  const remaining = Math.max(0, durationMs - elapsed);
  const chip =
    task && task.kind === 'new' ? (
      <span className="px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400 text-indigo-300 text-sm font-bold">neu</span>
    ) : task && task.kind === 'retry' ? (
      <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-400 text-sm font-bold">nochmal</span>
    ) : null;

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
            <button onClick={togglePause} className="flex-1 py-4 rounded-2xl bg-indigo-600 border-2 border-indigo-400 font-black text-lg">
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
            <Card className={`py-8 ${feedback ? (feedback.correct ? 'border-emerald-500' : 'border-orange-500') : ''}`}>
              {!feedback ? (
                <TaskText task={task} strings={strings} names={names} chip={chip} />
              ) : (
                <>
                  <FeedbackText feedback={feedback} strings={strings} names={names} fretMax={fretMax} />
                  <div className="mt-5 landscape:hidden">
                    <FeedbackBoard
                      strings={strings}
                      fretMax={fretMax}
                      names={names}
                      feedback={feedback}
                      validFrets={validFrets(strings, feedback.task.string, feedback.task.pc, fretMax).filter((f) => f >= 1)}
                    />
                  </div>
                </>
              )}
            </Card>
          )
          }
          right={
          <>
          {feedback && (
            <Card className="hidden landscape:block p-3">
              <FeedbackBoard
                strings={strings}
                fretMax={fretMax}
                names={names}
                feedback={feedback}
                validFrets={validFrets(strings, feedback.task.string, feedback.task.pc, fretMax).filter((f) => f >= 1)}
              />
            </Card>
          )}
          {inputMode === 'mic' ? (
            <MicGate settings={settings} update={update} onTapMode={() => setInputMode('tap')}>
              <MicAnswer settings={settings} task={task} armed={!feedback && running} blockMidi={lastMidiRef.current} onNote={answer} />
            </MicGate>
          ) : (
            !feedback && <TapAnswer strings={strings} fretMax={fretMax} names={names} task={task} armed={!feedback && running} onNote={answer} />
          )}
          {visible && task && !feedback && (
            <button
              onClick={() => answer(null, 0, inputMode)}
              className="w-full mt-4 py-3 rounded-2xl bg-slate-900 border-2 border-slate-800 text-slate-400 font-bold flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4" /> Lösung zeigen
            </button>
          )}
          {inputMode === 'tap' && (
            <p className="text-xs text-slate-500 text-center mt-3">Antippen zählt im Lernstand schwächer: höchstens bis „wird“.</p>
          )}
          </>
          }
        />
      )}
    </div>
  );
}

// ==========================================
// ZUSAMMENFASSUNG
// ==========================================

function Stat({ label, value }) {
  return (
    <div className="bg-slate-950 border-2 border-slate-800 rounded-2xl p-3 text-center">
      <div className="text-2xl font-black tabular">{value}</div>
      <div className="text-xs text-slate-400 mt-0.5">{label}</div>
    </div>
  );
}

function SessionSummary({ summary, settings, progress, strings, names, onAgain, onMenu }) {
  const improvedKeys = new Set(summary.improved.map((i) => i.key));
  const sitztNew = summary.improved.filter((i) => i.to === 'sitzt').length;
  const goalSec = settings.sessionMinutes * 60;
  const keyToLabel = (key) => {
    const [open, fret] = key.split(':').map(Number);
    const s = strings.indexOf(open);
    return s >= 0 ? `${noteName(open + fret, names)} · ${stringName(strings, s, names)}` : key;
  };
  const total = allPositions(strings, settings.fretMax).length;
  const sitzt = allPositions(strings, settings.fretMax).filter((p) => status(progress.units[p.key]) === 'sitzt').length;

  return (
    <div>
      <Header title="Session beendet" />
      <div className="grid grid-cols-3 gap-2 mb-4">
        <Stat label="Antworten" value={summary.answers} />
        <Stat label="richtig" value={summary.answers ? `${Math.round(summary.rate * 100)} %` : '–'} />
        <Stat label="Ø Zeit" value={summary.avgRt != null ? fmtSec(summary.avgRt) : '–'} />
      </div>

      <Card className="mb-4">
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp className="w-6 h-6 text-indigo-400" />
          <p className="font-black text-lg">
            {summary.improved.length ? `${summary.improved.length} ${summary.improved.length === 1 ? 'Position' : 'Positionen'} besser` : 'Geübt'}
          </p>
        </div>
        {summary.improved.length ? (
          <>
            {sitztNew > 0 && <p className="text-emerald-400 font-bold mb-2">{sitztNew} davon sitzen jetzt.</p>}
            <div className="flex flex-wrap gap-2">
              {summary.improved.slice(0, 12).map((i) => (
                <span key={i.key} className={`px-2.5 py-1 rounded-lg text-xs font-bold ${STATUS_STYLE[i.to]}`}>
                  {keyToLabel(i.key)} → {STATUS_LABEL[i.to]}
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="text-slate-300 text-sm">
            {summary.practiced} {summary.practiced === 1 ? 'Position' : 'Positionen'} geübt. „Sitzt“ braucht schnelle Antworten an mehreren Tagen, der Fortschritt zeigt sich also über die nächsten Sessions.
          </p>
        )}
        {summary.unlocked.length > 0 && (
          <p className="mt-3 flex items-center gap-2 text-indigo-300 font-bold">
            <Unlock className="w-5 h-5" /> Neu freigeschaltet: {summary.unlocked.join(', ')}
          </p>
        )}
      </Card>

      {settings.showBests && (summary.bests.length > 0 || summary.milestones.length > 0) && (
        <Card className="mb-4">
          <div className="flex items-center gap-3 mb-2">
            <Award className="w-6 h-6 text-indigo-400" />
            <p className="font-black text-lg">Neu</p>
          </div>
          <ul className="text-sm space-y-1">
            {summary.milestones.map((m) => (
              <li key={m} className="font-bold">Meilenstein: {m}</li>
            ))}
            {summary.bests.map((b) => (
              <li key={b} className="text-slate-300">Bestwert: {b}</li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-black text-lg">Griffbrett</p>
          <p className="text-sm text-slate-400 tabular">
            {sitzt} von {total} sitzen
          </p>
        </div>
        <Fretboard
          strings={strings}
          fretMax={settings.fretMax}
          names={names}
          size="sm"
          cell={(s, f) => {
            const key = `${strings[s]}:${f}`;
            const st = status(progress.units[key]);
            return { className: STATUS_STYLE[st], ring: improvedKeys.has(key), small: st === 'none' };
          }}
        />
        <div className="mt-3">
          <Legend />
        </div>
      </Card>

      {settings.showGoals && (
        <Card className="mb-4 flex items-center gap-4">
          <Ring value={summary.todaySec / goalSec} done={summary.todaySec >= goalSec}>
            <span className="text-sm font-black tabular">{Math.floor(summary.todaySec / 60)}′</span>
          </Ring>
          <p className="text-slate-300 text-sm">
            {summary.todaySec >= goalSec
              ? 'Tagesziel erreicht.'
              : `Heute ${Math.floor(summary.todaySec / 60)} von ${settings.sessionMinutes} Minuten.`}
          </p>
        </Card>
      )}

      <div className="flex gap-3">
        <button onClick={onAgain} className="flex-1 py-4 rounded-2xl bg-indigo-600 border-2 border-indigo-400 font-black text-lg active:scale-95 transition-transform">
          Noch eine Runde
        </button>
        <button onClick={onMenu} className="flex-1 py-4 rounded-2xl bg-slate-800 border-2 border-slate-700 font-bold active:scale-95 transition-transform">
          Fertig
        </button>
      </div>
    </div>
  );
}

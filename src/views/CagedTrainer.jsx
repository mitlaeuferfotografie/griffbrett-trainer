// CAGED-Übung: „D-Dur · A-Form“ – Lage selbst finden und das Arpeggio der Form aufwärts spielen.
// Lernlogik wie bei den Intervallen (eigener Lernstand progress.caged, Gruppen werden freigeschaltet).
// Zeit = bis zum ersten richtigen Ton; richtig, wenn höchstens CAGED_MAX_MISSES Fehltöne und keine Hilfe.
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Pause, Play, Square, Check, X, Eye, Unlock, SkipForward } from 'lucide-react';
import { noteName, pcName } from '../lib/notes.js';
import { getTuning } from '../lib/tunings.js';
import { getScale, keyName, degreeLabel, degreeRole } from '../lib/scales.js';
import { applyAnswer, status, FAST_SEC } from '../lib/srs.js';
import { createSession, pickTask, advanceSession } from '../lib/session.js';
import { addPractice, improvements, sessionSummary, fmtSec } from '../lib/stats.js';
import {
  CAGED_GROUPS, CAGED_MAX_MISSES, cagedBase, cagedUnits, computeCagedUnlocked, cagedUnlockProgress, makeCagedTask, parseCagedKey,
} from '../lib/caged.js';
import { startMic } from '../audio/mic.js';
import { useMicStatus } from '../ui/hooks.js';
import { Card, Header, MicGate, Split, namesOf } from '../ui/common.jsx';
import { Fretboard, MicAnswer, ProgressBar, Legend, STATUS_STYLE, STATUS_LABEL, fmtTime } from '../ui/board.jsx';

const FEEDBACK_OK_MS = 1800;
const FEEDBACK_WRONG_MS = 3500;
const ROLE_STYLE = {
  root: 'bg-amber-400 text-amber-950 ring-2 ring-amber-200',
  third: 'bg-emerald-500 text-emerald-950',
  fifth: 'bg-sky-400 text-sky-950',
};

const qualityLabel = (q) => (q === 'minor' ? 'Moll' : 'Dur');
const taskTitle = (t, naming, prefer) => keyName(t.rootPc, getScale(t.quality), naming, prefer);

/** Übersicht: Zeilen = Formen der freien Gruppen, Spalten = Grundtöne */
function CagedMap({ units, unlocked, names, highlight }) {
  return (
    <div className="space-y-1.5">
      {CAGED_GROUPS.slice(0, unlocked).flatMap((g) =>
        g.shapes.map((shape) => (
          <div key={`${g.quality}:${shape}`} className="flex items-center gap-1">
            <span className="w-12 flex-shrink-0 text-[11px] font-bold text-slate-300 leading-tight">
              {qualityLabel(g.quality)} {shape}
            </span>
            {Array.from({ length: 12 }, (_, r) => {
              const key = `${g.quality}:${shape}:${r}`;
              return (
                <span
                  key={r}
                  className={`flex-1 min-w-0 h-6 rounded-md text-[9px] font-bold flex items-center justify-center ${STATUS_STYLE[status(units[key])]} ${
                    highlight && highlight.has(key) ? 'improved' : ''
                  }`}
                >
                  {pcName(r, names)}
                </span>
              );
            })}
          </div>
        )),
      )}
    </div>
  );
}

export function CagedTrainerView({ settings, update, progress, setProgress, onBack }) {
  const tuning = getTuning(settings.tuningId, settings.stringCount);
  const names = namesOf(settings);
  const cp = progress.caged;
  const unlocked = computeCagedUnlocked(cp.units, cp.unlocked);
  const next = cagedUnlockProgress(cp.units, unlocked);
  const [phase, setPhase] = useState('home');
  const [runKey, setRunKey] = useState(0);

  const begin = () => {
    if (settings.micExplained) startMic();
    setRunKey((k) => k + 1);
    setPhase('run');
  };

  if (cagedBase(tuning.strings) == null) {
    return (
      <div>
        <Header title="CAGED" onBack={onBack} />
        <Card>
          <p className="text-slate-300">CAGED gilt für die Standardstimmung (bei 7 Saiten für die oberen sechs). Stell in den Einstellungen Standard ein, um zu üben.</p>
        </Card>
      </div>
    );
  }

  if (phase === 'run') {
    return <CagedSession key={runKey} settings={settings} update={update} progress={progress} setProgress={setProgress} onAgain={begin} onHome={() => setPhase('home')} />;
  }

  return (
    <div>
      <Header title="CAGED" onBack={onBack} />
      <Card className="mb-4">
        <p className="text-slate-300 text-sm">
          Gefragt ist ein Akkord in einer Form, z. B. „D-Dur · A-Form“. Finde die Lage und spiel das Arpeggio der Form aufwärts, vom tiefsten Akkordton der Form an. Die Zeit bis zum ersten richtigen Ton zählt – das Finden der Lage ist die eigentliche Übung.
        </p>
        <p className="text-xs text-slate-400 mt-2">Formen ansehen: Reiter Tonarten → CAGED.</p>
        <button onClick={() => update({ cagedFromRoot: !settings.cagedFromRoot })} className="w-full flex items-center justify-between pt-4">
          <span className="text-left">
            <span className="font-bold block">Vom Grundton aus</span>
            <span className="text-xs text-slate-400">Ab dem Grundton hoch, runter bis zum tiefsten Ton der Form, zurück zum Grundton. Aus: aufwärts ab dem tiefsten Ton der Form.</span>
          </span>
          <span className={`w-12 h-7 rounded-full p-1 transition-colors flex-shrink-0 ml-3 ${settings.cagedFromRoot ? 'bg-indigo-500' : 'bg-slate-700'}`}>
            <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${settings.cagedFromRoot ? 'translate-x-5' : ''}`} />
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
                Stufe {unlocked} von {CAGED_GROUPS.length} · als Nächstes: <span className="text-slate-200 font-bold">{next.next.label}</span>
              </span>
              <span className="text-slate-400 tabular">{Math.round(next.value * 100)} %</span>
            </div>
            <ProgressBar value={next.value} />
          </div>
        ) : (
          <p className="text-sm text-slate-400 mb-4">Alle Formen freigeschaltet.</p>
        )}
        <CagedMap units={cp.units} unlocked={unlocked} names={names} />
        <div className="mt-3">
          <Legend />
        </div>
      </Card>
    </div>
  );
}

function CagedSession({ settings, update, progress, setProgress, onAgain, onHome }) {
  const tuning = getTuning(settings.tuningId, settings.stringCount);
  const strings = tuning.strings;
  const names = namesOf(settings);
  const naming = settings.naming;
  const prefer = settings.accidentals === 'sharp' ? 'sharp' : 'flat';
  const units = useMemo(() => cagedUnits(computeCagedUnlocked(progress.caged.units, progress.caged.unlocked)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const mic = useMicStatus();
  const [phase, setPhase] = useState('run');
  const [task, setTask] = useState(null);
  const [index, setIndex] = useState(0);
  const [misses, setMisses] = useState(0);
  const [miss, setMiss] = useState(null);
  const [hinted, setHinted] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [summary, setSummary] = useState(null);
  const [armId, setArmId] = useState({ id: 0, shownAt: 0 });

  const durationMs = settings.sessionMinutes * 60000;
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const elapsedRef = useRef(0);
  elapsedRef.current = elapsed;
  const sessionRef = useRef(createSession());
  const resultsRef = useRef([]);
  const beforeRef = useRef(progress.caged.units);
  const timerRef = useRef(null);
  const lastMidi = useRef(null);
  const ids = useRef(0);
  const firstAt = useRef(null);
  const finishedRef = useRef(false);

  const running = phase === 'run' && !paused && mic.status === 'running';

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

  const rearm = (shownAt) => {
    ids.current += 1;
    setArmId((a) => ({ id: ids.current, shownAt: shownAt ?? a.shownAt }));
  };

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearTimeout(timerRef.current);
    const now = Date.now();
    const results = resultsRef.current;
    let p = addPractice(progressRef.current, now, { sec: Math.round(elapsedRef.current / 1000) });
    if (results.length) p = { ...p, totals: { ...p.totals, sessions: p.totals.sessions + 1 } };
    const prev = p.caged.unlocked || 1;
    const nowUnlocked = computeCagedUnlocked(p.caged.units, prev);
    p = { ...p, caged: { ...p.caged, unlocked: nowUnlocked } };
    setProgress(() => p);
    setSummary({
      ...sessionSummary(results),
      improved: improvements(beforeRef.current, p.caged.units),
      unlocked: CAGED_GROUPS.slice(prev, nowUnlocked).map((g) => g.label),
    });
    setPhase('summary');
  }, [setProgress]);

  const nextTask = useCallback(() => {
    clearTimeout(timerRef.current);
    if (elapsedRef.current >= durationMs) {
      finish();
      return;
    }
    const t = pickTask({ strings, positions: units, units: progressRef.current.caged.units, session: sessionRef.current, now: Date.now(), make: (st, u, kind) => makeCagedTask(st, u, kind, { fromRoot: settings.cagedFromRoot }) });
    if (!t) {
      finish();
      return;
    }
    setTask(t);
    setIndex(0);
    setMisses(0);
    setMiss(null);
    setHinted(false);
    setFeedback(null);
    firstAt.current = null;
    rearm(performance.now());
  }, [strings, units, durationMs, finish, settings.cagedFromRoot]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    nextTask();
    return () => clearTimeout(timerRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase === 'run' && elapsed >= durationMs && !feedback) finish();
  }, [elapsed, durationMs, feedback, phase, finish]);

  const complete = (ok, gaveUp = false) => {
    const now = Date.now();
    const correct = ok && !gaveUp;
    const rt = firstAt.current == null || gaveUp ? null : (firstAt.current - armId.shownAt) / 1000;
    setProgress((p) => {
      const u = { ...p.caged.units, [task.key]: applyAnswer(p.caged.units[task.key], { correct, rt, mode: 'mic', now }) };
      return addPractice({ ...p, caged: { ...p.caged, units: u } }, now, { answers: 1, correct: correct ? 1 : 0 });
    });
    sessionRef.current = advanceSession(sessionRef.current, task, correct);
    resultsRef.current.push({ key: task.key, correct, rt, mode: 'mic' });
    setFeedback({ correct, rt, gaveUp });
    timerRef.current = setTimeout(nextTask, correct ? FEEDBACK_OK_MS : FEEDBACK_WRONG_MS);
  };

  const onNote = (midi) => {
    if (!task || feedback) return;
    lastMidi.current = midi;
    const expected = task.seq[index];
    if (Math.round(midi) !== expected.midi) {
      // Vor dem ersten Treffer zählen Suchtöne nicht als Fehler – nur innerhalb des Arpeggios
      if (index > 0) setMisses((m) => m + 1);
      setMiss(midi);
      rearm();
      return;
    }
    setMiss(null);
    if (firstAt.current == null) firstAt.current = performance.now();
    if (index + 1 >= task.seq.length) {
      complete(misses <= CAGED_MAX_MISSES && !hinted);
      return;
    }
    setIndex(index + 1);
    rearm();
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
            ['Akkorde', summary.answers],
            ['richtig', summary.answers ? `${Math.round(summary.rate * 100)} %` : '–'],
            ['Ø bis Lage', summary.avgRt != null ? fmtSec(summary.avgRt) : '–'],
          ].map(([k, v]) => (
            <div key={k} className="bg-slate-950 border-2 border-slate-800 rounded-2xl p-3 text-center">
              <div className="text-2xl font-black tabular">{v}</div>
              <div className="text-xs text-slate-400 mt-0.5">{k}</div>
            </div>
          ))}
        </div>
        <Card className="mb-4">
          {summary.improved.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {summary.improved.slice(0, 12).map((i) => {
                const k = parseCagedKey(i.key);
                return (
                  <span key={i.key} className={`px-2.5 py-1 rounded-lg text-xs font-bold ${STATUS_STYLE[i.to]}`}>
                    {keyName(k.rootPc, getScale(k.quality), naming, prefer)} {k.shape}-Form → {STATUS_LABEL[i.to]}
                  </span>
                );
              })}
            </div>
          )}
          {summary.unlocked.length > 0 && (
            <p className="mb-3 flex items-center gap-2 text-indigo-300 font-bold">
              <Unlock className="w-5 h-5" /> Neu freigeschaltet: {summary.unlocked.join(', ')}
            </p>
          )}
          <CagedMap units={progress.caged.units} unlocked={computeCagedUnlocked(progress.caged.units, progress.caged.unlocked)} names={names} highlight={highlight} />
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
  const scale = task ? getScale(task.quality) : null;
  const reveal = feedback || hinted;
  const played = new Set(task ? task.seq.slice(0, index).map((n) => `${n.string}:${n.fret}`) : []);
  const expected = task ? task.seq[index] : null;

  const board = task && (
    <Fretboard
      strings={strings}
      fretMax={15}
      range={[0, 15]}
      names={names}
      withOpen
      size="md"
      cell={(s, f) => {
        const n = task.pos.arp.find((x) => x.string === s && x.fret === f);
        if (n && played.has(`${s}:${f}`)) return { className: 'bg-emerald-500 text-emerald-950', label: degreeLabel(scale, n.semis) };
        if (n && reveal) return { className: ROLE_STYLE[degreeRole(n.semis)] || 'bg-slate-500 text-white', label: degreeLabel(scale, n.semis) };
        return null;
      }}
    />
  );

  return (
    <div>
      <Header
        title={fmtTime(remaining)}
        onBack={finish}
        right={
          <button onClick={togglePause} aria-label={paused ? 'Weiter' : 'Pause'} className="w-12 h-12 rounded-2xl bg-slate-900 border-2 border-slate-800 flex items-center justify-center">
            {paused ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
          </button>
        }
      />
      <div className="-mt-3 mb-4">
        <ProgressBar value={elapsed / durationMs} />
      </div>
      {paused ? (
        <Card className="text-center py-12">
          <p className="text-3xl font-black mb-2">Pause</p>
          <div className="flex gap-3 mt-6">
            <button onClick={togglePause} className="flex-1 py-4 rounded-2xl bg-indigo-600 border-2 border-indigo-400 text-white font-black text-lg">
              Weiter
            </button>
            <button onClick={finish} className="flex-1 py-4 rounded-2xl bg-slate-800 border-2 border-slate-700 font-bold flex items-center justify-center gap-2">
              <Square className="w-4 h-4" /> Beenden
            </button>
          </div>
        </Card>
      ) : (
        <MicGate settings={settings} update={update}>
          {task && (
            <Split
              left={
                <Card className={`py-5 text-center ${feedback ? (feedback.correct ? 'border-emerald-500' : 'border-orange-500') : miss != null ? 'border-orange-500' : ''}`}>
                  {!feedback ? (
                    <>
                      <div className="text-6xl font-black leading-none">{taskTitle(task, naming, prefer)}</div>
                      <div className="text-3xl font-black text-indigo-300 mt-2">{task.shape}-Form</div>
                      <p className="text-slate-300 mt-3">
                        {index === 0
                          ? `Arpeggio ${settings.cagedFromRoot ? 'vom Grundton aus' : 'aufwärts'} · beginne mit Stufe ${degreeLabel(scale, task.seq[0].semis)}`
                          : `Ton ${index + 1} von ${task.seq.length} · Stufe ${degreeLabel(scale, expected.semis)}`}
                      </p>
                      <p className={`h-6 mt-1 font-bold ${miss != null ? 'text-orange-400' : 'text-slate-500 text-sm'}`}>
                        {miss != null ? `nicht ${noteName(miss, names)}` : misses ? `${misses} Fehlton` : ''}
                      </p>
                      {task.kind === 'new' && (
                        <span className="inline-block mt-1 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400 text-indigo-300 text-sm font-bold">neu</span>
                      )}
                    </>
                  ) : (
                    <div className="py-2">
                      <div className={`flex items-center justify-center gap-3 ${feedback.correct ? 'text-emerald-400' : 'text-orange-400'}`}>
                        {feedback.correct ? <Check className="w-10 h-10" strokeWidth={3} /> : <X className="w-10 h-10" strokeWidth={3} />}
                        <span className="text-3xl font-black">
                          {feedback.correct ? `${task.shape}-Form` : feedback.gaveUp ? 'Lösung' : hinted ? 'Mit Hilfe' : 'Zu viele Fehltöne'}
                        </span>
                        {feedback.correct && feedback.rt != null && (
                          <span className={`text-xl font-bold tabular ${feedback.rt <= FAST_SEC ? 'text-emerald-300' : 'text-slate-400'}`}>{fmtSec(feedback.rt)}</span>
                        )}
                      </div>
                      <p className="text-slate-300 mt-1">
                        {taskTitle(task, naming, prefer)} · {task.shape}-Form · Bund {task.pos.lo}–{task.pos.hi}
                      </p>
                    </div>
                  )}
                  <div className="landscape:hidden mt-4">{board}</div>
                </Card>
              }
              right={
                <>
                  <Card className="hidden landscape:block p-3">{board}</Card>
                  <MicAnswer
                    settings={settings}
                    task={{ id: armId.id, shownAt: armId.shownAt }}
                    armed={!feedback && running}
                    blockMidi={lastMidi.current}
                    onNote={onNote}
                    isCorrect={(m) => !!expected && Math.round(m) === expected.midi}
                  />
                  {!feedback && (
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => setHinted(true)}
                        disabled={hinted}
                        className="flex-1 py-3 rounded-2xl bg-slate-900 border-2 border-slate-800 text-slate-400 font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                      >
                        <Eye className="w-4 h-4" /> Form zeigen
                      </button>
                      <button
                        onClick={() => complete(false, true)}
                        className="flex-1 py-3 rounded-2xl bg-slate-900 border-2 border-slate-800 text-slate-400 font-bold flex items-center justify-center gap-2"
                      >
                        <SkipForward className="w-4 h-4" /> Weiter
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-slate-500 text-center mt-3">„Form zeigen“ hilft weiter, die Aufgabe zählt dann als nicht gekonnt.</p>
                </>
              }
            />
          )}
        </MicGate>
      )}
    </div>
  );
}

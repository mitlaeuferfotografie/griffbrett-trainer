// Tonarten-Übersicht: Grundton + Tonart/Skala wählen, das ganze Griffbrett (bis Bund 24)
// zeigt die Töne farbig mit Stufe (oder Tonname), alles andere ausgegraut.
// Dazu die Übung „Stufen finden“: „Spiel die 6 in G-Dur auf der D-Saite“.
import React, { useState, useRef, useEffect } from 'react';
import { Music, Check, X, Target, ArrowRightLeft, SlidersHorizontal, Zap } from 'lucide-react';
import { pcName } from '../lib/notes.js';
import { getTuning } from '../lib/tunings.js';
import { stringName } from '../lib/fretboard.js';
import { judge, validFrets } from '../lib/session.js';
import { addPractice, fmtSec } from '../lib/stats.js';
import {
  SCALES, getScale, spellScale, spellName, keyName, keySignature, relativeKey, degreeOf, degreeLabel, degreeRole,
} from '../lib/scales.js';
import { npsPattern, patternRange } from '../lib/patterns.js';
import { startMic } from '../audio/mic.js';
import { PatternRun } from './PatternRun.jsx';
import { useMicStatus } from '../ui/hooks.js';
import { Card, Header, MicGate, Segmented, Split, Collapsible, SelectField, namesOf } from '../ui/common.jsx';
import { Fretboard, MicAnswer, TapAnswer } from '../ui/board.jsx';

// Einfarbig (Standard): Muster auf einen Blick – alle Töne gleich, nur der Grundton hebt sich ab
const MONO_STYLE = {
  root: 'bg-amber-400 text-amber-950 ring-2 ring-amber-200',
  tone: 'bg-indigo-500 text-white',
};
// Stufenfarben: Grundton (gleiche Farbe wie bei „Einfarbig“), Terz, Quinte hervorgehoben
const ROLE_STYLE = {
  root: MONO_STYLE.root,
  third: 'bg-emerald-500 text-emerald-950',
  fifth: 'bg-sky-400 text-sky-950',
  other: 'bg-slate-500 text-white',
};
const QUIZ_LENGTH = 10;

const SCALE_GROUPS = [
  { label: 'Dur & Moll', ids: ['major', 'minor', 'harmonic', 'melodic'] },
  { label: 'Pentatonik & Blues', ids: ['pent-major', 'pent-minor', 'blues'] },
  { label: 'Kirchentonarten', ids: ['dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian'] },
];

export function ScalesView({ settings, update, progress, setProgress, onBack }) {
  const tuning = getTuning(settings.tuningId, settings.stringCount);
  const strings = tuning.strings;
  const names = namesOf(settings);
  const naming = settings.naming;
  const prefer = settings.accidentals === 'sharp' ? 'sharp' : 'flat';
  const rootPc = settings.scaleRoot ?? 7;
  const scale = getScale(settings.scaleId || 'major');
  const [labels, setLabels] = useState('degree'); // 'degree' | 'note' | 'none'
  const colors = settings.scaleColors || 'mono'; // 'mono' | 'degree'
  const styleFor = (semis) => (colors === 'mono' ? (semis === 0 ? MONO_STYLE.root : MONO_STYLE.tone) : ROLE_STYLE[degreeRole(semis)]);
  const [range, setRange] = useState(24);
  const [hidden, setHidden] = useState([]); // ausgeblendete Stufen (Halbtöne)
  const [quiz, setQuiz] = useState(false);
  const [run, setRun] = useState(false);
  const nps = settings.scalePattern === 3 || settings.scalePattern === 2 ? settings.scalePattern : null;
  const [position, setPosition] = useState(0);
  const pos = position % scale.steps.length;
  const pattern = nps ? npsPattern(strings, rootPc, scale, nps, pos) : null;
  const patternCells = pattern ? new Map(pattern.notes.map((n) => [`${n.string}:${n.fret}`, n])) : null;

  const spelled = spellScale(rootPc, scale, prefer);
  const bySemis = Object.fromEntries(spelled.map((n) => [n.semis, n]));
  const sig = keySignature(rootPc, scale, naming, prefer);
  const rel = relativeKey(rootPc, scale);
  const choose = (patch) => {
    setHidden([]);
    setPosition(0);
    update(patch);
  };

  const patternTitle = pattern
    ? `${keyName(rootPc, scale, naming, prefer)} · ${nps}NPS · Muster ${pos + 1} (ab Stufe ${degreeLabel(scale, scale.steps[pos])}, Bund ${patternRange(pattern).from}–${patternRange(pattern).to})`
    : '';

  if (run && pattern) {
    return (
      <PatternRun
        settings={settings}
        update={update}
        progress={progress}
        setProgress={setProgress}
        strings={strings}
        names={names}
        tuningId={tuning.id}
        rootPc={rootPc}
        scale={scale}
        nps={nps}
        position={pos}
        pattern={pattern}
        title={patternTitle}
        onBack={() => setRun(false)}
      />
    );
  }

  if (quiz) {
    return (
      <ScaleQuiz
        settings={settings}
        update={update}
        setProgress={setProgress}
        strings={strings}
        names={names}
        rootPc={rootPc}
        scale={scale}
        prefer={prefer}
        onBack={() => setQuiz(false)}
      />
    );
  }

  const labelName = { degree: 'Stufen', note: 'Tonnamen', none: 'ohne Beschriftung' }[labels];

  return (
    <div>
      <Header title="Tonarten" onBack={onBack} />

      {/* Auswahl kompakt: auf dem iPhone öffnet sich die Auswahl-Walze */}
      <div className="grid grid-cols-[6rem_1fr] landscape:grid-cols-[8rem_16rem] gap-2 mb-3">
        <SelectField label="Grundton" value={rootPc} onChange={(v) => choose({ scaleRoot: Number(v) })}>
          {Array.from({ length: 12 }, (_, p) => (
            <option key={p} value={p}>
              {pcName(p, { ...names, accidentals: 'both' })}
            </option>
          ))}
        </SelectField>
        <SelectField label="Tonart" value={scale.id} onChange={(v) => choose({ scaleId: v })}>
          {SCALE_GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.ids.map((id) => (
                <option key={id} value={id}>
                  {getScale(id).name}
                </option>
              ))}
            </optgroup>
          ))}
        </SelectField>
      </div>

      <Card className="p-3 mb-3">
        <div className="flex items-start justify-between gap-2 mb-2 px-1">
          <div className="min-w-0">
            <h2 className="text-2xl font-black leading-tight">{keyName(rootPc, scale, naming, prefer)}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {sig ? (sig.count ? `${sig.count} ${sig.type}: ${sig.notes.join(', ')}` : 'keine Vorzeichen') : `${scale.steps.length} Töne`}
            </p>
          </div>
          {rel && (
            <button
              onClick={() => choose({ scaleRoot: rel.rootPc, scaleId: rel.scaleId })}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950 border-2 border-slate-800 text-xs font-bold text-slate-300 flex-shrink-0"
              aria-label="Zur Paralleltonart wechseln"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              {keyName(rel.rootPc, getScale(rel.scaleId), naming, prefer)}
            </button>
          )}
        </div>
        {/* Töne der Tonart: antippen blendet die Stufe auf dem Griffbrett aus/ein */}
        <div className="flex flex-wrap gap-1 mb-3 px-1">
          {spelled.map((n) => {
            const off = hidden.includes(n.semis);
            return (
              <button
                key={n.semis}
                onClick={() => setHidden(off ? hidden.filter((x) => x !== n.semis) : [...hidden, n.semis])}
                className={`min-w-[2.6rem] px-1.5 py-1 rounded-lg text-center transition-opacity ${styleFor(n.semis)} ${off ? 'opacity-25' : ''}`}
              >
                <div className="text-[10px] font-bold leading-tight">{n.label}</div>
                <div className="text-sm font-black leading-tight">{spellName(n.letter, n.acc, naming)}</div>
              </button>
            );
          })}
        </div>
        <div className="mb-3 px-1">
          <Segmented
            options={[
              { value: 'all', label: 'Ganzes Griffbrett' },
              { value: 3, label: '3NPS' },
              { value: 2, label: '2NPS' },
            ]}
            value={nps || 'all'}
            onChange={(v) => update({ scalePattern: v })}
          />
          {pattern && (
            <>
              <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1">
                {scale.steps.map((st, i) => (
                  <button
                    key={i}
                    onClick={() => setPosition(i)}
                    className={`flex-shrink-0 min-w-[2.75rem] px-2 py-1.5 rounded-xl border-2 text-center ${
                      i === pos ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="text-sm font-black leading-tight">{i + 1}</div>
                    <div className="text-[10px] leading-tight opacity-80">ab {degreeLabel(scale, st)}</div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Muster {pos + 1}: beginnt mit Stufe {degreeLabel(scale, scale.steps[pos])} auf der tiefsten Saite · Bund {patternRange(pattern).from}–{patternRange(pattern).to}
                {nps === 3 && scale.steps.length !== 7 ? ' · 3NPS ist für siebentönige Tonleitern gedacht' : ''}
                {nps === 2 && scale.steps.length === 7 ? ' · 2NPS passt vor allem zu Pentatoniken' : ''}
              </p>
            </>
          )}
        </div>
        <Fretboard
          strings={strings}
          fretMax={pattern && patternRange(pattern).to <= 12 ? 12 : range}
          names={names}
          withOpen
          size="md"
          cell={(s, f) => {
            const semis = degreeOf(rootPc, scale, strings[s] + f);
            if (semis == null || hidden.includes(semis)) return null;
            if (patternCells && !patternCells.has(`${s}:${f}`)) return { className: 'bg-slate-600', small: true };
            const n = bySemis[semis];
            return {
              className: styleFor(semis),
              label: labels === 'degree' ? degreeLabel(scale, semis) : labels === 'note' ? spellName(n.letter, n.acc, naming) : '',
            };
          }}
        />
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 mt-3 px-1">
          {(colors === 'mono'
            ? [
                [MONO_STYLE.root, 'Grundton'],
                [MONO_STYLE.tone, 'Töne der Tonart'],
              ]
            : [
                [ROLE_STYLE.root, 'Grundton'],
                [ROLE_STYLE.third, 'Terz'],
                [ROLE_STYLE.fifth, 'Quinte'],
                [ROLE_STYLE.other, 'übrige Stufen'],
              ]
          ).map(([cls, l]) => (
            <span key={l} className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded-full ${cls}`} />
              {l}
            </span>
          ))}
          <span className="text-slate-500">· Töne oben antippen blendet sie aus</span>
        </div>
      </Card>

      <Collapsible title="Anzeige" icon={SlidersHorizontal} summary={`${colors === 'mono' ? 'Einfarbig' : 'Stufenfarben'} · ${labelName} · bis Bund ${range}`}>
        <div className="space-y-2">
          <Segmented options={[{ value: 'mono', label: 'Einfarbig' }, { value: 'degree', label: 'Stufenfarben' }]} value={colors} onChange={(v) => update({ scaleColors: v })} />
          <Segmented
            options={[
              { value: 'degree', label: 'Stufen' },
              { value: 'note', label: 'Töne' },
              { value: 'none', label: 'Ohne' },
            ]}
            value={labels}
            onChange={setLabels}
          />
          <Segmented options={[{ value: 12, label: 'bis Bund 12' }, { value: 24, label: 'bis Bund 24' }]} value={range} onChange={setRange} />
        </div>
      </Collapsible>

      {pattern && (
        <button
          onClick={() => {
            if (settings.micExplained) startMic();
            setRun(true);
          }}
          className="w-full py-4 mb-3 rounded-3xl bg-indigo-600 border-2 border-indigo-400 text-white font-black text-lg flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <Zap className="w-6 h-6 flex-shrink-0" />
          <span className="text-left leading-tight">
            Üben: Muster spielen
            <span className="block text-sm font-bold text-indigo-100">
              {nps}NPS · Muster {pos + 1} · auf- und abwärts
            </span>
          </span>
        </button>
      )}

      <button
        onClick={() => {
          if (settings.micExplained) startMic();
          setQuiz(true);
        }}
        className="w-full py-4 rounded-3xl bg-indigo-600 border-2 border-indigo-400 text-white font-black text-lg flex items-center justify-center gap-2 active:scale-95 transition-transform"
      >
        <Target className="w-6 h-6 flex-shrink-0" />
        <span className="text-left leading-tight">
          Üben: Stufen finden
          <span className="block text-sm font-bold text-indigo-100">{keyName(rootPc, scale, naming, prefer)}</span>
        </span>
      </button>
    </div>
  );
}

// ==========================================
// ÜBUNG: STUFEN FINDEN
// ==========================================

function makeQuizTask(strings, rootPc, scale, fretMax, last) {
  for (let tries = 0; tries < 20; tries++) {
    const semis = scale.steps[Math.floor(Math.random() * scale.steps.length)];
    const string = Math.floor(Math.random() * strings.length);
    if (last && last.semis === semis && last.string === string) continue;
    const pc = (rootPc + semis) % 12;
    const frets = validFrets(strings, string, pc, fretMax).filter((f) => f >= 1);
    if (!frets.length) continue;
    return { semis, string, pc, fret: frets[0], frets };
  }
  return null;
}

function ScaleQuiz({ settings, update, setProgress, strings, names, rootPc, scale, prefer, onBack }) {
  const naming = settings.naming;
  const fretMax = settings.fretMax;
  const mic = useMicStatus();
  const [inputMode, setInputMode] = useState('mic');
  const [task, setTask] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [results, setResults] = useState([]);
  const ids = useRef(0);
  const lastMidi = useRef(null);
  const timer = useRef(null);
  const started = useRef(Date.now());
  const visible = inputMode === 'tap' || mic.status === 'running';
  const spelled = spellScale(rootPc, scale, prefer);
  const noteOf = (semis) => {
    const n = spelled.find((x) => x.semis === semis);
    return spellName(n.letter, n.acc, naming);
  };
  const key = keyName(rootPc, scale, naming, prefer);

  const next = (prev) => {
    const t = makeQuizTask(strings, rootPc, scale, fretMax, prev);
    ids.current += 1;
    setFeedback(null);
    setTask(t && { ...t, id: ids.current, shownAt: performance.now() });
  };

  useEffect(() => {
    next(null);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const done = results.length >= QUIZ_LENGTH && !feedback;
  useEffect(() => {
    if (done) setProgress((p) => addPractice(p, Date.now(), { sec: Math.round((Date.now() - started.current) / 1000) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const answer = (midi, rtMs) => {
    if (!task || feedback) return;
    const res = midi == null ? { correct: false, playedFret: null } : judge(strings, task, midi, fretMax);
    if (midi != null) lastMidi.current = midi;
    const rt = midi == null ? null : rtMs / 1000;
    setFeedback({ ...res, midi, rt });
    setResults((r) => [...r, { correct: res.correct, rt }]);
    timer.current = setTimeout(() => {
      setFeedback(null);
      if (results.length + 1 < QUIZ_LENGTH) next(task);
    }, res.correct ? 1200 : 2800);
  };

  if (done) {
    const ok = results.filter((r) => r.correct).length;
    const rts = results.filter((r) => r.correct && r.rt != null).map((r) => r.rt);
    return (
      <div>
        <Header title="Stufen finden" onBack={onBack} />
        <Card className="text-center py-8 mb-4">
          <p className="text-slate-400 mb-1">{key}</p>
          <p className="text-6xl font-black tabular">
            {ok}/{QUIZ_LENGTH}
          </p>
          <p className="text-slate-400 mt-2">{rts.length ? `Ø ${fmtSec(rts.reduce((a, b) => a + b, 0) / rts.length)}` : ''}</p>
        </Card>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setResults([]);
              started.current = Date.now();
              if (settings.micExplained && inputMode === 'mic') startMic();
              next(null);
            }}
            className="flex-1 py-4 rounded-2xl bg-indigo-600 border-2 border-indigo-400 text-white font-black active:scale-95 transition-transform"
          >
            Nochmal
          </button>
          <button onClick={onBack} className="flex-1 py-4 rounded-2xl bg-slate-800 border-2 border-slate-700 font-bold active:scale-95 transition-transform">
            Zur Tonart
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Stufen finden" onBack={onBack} right={<span className="text-slate-400 font-bold tabular">{Math.min(results.length + 1, QUIZ_LENGTH)}/{QUIZ_LENGTH}</span>} />
      <Split
        left={
      visible && task && (
        <Card className={`py-6 ${feedback ? (feedback.correct ? 'border-emerald-500' : 'border-orange-500') : ''}`}>
          {!feedback ? (
            <div className="text-center">
              <div className="font-black leading-none tracking-tight text-slate-50 text-[6.5rem]">{degreeLabel(scale, task.semis)}</div>
              <div className="text-2xl font-bold text-slate-300 mt-3">in {key}</div>
              <div className="text-xl text-slate-400">auf der {stringName(strings, task.string, names, { dative: true })}</div>
            </div>
          ) : (
            <div className="text-center">
              <div className={`flex items-center justify-center gap-3 ${feedback.correct ? 'text-emerald-400' : 'text-orange-400'}`}>
                {feedback.correct ? <Check className="w-10 h-10" strokeWidth={3} /> : <X className="w-10 h-10" strokeWidth={3} />}
                <span className="text-3xl font-black">
                  {degreeLabel(scale, task.semis)} = {noteOf(task.semis)}
                </span>
              </div>
              <p className="text-slate-300 mt-1">
                Bund {task.frets.join(' / ')}
                {feedback.correct && feedback.rt != null ? ` · ${fmtSec(feedback.rt)}` : ''}
              </p>
              <div className="mt-4 landscape:hidden">
                <Fretboard
                  strings={strings}
                  fretMax={fretMax}
                  names={names}
                  highlightString={task.string}
                  cell={(s, f) => {
                    if (s === task.string && task.frets.includes(f)) return { className: ROLE_STYLE[degreeRole(task.semis)], label: degreeLabel(scale, task.semis) };
                    if (!feedback.correct && s === task.string && f === feedback.playedFret) return { className: 'bg-orange-500 text-orange-950' };
                    return null;
                  }}
                />
              </div>
            </div>
          )}
        </Card>
      )
        }
        right={
          <>
            {feedback && task && (
              <Card className="hidden landscape:block p-3">
                <Fretboard
                  strings={strings}
                  fretMax={fretMax}
                  names={names}
                  highlightString={task.string}
                  cell={(s, f) => {
                    if (s === task.string && task.frets.includes(f)) return { className: ROLE_STYLE[degreeRole(task.semis)], label: degreeLabel(scale, task.semis) };
                    if (!feedback.correct && s === task.string && f === feedback.playedFret) return { className: 'bg-orange-500 text-orange-950' };
                    return null;
                  }}
                />
              </Card>
            )}
            {inputMode === 'mic' ? (
              <MicGate settings={settings} update={update} onTapMode={() => setInputMode('tap')}>
                <MicAnswer
                  settings={settings}
                  task={task}
                  armed={!feedback}
                  blockMidi={lastMidi.current}
                  onNote={answer}
                  isCorrect={(m) => !!task && judge(strings, task, m, fretMax).correct}
                />
              </MicGate>
            ) : (
              !feedback && <TapAnswer strings={strings} fretMax={fretMax} names={names} task={task} armed={!feedback} onNote={answer} />
            )}
            {visible && task && !feedback && (
              <button onClick={() => answer(null, 0)} className="w-full mt-4 py-3 rounded-2xl bg-slate-900 border-2 border-slate-800 text-slate-400 font-bold">
                Lösung zeigen
              </button>
            )}
            <p className="text-xs text-slate-500 text-center mt-3 flex items-center justify-center gap-1.5">
              <Music className="w-3.5 h-3.5" /> Zählt nicht im Lernstand.
            </p>
          </>
        }
      />
    </div>
  );
}

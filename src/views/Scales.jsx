// Tonarten-Übersicht: Grundton + Tonart/Skala wählen, das ganze Griffbrett (bis Bund 24)
// zeigt die Töne farbig mit Stufe (oder Tonname), alles andere ausgegraut.
// Dazu die Übung „Stufen finden“: „Spiel die 6 in G-Dur auf der D-Saite“.
import React, { useState, useRef, useEffect } from 'react';
import { Music, Check, X, Target, ArrowRightLeft } from 'lucide-react';
import { pcName } from '../lib/notes.js';
import { getTuning } from '../lib/tunings.js';
import { stringName } from '../lib/fretboard.js';
import { judge, validFrets } from '../lib/session.js';
import { addPractice, fmtSec } from '../lib/stats.js';
import {
  SCALES, getScale, spellScale, spellName, keyName, keySignature, relativeKey, degreeOf, degreeLabel, degreeRole,
} from '../lib/scales.js';
import { startMic } from '../audio/mic.js';
import { useMicStatus } from '../ui/hooks.js';
import { Card, Header, MicGate, Segmented, namesOf } from '../ui/common.jsx';
import { Fretboard, MicAnswer, TapAnswer } from '../ui/board.jsx';

const ROLE_STYLE = {
  root: 'bg-indigo-500 text-white',
  third: 'bg-emerald-500 text-emerald-950',
  fifth: 'bg-amber-300 text-amber-950',
  other: 'bg-slate-500 text-white',
};
const OUT_STYLE = 'bg-slate-800/40 text-transparent';
const QUIZ_LENGTH = 10;

const SCALE_GROUPS = [
  { label: 'Dur & Moll', ids: ['major', 'minor', 'harmonic', 'melodic'] },
  { label: 'Pentatonik & Blues', ids: ['pent-major', 'pent-minor', 'blues'] },
  { label: 'Kirchentonarten', ids: ['dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian'] },
];

function Chip({ active, onClick, children, className = '' }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded-xl border-2 text-sm font-bold transition-colors ${
        active ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-300'
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function ScalesView({ settings, update, setProgress, onBack }) {
  const tuning = getTuning(settings.tuningId, settings.stringCount);
  const strings = tuning.strings;
  const names = namesOf(settings);
  const naming = settings.naming;
  const prefer = settings.accidentals === 'sharp' ? 'sharp' : 'flat';
  const rootPc = settings.scaleRoot ?? 7;
  const scale = getScale(settings.scaleId || 'major');
  const [labels, setLabels] = useState('degree'); // 'degree' | 'note'
  const [range, setRange] = useState(24);
  const [hidden, setHidden] = useState([]); // ausgeblendete Stufen (Halbtöne)
  const [quiz, setQuiz] = useState(false);

  const spelled = spellScale(rootPc, scale, prefer);
  const bySemis = Object.fromEntries(spelled.map((n) => [n.semis, n]));
  const sig = keySignature(rootPc, scale, naming, prefer);
  const rel = relativeKey(rootPc, scale);
  const choose = (patch) => {
    setHidden([]);
    update(patch);
  };

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

  return (
    <div>
      <Header title="Tonarten" onBack={onBack} />

      <Card className="mb-4">
        <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-2">Grundton</p>
        <div className="grid grid-cols-6 gap-1.5 mb-4">
          {Array.from({ length: 12 }, (_, p) => (
            <button
              key={p}
              onClick={() => choose({ scaleRoot: p })}
              className={`py-2 rounded-xl border-2 font-black ${pcName(p, { ...names, accidentals: 'both' }).length > 3 ? 'text-[11px]' : 'text-base'} ${
                p === rootPc ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-300'
              }`}
            >
              {pcName(p, { ...names, accidentals: 'both' })}
            </button>
          ))}
        </div>
        {SCALE_GROUPS.map((g) => (
          <div key={g.label} className="mb-3">
            <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-2">{g.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {g.ids.map((id) => (
                <Chip key={id} active={scale.id === id} onClick={() => choose({ scaleId: id })}>
                  {getScale(id).name}
                </Chip>
              ))}
            </div>
          </div>
        ))}
      </Card>

      <Card className="mb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-3xl font-black">{keyName(rootPc, scale, naming, prefer)}</h2>
            <p className="text-sm text-slate-400 mt-1">
              {sig ? (sig.count ? `${sig.count} ${sig.type}: ${sig.notes.join(', ')}` : 'keine Vorzeichen') : `${scale.steps.length} Töne`}
            </p>
          </div>
          {rel && (
            <button
              onClick={() => choose({ scaleRoot: rel.rootPc, scaleId: rel.scaleId })}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 border-2 border-slate-800 text-sm font-bold text-slate-300 flex-shrink-0"
            >
              <ArrowRightLeft className="w-4 h-4" />
              {keyName(rel.rootPc, getScale(rel.scaleId), naming, prefer)}
            </button>
          )}
        </div>
        {/* Töne der Tonart: antippen blendet die Stufe auf dem Griffbrett aus/ein */}
        <div className="flex flex-wrap gap-1.5">
          {spelled.map((n) => {
            const off = hidden.includes(n.semis);
            return (
              <button
                key={n.semis}
                onClick={() => setHidden(off ? hidden.filter((x) => x !== n.semis) : [...hidden, n.semis])}
                className={`min-w-[3rem] px-2 py-1.5 rounded-xl text-center transition-opacity ${ROLE_STYLE[degreeRole(n.semis)]} ${off ? 'opacity-25' : ''}`}
              >
                <div className="text-xs font-bold leading-tight">{n.label}</div>
                <div className="text-base font-black leading-tight">{spellName(n.letter, n.acc, naming)}</div>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-500 mt-2">Antippen blendet eine Stufe aus – z. B. nur Grundtöne zeigen.</p>
      </Card>

      <button
        onClick={() => {
          if (settings.micExplained) startMic();
          setQuiz(true);
        }}
        className="w-full py-4 mb-4 rounded-3xl bg-indigo-600 border-2 border-indigo-400 text-white font-black text-lg flex items-center justify-center gap-2 active:scale-95 transition-transform"
      >
        <Target className="w-5 h-5" /> Üben: Stufen finden in {keyName(rootPc, scale, naming, prefer)}
      </button>

      <Card className="p-3">
        <div className="flex gap-2 mb-3">
          <div className="flex-1">
            <Segmented options={[{ value: 'degree', label: 'Stufen' }, { value: 'note', label: 'Töne' }]} value={labels} onChange={setLabels} />
          </div>
          <div className="flex-1">
            <Segmented options={[{ value: 12, label: 'bis 12' }, { value: 24, label: 'bis 24' }]} value={range} onChange={setRange} />
          </div>
        </div>
        <Fretboard
          strings={strings}
          fretMax={range}
          names={names}
          withOpen
          rowClass={range > 12 ? 'h-6' : 'h-8'}
          cell={(s, f) => {
            const semis = degreeOf(rootPc, scale, strings[s] + f);
            if (semis == null || hidden.includes(semis)) return { className: OUT_STYLE };
            const n = bySemis[semis];
            return {
              className: ROLE_STYLE[degreeRole(semis)],
              label: labels === 'degree' ? degreeLabel(scale, semis) : spellName(n.letter, n.acc, naming),
            };
          }}
        />
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 mt-3">
          {[
            ['root', 'Grundton'],
            ['third', 'Terz'],
            ['fifth', 'Quinte'],
            ['other', 'übrige Stufen'],
          ].map(([k, l]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded ${ROLE_STYLE[k]}`} />
              {l}
            </span>
          ))}
        </div>
      </Card>
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
      {visible && task && (
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
              <div className="mt-4">
                <Fretboard
                  strings={strings}
                  fretMax={fretMax}
                  names={names}
                  rowClass={fretMax > 12 ? 'h-3.5' : 'h-5'}
                  cell={(s, f) => {
                    if (s === task.string && task.frets.includes(f)) return { className: ROLE_STYLE[degreeRole(task.semis)], label: degreeLabel(scale, task.semis) };
                    if (!feedback.correct && s === task.string && f === feedback.playedFret) return { className: 'bg-orange-500 text-orange-950' };
                    return { className: s === task.string ? 'bg-slate-800' : 'bg-slate-800/30' };
                  }}
                />
              </div>
            </div>
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
      {visible && task && !feedback && (
        <button onClick={() => answer(null, 0)} className="w-full mt-4 py-3 rounded-2xl bg-slate-900 border-2 border-slate-800 text-slate-400 font-bold">
          Lösung zeigen
        </button>
      )}
      <p className="text-xs text-slate-500 text-center mt-3 flex items-center justify-center gap-1.5">
        <Music className="w-3.5 h-3.5" /> Zählt nicht im Lernstand.
      </p>
    </div>
  );
}

// „Tonlauf“: Töne laufen auf ihrer Saite (waagerecht, dicke Saite unten) von rechts auf die
// Trefferlinie links zu und müssen im richtigen Moment gespielt werden – wie beim Tab-Lesen.
// Wird schneller, je mehr man trifft. Zählt nicht im Lernstand (Zeitdruck), nur die Übungszeit.
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Pause, Play, Trophy } from 'lucide-react';
import { pcName, noteName } from '../lib/notes.js';
import { getTuning } from '../lib/tunings.js';
import { buildGroups, computeUnlocked, activePositions } from '../lib/curriculum.js';
import { judge } from '../lib/session.js';
import { addPractice } from '../lib/stats.js';
import {
  ZONE, LIVES, fallMs, spawnGapMs, rateTiming, autoStartLevel, buildPool, pickNote, createRun,
  registerHit, registerMiss, registerWrong,
} from '../lib/arcade.js';
import { startMic } from '../audio/mic.js';
import { createAnswerGate } from '../audio/answer.js';
import { TRACKER_ANSWER } from '../audio/detector.js';
import { useMicStatus, useMicFrames, useTracker } from '../ui/hooks.js';
import { Card, Header, MicGate, Segmented, namesOf } from '../ui/common.jsx';

const LABEL_X = 7; // Saiten beginnen hier (% der Breite), links davon die Saitennamen
const LINE_X = 16; // Trefferlinie (% der Breite)
/** x-Position (%) eines Tons beim Fortschritt p (0 = rechts, 1 = Trefferlinie, darüber links davon) */
const xOf = (p) => LINE_X + (1 - p) * (96 - LINE_X);
const MAX_ON_SCREEN = 4;

export function ArcadeView({ settings, update, progress, setProgress, onBack }) {
  const tuning = getTuning(settings.tuningId, settings.stringCount);
  const strings = tuning.strings;
  const names = namesOf(settings);
  const fretMax = settings.fretMax;
  const mic = useMicStatus();
  const tracker = useTracker(settings, TRACKER_ANSWER);

  const [phase, setPhase] = useState('setup'); // setup | play | over
  const [mode, setMode] = useState('learned');
  const [tempo, setTempo] = useState('auto');
  const [paused, setPaused] = useState(false);
  const [, setFrame] = useState(0);
  const [result, setResult] = useState(null);
  const game = useRef(null);
  const ids = useRef(0);

  const bests = progress.bests.arcade || {};
  const positions = useMemo(() => {
    const groups = buildGroups(strings);
    const unlocked = computeUnlocked(groups, strings, fretMax, progress.units, progress.unlocked[tuning.id] || 1);
    const manual = settings.groupMode === 'manual' ? settings.manualGroups : null;
    return activePositions(groups, strings, fretMax, { unlocked, manual });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strings, fretMax, phase]);
  const pool = useMemo(
    () => buildPool(mode, { strings, fretMax, positions, units: progress.units }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, strings, fretMax, positions],
  );
  const autoLevel = autoStartLevel(progress.units, pool, bests[mode]?.level || 0);

  const running = phase === 'play' && !paused && mic.status === 'running';

  const popup = (g, text, string, tone) => {
    ids.current += 1;
    g.popups.push({ id: ids.current, text, string, tone, at: g.time });
  };

  const endGame = () => {
    const g = game.current;
    const run = g.run;
    const prev = bests[mode] || { score: 0, level: 0 };
    const isBest = run.score > prev.score;
    setProgress((p) => {
      const arcade = { ...(p.bests.arcade || {}) };
      arcade[mode] = { score: Math.max(prev.score, run.score), level: Math.max(prev.level, run.maxLevel) };
      return addPractice({ ...p, bests: { ...p.bests, arcade } }, Date.now(), { sec: Math.round(g.time / 1000) });
    });
    setResult({ run, isBest, prev });
    setPhase('over');
  };

  // Spielschleife
  useEffect(() => {
    if (!running) return undefined;
    let raf = 0;
    let prev = performance.now();
    const step = (now) => {
      const g = game.current;
      const dt = Math.min(100, now - prev);
      prev = now;
      g.time += dt;
      const live = g.notes.filter((n) => n.state === 'live');
      if (g.time >= g.nextSpawn && live.length < MAX_ON_SCREEN) {
        const note = pickNote(pool, g.last);
        if (note) {
          ids.current += 1;
          g.notes.push({ ...note, id: ids.current, t0: g.time, fall: fallMs(g.run.level), state: 'live' });
          g.last = note;
        }
        g.nextSpawn = g.time + spawnGapMs(g.run.level);
      }
      for (const n of g.notes) {
        if (n.state === 'live' && (g.time - n.t0) / n.fall > ZONE.late) {
          n.state = 'miss';
          n.doneAt = g.time;
          const before = g.run.level;
          g.run = registerMiss(g.run);
          popup(g, g.run.level < before ? `verpasst · Stufe ${g.run.level}` : 'verpasst', n.string, 'miss');
        }
      }
      g.notes = g.notes.filter((n) => n.state === 'live' || g.time - n.doneAt < 450);
      g.popups = g.popups.filter((p) => g.time - p.at < 900);
      if (g.run.lives <= 0) {
        endGame();
        return;
      }
      setFrame((f) => f + 1);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, pool]);

  // Gespielte Töne
  // Richtiger Ton zählt sofort, falscher erst nach kurzem stabilem Klang (Slides/Geräusche)
  const gate = useMemo(() => createAnswerGate({ holdWrongMs: 250 }), []);

  // Nachklang-Sperre: derselbe Ton zählt erst nach neuem Anschlag wieder
  const heard = useRef({ midi: null, onset: false });

  useMicFrames((frame) => {
    let u = tracker.update(frame);
    if (u.onset) heard.current.onset = true;
    if (u.event) {
      if (u.event.midi === heard.current.midi && !heard.current.onset) u = { ...u, event: null };
      else heard.current = { midi: u.event.midi, onset: false };
    }
    if (!running || !game.current) return;
    const g = game.current;
    const target = g.notes.filter((n) => n.state === 'live').sort((a, b) => a.t0 - b.t0)[0];
    if (!target) {
      gate.reset();
      return;
    }
    const answer = gate.update(u, frame.time, (m) => {
      const r = judge(strings, target, m, fretMax);
      return r.correct && r.playedFret >= 1;
    });
    if (!answer) return;
    const p = (g.time - target.t0) / target.fall;
    const correct = answer.correct;
    const q = rateTiming(p);
    if (correct && (q === 'good' || q === 'perfect')) {
      const before = g.run.level;
      const r = registerHit(g.run, q);
      g.run = r.run;
      target.state = 'hit';
      target.doneAt = g.time;
      popup(g, `${q === 'perfect' ? 'Perfekt' : 'Gut'} +${r.gained}`, target.string, 'hit');
      if (g.run.level > before) popup(g, `Stufe ${g.run.level}`, null, 'level');
    } else if (correct) {
      popup(g, 'zu früh', target.string, 'info');
    } else if (p >= 0.35) {
      g.run = registerWrong(g.run);
      popup(g, `${noteName(answer.midi, names)}?`, target.string, 'miss');
    }
  });

  const start = () => {
    if (mic.status !== 'running') startMic();
    const level = tempo === 'auto' ? autoLevel : tempo;
    game.current = { time: 0, nextSpawn: 800, notes: [], popups: [], last: null, run: createRun(level) };
    tracker.reset();
    setPaused(false);
    setResult(null);
    setPhase('play');
  };

  // ---------- Auswahl ----------
  if (phase === 'setup') {
    return (
      <div>
        <Header title="Tonlauf" onBack={onBack} />
        <Card className="mb-4">
          <p className="text-slate-300 text-sm mb-4">
            Töne laufen auf ihrer Saite von rechts auf die Linie zu – dicke Saite unten, wie auf dem Griffbrett. Spiel sie, wenn sie die helle Zone erreichen; nahe der Linie ist „perfekt“. Je mehr du triffst, desto schneller wird es. Fünf durchgerutschte Töne beenden die Runde, falsche Töne nur die Serie. Zählt nicht im Lernstand.
          </p>
          <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-2">Töne</p>
          <Segmented
            options={[{ value: 'learned', label: 'Freigeschaltete' }, { value: 'naturals', label: 'Alle natürlichen' }]}
            value={mode}
            onChange={setMode}
          />
          <p className="text-xs text-slate-500 mt-1.5 mb-4">{pool.length} Positionen im Vorrat</p>
          <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-2">Start-Tempo</p>
          <Segmented
            options={[
              { value: 'auto', label: `Auto (${autoLevel})` },
              { value: 1, label: 'Ruhig' },
              { value: 4, label: 'Mittel' },
              { value: 7, label: 'Schnell' },
            ]}
            value={tempo}
            onChange={setTempo}
          />
          <p className="text-xs text-slate-500 mt-1.5">Automatisch: nach deinem Fortschritt und der bisher erreichten Stufe.</p>
        </Card>
        {bests[mode] && (
          <p className="flex items-center justify-center gap-2 text-sm text-slate-400 mb-4 tabular">
            <Trophy className="w-4 h-4" /> Bestwert {bests[mode].score.toLocaleString('de-DE')} · höchste Stufe {bests[mode].level}
          </p>
        )}
        <button onClick={start} className="w-full py-5 rounded-3xl bg-indigo-600 border-2 border-indigo-400 text-white font-black text-2xl active:scale-95 transition-transform">
          Los
        </button>
      </div>
    );
  }

  // ---------- Ergebnis ----------
  if (phase === 'over') {
    const { run, isBest, prev } = result;
    return (
      <div>
        <Header title="Tonlauf" onBack={onBack} />
        <Card className="text-center py-8 mb-4">
          <p className="text-slate-400 mb-1">Punkte</p>
          <p className="text-6xl font-black tabular">{run.score.toLocaleString('de-DE')}</p>
          <p className={`mt-2 font-bold ${isBest ? 'text-emerald-400' : 'text-slate-400'}`}>
            {isBest ? (prev.score ? `Neuer Bestwert (bisher ${prev.score.toLocaleString('de-DE')})` : 'Erster Bestwert') : `Bestwert: ${prev.score.toLocaleString('de-DE')}`}
          </p>
        </Card>
        <div className="grid grid-cols-3 gap-2 mb-4 text-center">
          {[
            ['Treffer', run.hits],
            ['perfekt', run.perfect],
            ['beste Serie', run.maxCombo],
            ['Start-Stufe', run.startLevel],
            ['höchste Stufe', run.maxLevel],
            ['verpasst', run.misses],
          ].map(([k, v]) => (
            <div key={k} className="bg-slate-900 border-2 border-slate-800 rounded-2xl p-3">
              <div className="text-2xl font-black tabular">{v}</div>
              <div className="text-xs text-slate-400">{k}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={start} className="flex-1 py-4 rounded-2xl bg-indigo-600 border-2 border-indigo-400 text-white font-black active:scale-95 transition-transform">
            Nochmal
          </button>
          <button onClick={() => setPhase('setup')} className="flex-1 py-4 rounded-2xl bg-slate-800 border-2 border-slate-700 font-bold active:scale-95 transition-transform">
            Einstellungen
          </button>
        </div>
      </div>
    );
  }

  // ---------- Spiel ----------
  const g = game.current;
  const run = g.run;
  const n = strings.length;
  /** y-Position (%) der Saite: hohe oben, dicke unten */
  const rowTop = (s) => ((n - 1 - s + 0.5) / n) * 100;
  return (
    <div>
      <Header
        title={run.score.toLocaleString('de-DE')}
        onBack={endGame}
        right={
          <button
            onClick={() => setPaused(!paused)}
            aria-label={paused ? 'Weiter' : 'Pause'}
            className="w-12 h-12 rounded-2xl bg-slate-900 border-2 border-slate-800 flex items-center justify-center"
          >
            {paused ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
          </button>
        }
      />
      <div className="flex items-center justify-between -mt-2 mb-3 text-sm">
        <span className="font-bold">Stufe {run.level}</span>
        <span className="text-slate-400 tabular">{run.combo >= 3 ? `Serie ${run.combo}` : ''}</span>
        <span className="flex gap-1">
          {Array.from({ length: LIVES }, (_, i) => (
            <span key={i} className={`w-2.5 h-2.5 rounded-full ${i < run.lives ? 'bg-indigo-400' : 'bg-slate-800'}`} />
          ))}
        </span>
      </div>
      <MicGate settings={settings} update={update}>
        <div
          className="relative rounded-3xl bg-slate-900 border-2 border-slate-800 overflow-hidden select-none"
          style={{ height: 'clamp(220px, 55vh, 380px)' }}
        >
          {/* Trefferzone und -linie (links, wie der Sattel) */}
          <div className="absolute inset-y-0 bg-indigo-500/10" style={{ left: `${xOf(ZONE.late)}%`, width: `${xOf(ZONE.early) - xOf(ZONE.late)}%` }} />
          <div className="absolute inset-y-0 bg-indigo-400/15" style={{ left: `${xOf(ZONE.late)}%`, width: `${xOf(ZONE.perfect) - xOf(ZONE.late)}%` }} />
          <div className="absolute inset-y-0 w-1.5 bg-slate-300" style={{ left: `${LINE_X}%` }} />
          {/* Saiten: hohe oben, dicke unten */}
          {strings.map((m, s) => {
            const px = 1 + (1 - s / Math.max(1, n - 1)) * 2.2;
            return (
              <React.Fragment key={s}>
                <div
                  className="absolute right-0 bg-slate-500"
                  style={{ left: `${LABEL_X}%`, top: `calc(${rowTop(s)}% - ${px / 2}px)`, height: px }}
                />
                <div
                  className="absolute -translate-y-1/2 text-sm font-black text-slate-400"
                  style={{ left: '2%', top: `${rowTop(s)}%` }}
                >
                  {noteName(m, names)}
                </div>
              </React.Fragment>
            );
          })}
          {/* Töne laufen von rechts auf die Linie zu */}
          {g.notes.map((note) => {
            const p = note.state === 'live' ? (g.time - note.t0) / note.fall : (note.doneAt - note.t0) / note.fall;
            const inZone = p >= ZONE.early;
            const label = pcName(note.pc, names);
            const cls =
              note.state === 'hit'
                ? 'bg-emerald-500 text-emerald-950 scale-125 opacity-0'
                : note.state === 'miss'
                  ? 'bg-orange-500 text-orange-950 opacity-0'
                  : inZone
                    ? 'bg-indigo-500 text-white ring-2 ring-indigo-200'
                    : 'bg-slate-600 text-white';
            return (
              <div
                key={note.id}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center font-black shadow-lg transition-[opacity,transform,background-color] duration-300 ${
                  n > 6 ? 'w-9 h-9' : 'w-11 h-11'
                } ${label.length > 3 ? 'text-[10px]' : 'text-lg'} ${cls}`}
                style={{ left: `${xOf(Math.min(p, 1.2))}%`, top: `${rowTop(note.string)}%` }}
              >
                {label}
              </div>
            );
          })}
          {/* Rückmeldungen */}
          {g.popups.map((pp) => (
            <div
              key={pp.id}
              className={`absolute -translate-y-1/2 whitespace-nowrap text-sm font-black pointer-events-none ${
                pp.tone === 'hit' ? 'text-emerald-400' : pp.tone === 'miss' ? 'text-orange-400' : pp.tone === 'level' ? 'text-indigo-300 text-lg' : 'text-slate-300'
              }`}
              style={{
                left: pp.string == null ? '45%' : `${LINE_X + 6 + ((g.time - pp.at) / 900) * 4}%`,
                top: pp.string == null ? '50%' : `${rowTop(pp.string) - 100 / n / 2}%`,
                opacity: 1 - (g.time - pp.at) / 900,
              }}
            >
              {pp.text}
            </div>
          ))}
          {paused && (
            <div className="absolute inset-0 bg-slate-950/70 flex flex-col items-center justify-center gap-4">
              <p className="text-3xl font-black">Pause</p>
              <div className="flex gap-3">
                <button onClick={() => setPaused(false)} className="px-6 py-3 rounded-2xl bg-indigo-600 border-2 border-indigo-400 text-white font-black">
                  Weiter
                </button>
                <button onClick={endGame} className="px-6 py-3 rounded-2xl bg-slate-800 border-2 border-slate-700 font-bold">
                  Beenden
                </button>
              </div>
            </div>
          )}
        </div>
      </MicGate>
    </div>
  );
}

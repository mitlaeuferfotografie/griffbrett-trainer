// „Fallende Töne“: Töne fallen in der Spur ihrer Saite (dicke Saite links) auf die
// Trefferlinie zu und müssen im richtigen Moment gespielt werden. Wird schneller,
// je mehr man trifft. Zählt nicht im Lernstand (Zeitdruck), nur die Übungszeit.
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
import { useMicStatus, useMicFrames, useTracker } from '../ui/hooks.js';
import { Card, Header, MicGate, Segmented, namesOf } from '../ui/common.jsx';

const LINE = 84; // Trefferlinie in % der Spielfeldhöhe
const MAX_ON_SCREEN = 4;

export function ArcadeView({ settings, update, progress, setProgress, onBack }) {
  const tuning = getTuning(settings.tuningId, settings.stringCount);
  const strings = tuning.strings;
  const names = namesOf(settings);
  const fretMax = settings.fretMax;
  const mic = useMicStatus();
  const tracker = useTracker(settings);

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
  useMicFrames((frame) => {
    const u = tracker.update(frame);
    if (!u.event || !running || !game.current) return;
    const g = game.current;
    const target = g.notes.filter((n) => n.state === 'live').sort((a, b) => a.t0 - b.t0)[0];
    if (!target) return;
    const p = (g.time - target.t0) / target.fall;
    const correct = judge(strings, target, u.event.midi, fretMax).correct;
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
      popup(g, `${noteName(u.event.midi, names)}?`, target.string, 'miss');
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
        <Header title="Fallende Töne" onBack={onBack} />
        <Card className="mb-4">
          <p className="text-slate-300 text-sm mb-4">
            Töne fallen in der Spur ihrer Saite nach unten. Spiel sie, wenn sie die helle Zone erreichen – nahe der Linie ist „perfekt“. Je mehr du triffst, desto schneller wird es. Fünf durchgerutschte Töne beenden die Runde, falsche Töne nur die Serie. Zählt nicht im Lernstand.
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
        <Header title="Fallende Töne" onBack={onBack} />
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
        <div className="relative h-[62vh] rounded-3xl bg-slate-900 border-2 border-slate-800 overflow-hidden select-none">
          {/* Spuren, dicke Saite links */}
          <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
            {strings.map((_, s) => (
              <div key={s} className="border-r border-slate-800 last:border-r-0" />
            ))}
          </div>
          {/* Trefferzone und -linie */}
          <div className="absolute inset-x-0 bg-indigo-500/10" style={{ top: `${ZONE.early * LINE}%`, height: `${(ZONE.late - ZONE.early) * LINE}%` }} />
          <div className="absolute inset-x-0 bg-indigo-400/15" style={{ top: `${ZONE.perfect * LINE}%`, height: `${(ZONE.late - ZONE.perfect) * LINE}%` }} />
          <div className="absolute inset-x-0 h-1 bg-slate-300" style={{ top: `${LINE}%` }} />
          {/* Saitennamen unter der Linie */}
          <div className="absolute inset-x-0 bottom-0 grid pb-2" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
            {strings.map((m, s) => (
              <div key={s} className="text-center text-sm font-black text-slate-400">
                {noteName(m, names)}
              </div>
            ))}
          </div>
          {/* Töne */}
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
                    : 'bg-slate-700 text-slate-100';
            return (
              <div
                key={note.id}
                className={`absolute w-12 h-12 -ml-6 -mt-6 rounded-xl flex items-center justify-center font-black shadow-lg transition-[opacity,transform,background-color] duration-300 ${
                  label.length > 3 ? 'text-xs' : 'text-xl'
                } ${cls}`}
                style={{ left: `${((note.string + 0.5) / n) * 100}%`, top: `${Math.min(p, 1.2) * LINE}%` }}
              >
                {label}
              </div>
            );
          })}
          {/* Rückmeldungen */}
          {g.popups.map((pp) => (
            <div
              key={pp.id}
              className={`absolute -translate-x-1/2 whitespace-nowrap text-sm font-black pointer-events-none ${
                pp.tone === 'hit' ? 'text-emerald-400' : pp.tone === 'miss' ? 'text-orange-400' : pp.tone === 'level' ? 'text-indigo-300 text-lg' : 'text-slate-300'
              }`}
              style={{
                left: pp.string == null ? '50%' : `${Math.min(80, Math.max(20, ((pp.string + 0.5) / n) * 100))}%`,
                top: pp.string == null ? '35%' : `${LINE - 12 - ((g.time - pp.at) / 900) * 8}%`,
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

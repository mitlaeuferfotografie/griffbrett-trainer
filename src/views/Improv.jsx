// Ausbaustufe 3: „Was spiele ich da eigentlich?“ – frei improvisieren, die App zeigt live die
// Stufen und die geschätzte Lage; am Ende Auswertung in Klartext. Aufgezeichnet werden nur
// erkannte Tonhöhen mit Zeitpunkt (kein Audio). Zählt nicht im Lernstand, nur als Übungszeit.
import React, { useState, useRef, useEffect } from 'react';
import { Square, Play, Sparkles, RotateCcw, Headphones } from 'lucide-react';
import { noteName, pcName, pitchClass } from '../lib/notes.js';
import { getTuning } from '../lib/tunings.js';
import { positionsForMidi } from '../lib/fretboard.js';
import { degreeLabel, getScale } from '../lib/scales.js';
import { describePlaying, degreeWeights, shares, guessRoot, estimatePath, POSITION_PREFS } from '../lib/analysis.js';
import { addPractice, fmtSec } from '../lib/stats.js';
import { startMic, setFastMode } from '../audio/mic.js';
import { TRACKER_FAST } from '../audio/detector.js';
import { useMicFrames, useTracker, useMicStatus } from '../ui/hooks.js';
import { Card, Header, MicGate, Split, SelectField, Segmented, namesOf } from '../ui/common.jsx';
import { Fretboard, fmtTime } from '../ui/board.jsx';

const GENERIC = ['1', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'];
const TRAIL = 8;

function Histogram({ weights, highlight }) {
  const sh = shares(weights);
  const max = Math.max(0.0001, ...sh);
  return (
    <div className="flex items-end gap-1 h-24">
      {sh.map((v, s) => (
        <div key={s} className="flex-1 flex flex-col items-center justify-end h-full">
          <div
            className={`w-full rounded-t ${s === 0 ? 'bg-amber-400' : highlight && !highlight.includes(s) ? 'bg-orange-500' : 'bg-indigo-500'}`}
            style={{ height: `${(v / max) * 100}%`, minHeight: v > 0 ? 3 : 0 }}
          />
          <span className="text-[10px] font-bold text-slate-400 mt-1">{GENERIC[s]}</span>
        </div>
      ))}
    </div>
  );
}

export function ImprovView({ settings, update, setProgress, onBack }) {
  const tuning = getTuning(settings.tuningId, settings.stringCount);
  const strings = tuning.strings;
  const names = namesOf(settings);
  const mic = useMicStatus();
  const tracker = useTracker(settings, TRACKER_FAST);
  // schneller Modus (kurzes Messfenster) nur, solange diese Ansicht offen ist
  useEffect(() => {
    setFastMode(true);
    return () => setFastMode(false);
  }, []);
  const [rootChoice, setRootChoice] = useState(settings.improvRoot ?? 'auto');
  const posPref = settings.improvPosition || 'auto';
  const posPrefRef = useRef(posPref);
  posPrefRef.current = posPref;
  const [phase, setPhase] = useState('home'); // home | live | result
  const [events, setEvents] = useState([]);
  const [trail, setTrail] = useState([]); // geschätzte Positionen [{ string, fret, midi }]
  const [startAt, setStartAt] = useState(null);
  const [now, setNow] = useState(0);
  const [result, setResult] = useState(null);
  const eventsRef = useRef([]);
  const trailRef = useRef([]);

  useEffect(() => {
    if (phase !== 'live' || startAt == null) return undefined;
    const id = setInterval(() => setNow(performance.now()), 500);
    return () => clearInterval(id);
  }, [phase, startAt]);

  useMicFrames((frame) => {
    const u = tracker.update(frame);
    if (phase !== 'live' || !u.event) return;
    const midi = u.event.midi;
    const ev = { midi, time: frame.time };
    eventsRef.current = [...eventsRef.current, ev];
    trailRef.current = estimateTrail(eventsRef.current, posPrefRef.current);
    if (startAt == null) setStartAt(frame.time);
    setEvents(eventsRef.current);
    setTrail(trailRef.current);
  });

  // Lage über die letzten 16 Töne als Phrase schätzen (wenige Lagenwechsel, optional Vorgabe)
  const estimateTrail = (evs, pref) => {
    const recent = evs.slice(-16);
    const path = estimatePath(recent.map((e) => e.midi), (m) => positionsForMidi(strings, m, 24), pref);
    return path.map((p, i) => p && { ...p, midi: recent[i].midi }).filter(Boolean).slice(-TRAIL);
  };
  const choosePosition = (v) => {
    update({ improvPosition: v });
    posPrefRef.current = v;
    trailRef.current = estimateTrail(eventsRef.current, v);
    setTrail(trailRef.current);
  };
  const posOptions = Object.entries(POSITION_PREFS)
    .filter(([k]) => k !== 'top')
    .map(([value, p]) => ({ value, label: p.label }));

  const auto = rootChoice === 'auto';
  const liveRoot = auto ? (events.length >= 8 ? guessRoot(events) : null) : Number(rootChoice);

  const begin = () => {
    if (settings.micExplained) startMic();
    setFastMode(true);
    tracker.reset();
    eventsRef.current = [];
    trailRef.current = [];
    setEvents([]);
    setTrail([]);
    setStartAt(null);
    setResult(null);
    setPhase('live');
  };

  const stop = () => {
    const ev = eventsRef.current;
    const rootPc = auto ? guessRoot(ev) : Number(rootChoice);
    const sec = ev.length ? Math.round((ev[ev.length - 1].time - ev[0].time) / 1000) : 0;
    if (sec > 0) setProgress((p) => addPractice(p, Date.now(), { sec }));
    setResult({ rootPc, ...describePlaying(ev, rootPc), count: ev.length, sec });
    setPhase('result');
  };

  const chooseRoot = (v) => {
    setRootChoice(v);
    update({ improvRoot: v });
  };

  // ---------- Start ----------
  if (phase === 'home') {
    return (
      <div>
        <Header title="Improvisieren" onBack={onBack} />
        <Card className="mb-3">
          <p className="text-slate-300 text-sm">
            Spiel frei, wie du es sonst auch tust. Die App zeigt live, welche <b>Stufen</b> du über dem Grundton spielst und wo auf dem Griffbrett du wahrscheinlich bist. Am Ende sagt sie dir, welche Tonleiter bzw. welchen Modus du gespielt hast – und welche Töne du nie nutzt.
          </p>
          <p className="text-slate-400 text-xs mt-3 flex items-start gap-2">
            <Headphones className="w-4 h-4 flex-shrink-0 mt-0.5" />
            Einstimmig spielen (keine Akkorde). Begleitung nur über Kopfhörer – sonst hört das Mikrofon sie mit.
          </p>
        </Card>
        <div className="mb-3">
          <p className="text-[11px] uppercase tracking-widest text-slate-400 font-bold mb-1">Lage auf dem Griffbrett</p>
          <Segmented options={posOptions} value={posPref} onChange={choosePosition} />
          <p className="text-xs text-slate-500 mt-1">Derselbe Ton liegt an mehreren Stellen. „Auto“ schätzt die Lage aus deiner Phrase; spielst du meist hoch, wähle „Hoch“.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <SelectField label="Grundton" value={rootChoice} onChange={chooseRoot}>
            <option value="auto">Automatisch</option>
            {Array.from({ length: 12 }, (_, p) => (
              <option key={p} value={p}>
                {pcName(p, { ...names, accidentals: 'both' })}
              </option>
            ))}
          </SelectField>
        </div>
        <button
          onClick={begin}
          className="w-full py-5 rounded-3xl bg-indigo-600 border-2 border-indigo-400 text-white font-black text-2xl flex items-center justify-center gap-3 active:scale-95 transition-transform"
        >
          <Play className="w-7 h-7" fill="currentColor" /> Los
        </button>
      </div>
    );
  }

  // ---------- Auswertung ----------
  if (phase === 'result') {
    const best = result.best7;
    const scale = best ? best.scale : getScale('minor');
    const sh = shares(result.weights);
    return (
      <div>
        <Header title="Auswertung" onBack={onBack} />
        <Split
          left={
            <>
              <Card className="mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                  <p className="font-black text-lg">
                    Grundton {pcName(result.rootPc, names)}
                    {auto ? ' (erkannt)' : ''}
                  </p>
                </div>
                <div className="space-y-2 text-slate-200">
                  {result.lines.map((l) => (
                    <p key={l}>{l}</p>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-3">
                  {result.count} Töne · {fmtSec(result.sec)}
                </p>
              </Card>
              <Card className="mb-3">
                <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-2">Stufen (nach Dauer gewichtet)</p>
                <Histogram weights={result.weights} highlight={best ? scale.steps : null} />
                <p className="text-[11px] text-slate-500 mt-2">Gelb = Grundton, indigo = in {scale.name}, orange = außerhalb.</p>
              </Card>
            </>
          }
          right={
            <>
              {best && (
                <Card className="p-3 mb-3">
                  <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-2 px-1">
                    {pcName(result.rootPc, names)} {scale.name} – gespielt / nie gespielt
                  </p>
                  <Fretboard
                    strings={strings}
                    fretMax={24}
                    names={names}
                    withOpen
                    size="sm"
                    cell={(s, f) => {
                      const semis = (((pitchClass(strings[s] + f) - result.rootPc) % 12) + 12) % 12;
                      if (!scale.steps.includes(semis)) return null;
                      if (sh[semis] < 0.02) return { className: 'bg-slate-600', small: true };
                      return { className: semis === 0 ? 'bg-amber-400 text-amber-950' : 'bg-indigo-500 text-white', label: degreeLabel(scale, semis) };
                    }}
                  />
                </Card>
              )}
              <div className="flex gap-3">
                <button onClick={begin} className="flex-1 py-4 rounded-2xl bg-indigo-600 border-2 border-indigo-400 text-white font-black flex items-center justify-center gap-2">
                  <RotateCcw className="w-5 h-5" /> Nochmal
                </button>
                <button onClick={() => setPhase('home')} className="flex-1 py-4 rounded-2xl bg-slate-800 border-2 border-slate-700 font-bold">
                  Fertig
                </button>
              </div>
            </>
          }
        />
      </div>
    );
  }

  // ---------- Live ----------
  const last = events[events.length - 1];
  const lastDegree = last && liveRoot != null ? (((pitchClass(last.midi) - liveRoot) % 12) + 12) % 12 : null;
  const elapsed = startAt == null ? 0 : now - startAt;
  const weights = liveRoot != null ? degreeWeights(events, liveRoot) : null;
  const currentCands = last ? positionsForMidi(strings, last.midi, 24) : [];
  const head = trail[trail.length - 1];
  // Ausschnitt von 12 Bünden, der der gespielten Lage folgt
  const played = trail.filter((p) => p.fret > 0).map((p) => p.fret);
  const lo = played.length ? Math.min(...played) : 0;
  const winFrom = Math.max(0, Math.min(lo - 2, 24 - 12));
  const liveRange = [winFrom, winFrom + 12];

  return (
    <div>
      <Header
        title={fmtTime(elapsed)}
        onBack={stop}
        right={
          <button onClick={stop} className="px-4 h-12 rounded-2xl bg-slate-900 border-2 border-slate-800 font-bold flex items-center gap-2">
            <Square className="w-4 h-4" /> Auswerten
          </button>
        }
      />
      <MicGate settings={settings} update={update}>
        <Split
          left={
            <Card className="text-center py-6">
              <p className="text-xs uppercase tracking-widest text-slate-500">
                {liveRoot != null ? `Grundton ${pcName(liveRoot, names)}${auto ? ' (geschätzt)' : ''}` : 'Grundton wird erkannt …'}
              </p>
              <div className={`font-black leading-none mt-2 ${lastDegree === 0 ? 'text-amber-400' : 'text-slate-50'} text-[6.5rem]`}>
                {lastDegree != null ? GENERIC[lastDegree] : last ? noteName(last.midi, names) : '–'}
              </div>
              <p className="text-slate-400 font-bold mt-1 h-6">{last ? noteName(last.midi, names, { octave: true }) : 'Spiel los'}</p>
              {weights && (
                <div className="mt-4 px-2">
                  <Histogram weights={weights} />
                </div>
              )}
              <p className="text-xs text-slate-500 mt-2">{events.length} Töne</p>
            </Card>
          }
          right={
            <Card className="p-3 mt-4 landscape:mt-0">
              <div className="mb-2">
                <Segmented options={posOptions} value={posPref} onChange={choosePosition} />
              </div>
              <p className="text-xs text-slate-400 mb-2 px-1">Geschätzte Lage (letzte {TRAIL} Töne), andere mögliche Stellen blass</p>
              <Fretboard
                strings={strings}
                fretMax={24}
                range={liveRange}
                names={names}
                withOpen
                size="sm"
                cell={(s, f) => {
                  const idx = trail.findIndex((p) => p.string === s && p.fret === f);
                  if (idx >= 0) {
                    const p = trail[idx];
                    const deg = liveRoot != null ? (((pitchClass(p.midi) - liveRoot) % 12) + 12) % 12 : null;
                    const isHead = p === head;
                    const age = trail.length - 1 - idx;
                    const fade = ['', 'opacity-90', 'opacity-75', 'opacity-60', 'opacity-50', 'opacity-40', 'opacity-30', 'opacity-25'][Math.min(age, 7)];
                    return {
                      className: `${deg === 0 ? 'bg-amber-400 text-amber-950' : 'bg-indigo-500 text-white'} ${isHead ? 'ring-2 ring-indigo-200' : fade}`,
                      label: deg != null ? GENERIC[deg] : noteName(p.midi, names),
                    };
                  }
                  if (currentCands.some((c) => c.string === s && c.fret === f)) return { className: 'bg-slate-500', small: true };
                  return null;
                }}
              />
            </Card>
          }
        />
      </MicGate>
    </div>
  );
}

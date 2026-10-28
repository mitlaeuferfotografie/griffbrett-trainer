// CAGED-Ansicht (Reiter Tonarten): Grundton + Dur/Moll wählen, die fünf Formen C-A-G-E-D
// entlang des Halses. Je Form drei Schichten: Griff → Arpeggio (1-3-5) → Tonleiter im Lage-Fenster.
// „Alle“ zeigt jede Form in eigener Farbe; eine einzelne Form wird hervorgehoben, der Rest
// des Halses bleibt als kleine Punkte zur Orientierung. Arpeggio/Tonleiter einer Form lassen
// sich mit „Muster spielen“ (PatternRun) üben.
import React, { useState } from 'react';
import { Zap, SlidersHorizontal } from 'lucide-react';
import { pcName } from '../lib/notes.js';
import { getTuning } from '../lib/tunings.js';
import { stringName } from '../lib/fretboard.js';
import { getScale, spellScale, spellName, degreeLabel, degreeRole, keyName } from '../lib/scales.js';
import { cagedPositions, scaleInPosition, playOrder, rootOfGrip, QUALITIES } from '../lib/caged.js';
import { startMic } from '../audio/mic.js';
import { PatternRun } from './PatternRun.jsx';
import { Card, Segmented, Collapsible, SelectField, namesOf } from '../ui/common.jsx';
import { Fretboard } from '../ui/board.jsx';

// feste Farbe je Form (Ansicht „Alle“)
export const SHAPE_STYLE = {
  C: 'bg-rose-500 text-white',
  A: 'bg-sky-400 text-sky-950',
  G: 'bg-emerald-500 text-emerald-950',
  E: 'bg-violet-500 text-white',
  D: 'bg-orange-400 text-orange-950',
};
const ROLE_STYLE = {
  root: 'bg-amber-400 text-amber-950 ring-2 ring-amber-200',
  third: 'bg-emerald-500 text-emerald-950',
  fifth: 'bg-sky-400 text-sky-950',
  other: 'bg-slate-500 text-white',
};
const LAYERS = [
  { value: 'grip', label: 'Griff' },
  { value: 'arp', label: 'Arpeggio' },
  { value: 'scale', label: 'Tonleiter' },
];

export function CagedView({ settings, update, progress, setProgress, top }) {
  const tuning = getTuning(settings.tuningId, settings.stringCount);
  const strings = tuning.strings;
  const names = namesOf(settings);
  const naming = settings.naming;
  const prefer = settings.accidentals === 'sharp' ? 'sharp' : 'flat';
  const rootPc = settings.cagedRoot ?? 0;
  const quality = settings.cagedQuality === 'minor' ? 'minor' : 'major';
  const q = QUALITIES[quality];
  const scaleIdx = settings.cagedScale === 1 ? 1 : 0;
  const scale = getScale(q.scales[scaleIdx]);
  const [layer, setLayer] = useState('arp');
  const [labels, setLabels] = useState('degree'); // 'degree' | 'note'
  const [range, setRange] = useState(15);
  const [sel, setSel] = useState('all'); // 'all' | Lage-Schlüssel "E:5"
  const [run, setRun] = useState(false);

  const positions = cagedPositions(strings, rootPc, quality, range);
  const visiblePos = positions;
  const current = sel === 'all' ? null : positions.find((p) => p.key === sel) || null;
  const spelled = spellScale(rootPc, scale, prefer);
  const nameOf = (semis) => {
    const n = spelled.find((x) => x.semis === semis);
    return n ? spellName(n.letter, n.acc, naming) : pcName((rootPc + semis) % 12, names);
  };
  const labelOf = (n) => (labels === 'degree' ? degreeLabel(scale, n.semis) : nameOf(n.semis));
  const chordName = keyName(rootPc, getScale(quality), naming, prefer);
  const choose = (patch) => {
    setSel('all');
    update(patch);
  };

  const layerNotes = (p) => (layer === 'grip' ? p.grip : layer === 'arp' ? p.arp : scaleInPosition(strings, p, rootPc, scale));

  if (run && current) {
    const notes = playOrder(layerNotes(current));
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
        pattern={{ notes, startFret: current.lo }}
        bestKey={`caged:${tuning.id}:${rootPc}:${quality}:${current.key}:${layer === 'scale' ? scale.id : 'arp'}`}
        heading={layer === 'scale' ? 'Tonleiter spielen' : 'Arpeggio spielen'}
        title={`${chordName} · ${current.id}-Form · Bund ${current.lo}–${current.hi}${layer === 'scale' ? ` · ${scale.name}` : ''}`}
        labelOf={(n) => degreeLabel(scale, n.semis)}
        onBack={() => setRun(false)}
      />
    );
  }

  if (!positions.length) {
    return (
      <div>
        {top}
        <Card>
          <p className="text-slate-300">CAGED gilt für die Standardstimmung (bei 7 Saiten für die oberen sechs). Mit {tuning.name} verschieben sich die Formen – stell in den Einstellungen Standard ein, um CAGED zu sehen.</p>
        </Card>
      </div>
    );
  }

  // Zelle → Ton der aktuellen Schicht; bei „Alle“ die erste Form, deren Schicht den Ton enthält
  const cellMap = new Map();
  const pool = current ? [current] : visiblePos;
  // Überlappung zweier Lagen: Ton gehört zur Form, deren Griff ihn enthält, sonst zur nächstgelegenen Lage
  const rank = (p, n) => (p.grip.some((g) => g.string === n.string && g.fret === n.fret) ? -1 : Math.abs(n.fret - (p.lo + p.hi) / 2));
  for (const p of pool) {
    for (const n of layerNotes(p)) {
      const k = `${n.string}:${n.fret}`;
      const prev = cellMap.get(k);
      if (!prev || rank(p, n) < rank(prev.p, n)) cellMap.set(k, { n, p });
    }
  }
  // Orientierung bei Einzelform: Dreiklangstöne im übrigen Hals
  const context = new Set();
  if (current) for (const p of positions) for (const n of p.arp) context.add(`${n.string}:${n.fret}`);
  // „bis 15“: ein durchgehender Hals (ganzer CAGED-Kreis), sonst wie üblich 12 bzw. 24 in zwei Hälften
  const boardProps = range === 15 ? { fretMax: 15, range: [0, 15] } : { fretMax: range };
  const root = current ? rootOfGrip(current) : null;

  return (
    <div>
      {top}
      <div className="grid grid-cols-[6rem_1fr] landscape:grid-cols-[8rem_16rem] gap-2 mb-3">
        <SelectField label="Grundton" value={rootPc} onChange={(v) => choose({ cagedRoot: Number(v) })}>
          {Array.from({ length: 12 }, (_, p) => (
            <option key={p} value={p}>
              {pcName(p, { ...names, accidentals: 'both' })}
            </option>
          ))}
        </SelectField>
        <div className="flex items-end">
          <div className="w-full">
            <Segmented
              options={[
                { value: 'major', label: 'Dur' },
                { value: 'minor', label: 'Moll' },
              ]}
              value={quality}
              onChange={(v) => choose({ cagedQuality: v })}
            />
          </div>
        </div>
      </div>

      <Card className="p-3 mb-3">
        <div className="px-1 mb-2">
          <h2 className="text-2xl font-black leading-tight">
            {chordName}
            {current && <span className="text-slate-400"> · {current.id}-Form</span>}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {current
              ? `Bund ${current.lo}–${current.hi} · Grundton auf der ${stringName(strings, root.string, names, { dative: true })}, Bund ${root.fret}`
              : `Reihenfolge entlang des Halses: ${visiblePos.slice(0, 5).map((p) => p.id).join(' – ')} – wiederholt sich nach 12 Bünden`}
          </p>
        </div>

        {/* Formen in Hals-Reihenfolge */}
        <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 px-1">
          <button
            onClick={() => setSel('all')}
            className={`flex-shrink-0 px-3 py-1.5 rounded-xl border-2 font-black text-sm ${sel === 'all' ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-300'}`}
          >
            Alle
          </button>
          {visiblePos.map((p) => (
            <button
              key={p.key}
              onClick={() => setSel(p.key)}
              className={`flex-shrink-0 min-w-[3.25rem] px-2 py-1 rounded-xl border-2 text-center ${
                sel === p.key ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-center gap-1 text-sm font-black leading-tight">
                <span className={`w-2.5 h-2.5 rounded-full ${SHAPE_STYLE[p.id].split(' ')[0]}`} />
                {p.id}
              </div>
              <div className="text-[10px] leading-tight opacity-80 tabular">
                {p.lo}–{p.hi}
              </div>
            </button>
          ))}
        </div>

        <div className="mb-3 px-1">
          <Segmented options={LAYERS} value={layer} onChange={setLayer} />
          {layer === 'scale' && (
            <div className="mt-2">
              <Segmented
                options={q.scales.map((id, i) => ({ value: i, label: getScale(id).name }))}
                value={scaleIdx}
                onChange={(v) => update({ cagedScale: v })}
              />
            </div>
          )}
        </div>

        <Fretboard
          strings={strings}
          {...boardProps}
          names={names}
          withOpen
          size="md"
          cell={(s, f) => {
            const hit = cellMap.get(`${s}:${f}`);
            if (hit) {
              const cls = current ? ROLE_STYLE[degreeRole(hit.n.semis)] : `${SHAPE_STYLE[hit.p.id]}${hit.n.semis === 0 ? ' ring-2 ring-white' : ''}`;
              return { className: cls, label: labelOf(hit.n) };
            }
            if (context.has(`${s}:${f}`)) return { className: 'bg-slate-700', small: true };
            return null;
          }}
        />
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 mt-3 px-1">
          {(current
            ? [
                [ROLE_STYLE.root, 'Grundton'],
                [ROLE_STYLE.third, 'Terz'],
                [ROLE_STYLE.fifth, 'Quinte'],
                ...(layer === 'scale' ? [[ROLE_STYLE.other, 'übrige Stufen']] : []),
              ]
            : ['C', 'A', 'G', 'E', 'D'].map((id) => [SHAPE_STYLE[id], `${id}-Form`])
          ).map(([cls, l]) => (
            <span key={l} className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded-full ${cls}`} />
              {l}
            </span>
          ))}
          {!current && <span className="text-slate-500">· weißer Ring = Grundton</span>}
        </div>
      </Card>

      <Collapsible title="Anzeige" icon={SlidersHorizontal} summary={`${labels === 'degree' ? 'Stufen' : 'Tonnamen'} · bis Bund ${range}`}>
        <div className="space-y-2">
          <Segmented
            options={[
              { value: 'degree', label: 'Stufen' },
              { value: 'note', label: 'Töne' },
            ]}
            value={labels}
            onChange={setLabels}
          />
          <Segmented
            options={[
              { value: 12, label: 'bis Bund 12' },
              { value: 15, label: 'bis 15' },
              { value: 24, label: 'bis 24' },
            ]}
            value={range}
            onChange={setRange}
          />
        </div>
      </Collapsible>

      {current ? (
        <button
          onClick={() => {
            if (settings.micExplained) startMic();
            setRun(true);
          }}
          className="w-full py-4 rounded-3xl bg-indigo-600 border-2 border-indigo-400 text-white font-black text-lg flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <Zap className="w-6 h-6 flex-shrink-0" />
          <span className="text-left leading-tight">
            Üben: {layer === 'scale' ? 'Tonleiter' : 'Arpeggio'} spielen
            <span className="block text-sm font-bold text-indigo-100">
              {current.id}-Form · Bund {current.lo}–{current.hi} · auf- und abwärts
            </span>
          </span>
        </button>
      ) : (
        <p className="text-xs text-slate-500 text-center">Form oben antippen, um sie einzeln zu sehen und zu üben.</p>
      )}
    </div>
  );
}

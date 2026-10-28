// Tonart-Finder: Bünde antippen → mögliche Tonarten, in denen alle gewählten Töne vorkommen.
// Tipp auf ein Ergebnis zeigt die Tonart in der Übersicht („Anzeigen“).
import React, { useState } from 'react';
import { ChevronRight, RotateCcw } from 'lucide-react';
import { noteName, pcName, pitchClass } from '../lib/notes.js';
import { findKeys, keyName, spellScale, spellName } from '../lib/scales.js';
import { Card, Segmented } from '../ui/common.jsx';
import { Fretboard } from '../ui/board.jsx';

// selected/setSelected kommen von außen, damit die Auswahl beim Wechsel zur Anzeige erhalten bleibt
export function KeyFinder({ strings, names, naming, prefer, onShow, selected, setSelected }) {
  const [range, setRange] = useState(12);
  const midis = Object.values(selected);
  const pcs = [...new Set(midis.map((m) => pitchClass(m)))];
  const bass = midis.length ? Math.min(...midis) : null;
  const bassPc = bass == null ? null : pitchClass(bass);
  const results = findKeys(pcs, bassPc);

  const toggle = (s, f) => {
    const key = `${s}:${f}`;
    setSelected((sel) => {
      const next = { ...sel };
      if (next[key] != null) delete next[key];
      else next[key] = strings[s] + f;
      return next;
    });
  };

  return (
    <div>
      <Card className="p-3 mb-3">
        <p className="text-sm text-slate-300 px-1 mb-2">
          Tippe die Töne an, die du spielst (z. B. ein Riff oder eine Phrase). Der tiefste Ton gilt als Basston und macht Tonarten mit diesem Grundton wahrscheinlicher.
        </p>
        <div className="flex gap-2 mb-3 px-1">
          <div className="flex-1">
            <Segmented options={[{ value: 12, label: 'bis Bund 12' }, { value: 24, label: 'bis Bund 24' }]} value={range} onChange={setRange} />
          </div>
          <button
            onClick={() => setSelected({})}
            disabled={!midis.length}
            className="px-3 rounded-2xl bg-slate-950 border-2 border-slate-800 text-slate-300 font-bold text-sm flex items-center gap-1.5 disabled:opacity-40"
          >
            <RotateCcw className="w-4 h-4" /> Leeren
          </button>
        </div>
        <Fretboard
          strings={strings}
          fretMax={range}
          names={names}
          withOpen
          size="lg"
          cell={(s, f) => {
            const m = selected[`${s}:${f}`];
            if (m == null) return null;
            return { className: m === bass ? 'bg-amber-400 text-amber-950' : 'bg-indigo-500 text-white', label: noteName(m, names) };
          }}
          onCell={toggle}
        />
        <div className="flex flex-wrap gap-1.5 mt-3 px-1 min-h-[1.75rem]">
          {pcs.length ? (
            pcs.map((p) => (
              <span key={p} className={`px-2.5 py-1 rounded-lg text-sm font-black ${p === bassPc ? 'bg-amber-400 text-amber-950' : 'bg-indigo-500 text-white'}`}>
                {pcName(p, names)}
              </span>
            ))
          ) : (
            <span className="text-sm text-slate-500">Noch keine Töne gewählt.</span>
          )}
        </div>
      </Card>

      {pcs.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-2 ml-1">
            {results.length && !results[0].missing.length ? 'Passende Tonarten' : 'Keine Tonart enthält alle Töne – beste Treffer'}
          </p>
          <div className="rounded-3xl border-2 border-slate-800 bg-slate-900 overflow-hidden divide-y divide-slate-800">
            {results.map((r) => {
              const spelled = spellScale(r.rootPc, r.scale, prefer);
              const extraNames = r.extra.map((semis) => {
                const n = spelled.find((x) => x.semis === semis);
                return spellName(n.letter, n.acc, naming);
              });
              return (
                <button
                  key={`${r.scale.id}:${r.rootPc}`}
                  onClick={() => onShow(r.rootPc, r.scale.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-800/60"
                >
                  <span className="flex-1 min-w-0">
                    <span className="block font-black">{keyName(r.rootPc, r.scale, naming, prefer)}</span>
                    <span className="block text-xs text-slate-400">
                      {r.missing.length
                        ? `bis auf ${r.missing.map((p) => pcName(p, names)).join(', ')}`
                        : `enthält alle ${pcs.length} Töne`}
                      {extraNames.length ? ` · dazu ${extraNames.join(', ')}` : ' · genau diese Töne'}
                    </span>
                  </span>
                  <ChevronRight className="w-5 h-5 text-slate-500 flex-shrink-0" />
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-500 mt-2 ml-1">Antippen zeigt die Tonart auf dem ganzen Griffbrett.</p>
        </div>
      )}
    </div>
  );
}

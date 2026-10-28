// Fortschritt: Heatmap des Griffbretts, Kennzahlen, Übungskalender, Bestwerte, Meilensteine.
import React, { useState } from 'react';
import { CalendarDays, Trophy, Flag } from 'lucide-react';
import { noteName } from '../lib/notes.js';
import { getTuning } from '../lib/tunings.js';
import { stringName } from '../lib/fretboard.js';
import { status, isDue, INTERVAL_DAYS, daysBetween, dayKey } from '../lib/srs.js';
import { buildGroups, computeUnlocked, unlockProgress, groupLabel, allPositions } from '../lib/curriculum.js';
import {
  calendar, countStatus, weekDays, WEEK_GOAL_DAYS, CALENDAR_DAYS, milestoneDefs, fmtSec, shiftDays,
} from '../lib/stats.js';
import { Card, Header, namesOf } from '../ui/common.jsx';
import { Fretboard, Legend, ProgressBar, STATUS_STYLE, STATUS_LABEL } from '../ui/board.jsx';

function dueText(unit, now) {
  if (!unit || !unit.last) return '';
  if (isDue(unit, now)) return 'fällig';
  const left = INTERVAL_DAYS[unit.box] - daysBetween(dayKey(unit.last), dayKey(now));
  return left === 1 ? 'fällig morgen' : `fällig in ${left} Tagen`;
}

export function UnlockCard({ settings, progress, compact }) {
  const tuning = getTuning(settings.tuningId, settings.stringCount);
  const strings = tuning.strings;
  const names = namesOf(settings);
  const groups = buildGroups(strings);
  if (settings.groupMode === 'manual') {
    return compact ? null : <p className="text-sm text-slate-400">Manuelle Auswahl aktiv (Einstellungen).</p>;
  }
  const unlocked = computeUnlocked(groups, strings, settings.fretMax, progress.units, progress.unlocked[tuning.id] || 1);
  const next = unlockProgress(groups, strings, settings.fretMax, progress.units, unlocked);
  if (!next) return <p className="text-sm text-slate-400">Alle Stufen freigeschaltet.</p>;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-slate-400">
          Stufe {unlocked} von {groups.length} · als Nächstes: <span className="text-slate-200 font-bold">{groupLabel(next.next, strings, names)}</span>
        </span>
        <span className="text-slate-400 tabular">{Math.round(next.value * 100)} %</span>
      </div>
      <ProgressBar value={next.value} />
    </div>
  );
}

export function ProgressView({ settings, progress, onBack }) {
  const tuning = getTuning(settings.tuningId, settings.stringCount);
  const strings = tuning.strings;
  const names = namesOf(settings);
  const now = Date.now();
  const [selected, setSelected] = useState(null);
  const [showNames, setShowNames] = useState(false);
  const positions = allPositions(strings, settings.fretMax);
  const counts = countStatus(progress.units, positions);
  const cal = calendar(progress, now);
  const practicedDays = cal.filter((d) => d.practiced).length;
  const week = weekDays(progress, now);
  const firstWeekday = (new Date(shiftDays(now, -(CALENDAR_DAYS - 1))).getDay() + 6) % 7;

  const sel = selected && { ...selected, key: `${strings[selected.s]}:${selected.f}` };
  const selUnit = sel && progress.units[sel.key];

  const milestones = milestoneDefs(strings, names);
  const reached = milestones.filter((m) => progress.milestones[m.id]);
  const open = milestones.filter((m) => !progress.milestones[m.id]);
  const rtBests = strings
    .map((open, s) => ({ s, v: progress.bests.rtByString[open] }))
    .filter((x) => x.v != null);
  const challengeBests = strings
    .map((open, s) => ({ s, v: progress.bests.challenge?.[open] }))
    .filter((x) => x.v != null);

  return (
    <div>
      <Header title="Fortschritt" onBack={onBack} />

      <Card className="mb-4">
        <div className="flex items-baseline justify-between mb-1">
          <p className="text-4xl font-black tabular">
            {counts.sitzt}
            <span className="text-xl text-slate-400 font-bold"> von {positions.length}</span>
          </p>
          <p className="text-slate-400 text-sm">Positionen sitzen</p>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden bg-slate-800 mb-4">
          {['sitzt', 'wird', 'unsicher'].map((k) => (
            <div key={k} className={STATUS_STYLE[k]} style={{ width: `${(counts[k] / positions.length) * 100}%` }} />
          ))}
        </div>
        <UnlockCard settings={settings} progress={progress} />
      </Card>

      <Card className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-black text-lg">Griffbrett</p>
          <button onClick={() => setShowNames(!showNames)} className="text-sm text-slate-400 underline underline-offset-2">
            {showNames ? 'Tonnamen aus' : 'Tonnamen an'}
          </button>
        </div>
        <Fretboard
          strings={strings}
          fretMax={settings.fretMax}
          names={names}
          rowClass={settings.fretMax > 12 ? 'h-6' : 'h-8'}
          cell={(s, f) => {
            const st = status(progress.units[`${strings[s]}:${f}`]);
            const isSel = selected && selected.s === s && selected.f === f;
            return {
              className: `${STATUS_STYLE[st]} ${isSel ? 'outline outline-2 outline-indigo-400' : ''}`,
              label: showNames ? noteName(strings[s] + f, names) : '',
            };
          }}
          onCell={(s, f) => setSelected(selected && selected.s === s && selected.f === f ? null : { s, f })}
        />
        <div className="mt-3 min-h-[2.5rem] text-sm">
          {sel ? (
            <p>
              <span className="font-black">{noteName(strings[sel.s] + sel.f, names)}</span>
              <span className="text-slate-400"> · {stringName(strings, sel.s, names)}, Bund {sel.f} · </span>
              <span className="font-bold">{STATUS_LABEL[status(selUnit)]}</span>
              {selUnit && selUnit.n > 0 && (
                <span className="text-slate-400">
                  {' '}· {selUnit.ok}/{selUnit.n} richtig{selUnit.rt != null ? ` · Ø ${fmtSec(selUnit.rt)}` : ''} · {dueText(selUnit, now)}
                </span>
              )}
            </p>
          ) : (
            <Legend />
          )}
        </div>
      </Card>

      {settings.showGoals && (
        <Card className="mb-4">
          <div className="flex items-center gap-3 mb-3">
            <CalendarDays className="w-6 h-6 text-indigo-400" />
            <p className="font-black text-lg">Übungstage</p>
          </div>
          <p className="text-slate-300 mb-3">
            An <span className="font-black">{practicedDays}</span> der letzten {CALENDAR_DAYS} Tage geübt. Diese Woche{' '}
            <span className={`font-black ${week >= WEEK_GOAL_DAYS ? 'text-emerald-400' : ''}`}>
              {week} von {WEEK_GOAL_DAYS}
            </span>{' '}
            Tagen.
          </p>
          <div className="grid grid-cols-7 gap-2 text-center text-[10px] text-slate-500 mb-1">
            {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: firstWeekday }, (_, i) => (
              <span key={`pad${i}`} />
            ))}
            {cal.map((d) => (
              <span key={d.key} title={d.key} className="flex justify-center">
                <span className={`w-5 h-5 rounded-full ${d.practiced ? 'bg-indigo-400' : 'bg-slate-800'} ${d.today ? 'ring-2 ring-slate-300' : ''}`} />
              </span>
            ))}
          </div>
        </Card>
      )}

      {settings.showBests && (
        <>
          <Card className="mb-4">
            <div className="flex items-center gap-3 mb-3">
              <Trophy className="w-6 h-6 text-indigo-400" />
              <p className="font-black text-lg">Bestwerte</p>
            </div>
            <div className="text-sm space-y-1.5">
              <Row k="Längste Serie richtiger Antworten" v={progress.bests.run || '–'} />
              <Row k="Meiste Positionen „sitzt“" v={progress.bests.sitzt || '–'} />
              {rtBests.map(({ s, v }) => (
                <Row key={`rt${s}`} k={`Ø Reaktionszeit ${stringName(strings, s, names)}`} v={fmtSec(v)} />
              ))}
              {challengeBests.map(({ s, v }) => (
                <Row key={`ch${s}`} k={`Challenge ${stringName(strings, s, names)}`} v={fmtSec(v / 1000)} />
              ))}
              <Row k="Sessions / richtige Antworten" v={`${progress.totals.sessions} / ${progress.totals.correct}`} />
            </div>
          </Card>
          <Card className="mb-4">
            <div className="flex items-center gap-3 mb-3">
              <Flag className="w-6 h-6 text-indigo-400" />
              <p className="font-black text-lg">Meilensteine</p>
            </div>
            <ul className="text-sm space-y-1.5">
              {reached.map((m) => (
                <li key={m.id} className="flex justify-between gap-3">
                  <span className="font-bold">{progress.milestones[m.id].label}</span>
                  <span className="text-slate-500 tabular whitespace-nowrap">{progress.milestones[m.id].day.split('-').reverse().join('.')}</span>
                </li>
              ))}
              {open.slice(0, 4).map((m) => (
                <li key={m.id} className="text-slate-500">
                  {m.label}
                </li>
              ))}
              {open.length > 4 && <li className="text-slate-600">+ {open.length - 4} weitere</li>}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between gap-3 py-1 border-b border-slate-800 last:border-0">
      <span className="text-slate-400">{k}</span>
      <span className="font-bold tabular">{v}</span>
    </div>
  );
}

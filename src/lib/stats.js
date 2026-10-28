// Fortschritt, Ziele, Bestwerte, Meilensteine, Session-Auswertung.
// Grundsatz: nichts bestraft, kein Streak, der auf null fällt.
import { dayKey, daysBetween, status, STATUS_ORDER } from './srs.js';
import { buildGroups, groupUnits, groupLabel, allPositions } from './curriculum.js';
import { stringName } from './fretboard.js';
import { INTERVAL_GROUPS, activeShapes } from './intervals.js';

export const WEEK_GOAL_DAYS = 4;
export const CALENDAR_DAYS = 28;

export const DEFAULT_PROGRESS = {
  version: 1,
  units: {},
  days: {}, // 'YYYY-MM-DD' → { sec, answers, correct }
  totals: { sessions: 0, answers: 0, correct: 0, sec: 0 },
  bests: { run: 0, sitzt: 0, rtByString: {}, challenge: {}, arcade: {}, patterns: {} },
  intervals: { units: {}, unlocked: {}, names: {} }, // Ausbaustufe 2: Formen-Lernstand, freie Gruppen je Stimmung
  caged: { units: {}, unlocked: 1 }, // CAGED-Übung: Form × Grundton, freie Gruppen
  milestones: {}, // id → { day, label }
  unlocked: {}, // tuningId → Anzahl freier Gruppen
  lastExport: null,
  backupSnooze: null,
};

export function normalizeProgress(p) {
  const d = DEFAULT_PROGRESS;
  return {
    ...d,
    ...(p || {}),
    totals: { ...d.totals, ...(p?.totals || {}) },
    intervals: { units: { ...(p?.intervals?.units || {}) }, unlocked: { ...(p?.intervals?.unlocked || {}) }, names: { ...(p?.intervals?.names || {}) } },
    caged: { units: { ...(p?.caged?.units || {}) }, unlocked: p?.caged?.unlocked || 1 },
    bests: { ...d.bests, ...(p?.bests || {}), rtByString: { ...(p?.bests?.rtByString || {}) }, challenge: { ...(p?.bests?.challenge || {}) }, arcade: { ...(p?.bests?.arcade || {}) }, patterns: { ...(p?.bests?.patterns || {}) } },
  };
}

/** Übungszeit und Antworten für heute verbuchen. */
export function addPractice(progress, now, { sec = 0, answers = 0, correct = 0 }) {
  const k = dayKey(now);
  const day = progress.days[k] || { sec: 0, answers: 0, correct: 0 };
  return {
    ...progress,
    days: { ...progress.days, [k]: { sec: day.sec + sec, answers: day.answers + answers, correct: day.correct + correct } },
    totals: {
      ...progress.totals,
      sec: progress.totals.sec + sec,
      answers: progress.totals.answers + answers,
      correct: progress.totals.correct + correct,
    },
  };
}

/** Zeitstempel von heute ± n Kalendertagen (mittags, damit Sommerzeit nicht stört). */
export function shiftDays(now, n) {
  const d = new Date(now);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

const practiced = (d) => !!d && (d.answers > 0 || d.sec >= 60);

/** Letzte `n` Tage, ältester zuerst: [{ key, practiced, today }] */
export function calendar(progress, now, n = CALENDAR_DAYS) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const k = dayKey(shiftDays(now, -i));
    out.push({ key: k, practiced: practiced(progress.days[k]), today: i === 0 });
  }
  return out;
}

export function practiceDayCount(progress) {
  return Object.values(progress.days).filter(practiced).length;
}

/** Übungstage in der laufenden Woche (Mo–So). */
export function weekDays(progress, now) {
  const d = new Date(now);
  const weekday = (d.getDay() + 6) % 7; // Mo = 0
  let count = 0;
  for (let i = 0; i <= weekday; i++) if (practiced(progress.days[dayKey(shiftDays(now, -i))])) count++;
  return count;
}

export function todaySeconds(progress, now) {
  return progress.days[dayKey(now)]?.sec || 0;
}

export function countStatus(units, positions) {
  const c = { none: 0, unsicher: 0, wird: 0, sitzt: 0 };
  positions.forEach((p) => c[status(units[p.key])]++);
  return c;
}

// ---------- Meilensteine ----------

function allSitzt(units, positions) {
  return positions.length > 0 && positions.every((p) => status(units[p.key]) === 'sitzt');
}

/**
 * Alle Meilensteine für die aktive Stimmung. Ids hängen an den Leersaitentönen,
 * damit derselbe Erfolg nicht doppelt zählt (z. B. 6- und 7-Saiter).
 */
export function milestoneDefs(strings, names) {
  const groups = buildGroups(strings);
  const defs = [{ id: 'first-session', label: 'Erste Session', check: ({ progress }) => progress.totals.sessions >= 1 }];
  groups
    .filter((g) => g.kind === 'natural')
    .forEach((g) => {
      const opens = g.strings.map((s) => strings[s]).join(',');
      defs.push({
        id: `nat:${opens}`,
        label: `${groupLabel(g, strings, names)}: alle natürlichen Töne`,
        check: ({ units }) => allSitzt(units, groupUnits(g, strings, 12)),
      });
    });
  strings.forEach((open, s) => {
    const seventh = strings.length === 7 && s === 0;
    const name = stringName(strings, s, names);
    defs.push({
      id: `string:${open}`,
      label: seventh ? '7. Saite gemeistert' : `${name[0].toUpperCase()}${name.slice(1)} komplett`,
      check: ({ units }) => allSitzt(units, allPositions([open], 12)),
    });
  });
  const naturals12 = groups.filter((g) => g.kind === 'natural').flatMap((g) => groupUnits(g, strings, 12));
  defs.push(
    { id: `naturals12:${strings.join(',')}`, label: 'Alle natürlichen Töne bis Bund 12', check: ({ units }) => allSitzt(units, naturals12) },
    { id: `board12:${strings.join(',')}`, label: 'Ganzes Griffbrett bis Bund 12', check: ({ units }) => allSitzt(units, allPositions(strings, 12)) },
    { id: `board24:${strings.join(',')}`, label: 'Ganzes Griffbrett bis Bund 24', check: ({ units }) => allSitzt(units, allPositions(strings, 24)) },
  );
  INTERVAL_GROUPS.forEach((g, i) => {
    defs.push({
      id: `iv:${g.id}:${strings.join(',')}`,
      label: `Intervalle: ${g.label} sitzen`,
      check: ({ progress }) => {
        const shapes = activeShapes(strings, i + 1).filter((s) => g.semis.includes(s.deg));
        return shapes.length > 0 && shapes.every((s) => status(progress.intervals.units[s.key]) === 'sitzt');
      },
    });
  });
  [10, 30, 100].forEach((n) =>
    defs.push({ id: `days-${n}`, label: `${n} Übungstage`, check: ({ progress }) => practiceDayCount(progress) >= n }),
  );
  [500, 2000, 10000].forEach((n) =>
    defs.push({ id: `correct-${n}`, label: `${n.toLocaleString('de-DE')} richtige Antworten`, check: ({ progress }) => progress.totals.correct >= n }),
  );
  return defs;
}

export function evaluateMilestones(progress, strings, names, now) {
  const newly = [];
  const milestones = { ...progress.milestones };
  for (const m of milestoneDefs(strings, names)) {
    if (milestones[m.id]) continue;
    if (m.check({ progress, units: progress.units })) {
      milestones[m.id] = { day: dayKey(now), label: m.label };
      newly.push(m.label);
    }
  }
  return { progress: { ...progress, milestones }, newly };
}

// ---------- Bestwerte ----------

/**
 * results: [{ key, string, open, correct, rt, mode }] einer Session
 * Rückgabe: neue Bestwerte als Texte (nüchtern formuliert)
 */
export function updateBests(progress, results, strings, names) {
  const bests = { ...progress.bests, rtByString: { ...progress.bests.rtByString } };
  const news = [];

  let run = 0;
  let maxRun = 0;
  results.forEach((r) => {
    run = r.correct ? run + 1 : 0;
    maxRun = Math.max(maxRun, run);
  });
  if (maxRun > bests.run && bests.run >= 5) news.push(`${maxRun} richtige in Folge (bisher ${bests.run})`);
  bests.run = Math.max(bests.run, maxRun);

  strings.forEach((open, s) => {
    const rts = results.filter((r) => r.open === open && r.correct && r.mode === 'mic' && r.rt != null).map((r) => r.rt);
    if (rts.length < 5) return;
    const avg = rts.reduce((a, b) => a + b, 0) / rts.length;
    const prev = bests.rtByString[open];
    if (prev == null || avg < prev) {
      if (prev != null) news.push(`${stringName(strings, s, names)}: Ø ${fmtSec(avg)} (bisher ${fmtSec(prev)})`);
      bests.rtByString[open] = Math.round(avg * 100) / 100;
    }
  });

  const sitzt = Object.values(progress.units).filter((u) => status(u) === 'sitzt').length;
  if (sitzt > bests.sitzt) {
    if (bests.sitzt > 0) news.push(`${sitzt} Positionen sitzen (bisher ${bests.sitzt})`);
    bests.sitzt = sitzt;
  }
  return { progress: { ...progress, bests }, news };
}

export function fmtSec(s) {
  return `${s.toFixed(1).replace('.', ',')} s`;
}

// ---------- Session-Auswertung ----------

/** Positionen, deren Status sich verbessert hat (vorher → nachher). */
export function improvements(before, after) {
  const out = [];
  Object.keys(after).forEach((k) => {
    const a = status(after[k]);
    const b = status(before[k]);
    if (STATUS_ORDER[a] > STATUS_ORDER[b] && a !== 'unsicher') out.push({ key: k, from: b, to: a });
  });
  return out;
}

export function sessionSummary(results) {
  const answers = results.length;
  const correct = results.filter((r) => r.correct).length;
  const rts = results.filter((r) => r.correct && r.mode === 'mic' && r.rt != null).map((r) => r.rt);
  return {
    answers,
    correct,
    rate: answers ? correct / answers : 0,
    avgRt: rts.length ? rts.reduce((a, b) => a + b, 0) / rts.length : null,
  };
}

/** Backup-Erinnerung: wenn Lernstand vorhanden und letzter Export > 14 Tage her. */
export function needsBackup(progress, now) {
  if (!Object.keys(progress.units).length || progress.totals.sessions < 2) return false;
  const ref = Math.max(progress.lastExport || 0, progress.backupSnooze || 0);
  if (!ref) return true;
  return daysBetween(dayKey(ref), dayKey(now)) >= 14;
}

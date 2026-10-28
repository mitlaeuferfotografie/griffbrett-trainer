// Adaptive Wiederholung (Leitner-Boxen mit Reaktionszeit).
//
// Lerneinheit = Leersaitenton × Bund, Schlüssel z. B. "45:8" (F auf der A-Saite).
// Dadurch teilen sich 6- und 7-Saiter den Lernstand der gemeinsamen Saiten.
//
// Regeln:
//  - richtig und ≤ FAST_SEC        → eine Box höher; ab Box 2 höchstens einmal pro Tag.
//                                    „sitzt“ (Box 3) heißt also: schnell und richtig an mind. 2 Tagen.
//  - richtig, aber langsamer       → Box bleibt (neue Einheit kommt mindestens in Box 1)
//  - richtig, aber > SLOW_SEC      → eine Box zurück (nicht unter 1)
//  - falsch / Lösung angezeigt     → zwei Boxen zurück (nicht unter 1); Fortschritt fällt nie ganz weg
//  - Antippen statt Mikrofon       → kann höchstens bis Box 2 („wird“) bringen, nie „sitzt“
//  - fällig nach INTERVAL_DAYS[box] Tagen seit der letzten Abfrage

export const FAST_SEC = 3;
export const SLOW_SEC = 8;
export const MAX_BOX = 5;
export const WIRD_BOX = 2;
export const SITZT_BOX = 3;
export const TAP_MAX_BOX = 2;
export const INTERVAL_DAYS = [0, 0, 1, 3, 7, 14];
const HISTORY = 10;

export function unitKey(openMidi, fret) {
  return `${openMidi}:${fret}`;
}

const pad = (n) => String(n).padStart(2, '0');

/** Lokales Datum als "YYYY-MM-DD" */
export function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function daysBetween(fromKey, toKey) {
  const [a, b] = [fromKey, toKey].map((k) => {
    const [y, m, d] = k.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  });
  return Math.round((b - a) / 86400000);
}

export function newUnit(now) {
  return { box: 0, intro: now, last: null, lastPromoDay: null, rt: null, n: 0, ok: 0, hist: [] };
}

/**
 * Wertet eine Antwort aus. Gibt eine neue Einheit zurück (keine Mutation).
 * answer: { correct, rt (Sekunden | null), mode: 'mic' | 'tap', now }
 */
export function applyAnswer(unit, { correct, rt = null, mode = 'mic', now }) {
  const u = { ...(unit || newUnit(now)) };
  const day = dayKey(now);
  let box = u.box;
  if (!correct) {
    box = Math.max(1, box - 2);
  } else if (rt != null && rt > SLOW_SEC) {
    box = Math.max(1, box - 1);
  } else if (rt != null && rt <= FAST_SEC) {
    const cap = mode === 'tap' ? TAP_MAX_BOX : MAX_BOX;
    const canPromote = box < WIRD_BOX || u.lastPromoDay !== day;
    if (canPromote && box < cap) {
      box += 1;
      u.lastPromoDay = day;
    }
    if (box === 0) box = 1;
  } else {
    box = Math.max(1, box);
  }
  u.box = box;
  u.last = now;
  u.n += 1;
  if (correct) {
    u.ok += 1;
    if (rt != null && mode === 'mic') u.rt = u.rt == null ? rt : 0.6 * u.rt + 0.4 * rt;
  }
  u.hist = [...u.hist, { t: now, c: correct ? 1 : 0, rt: rt == null ? null : Math.round(rt * 100) / 100, m: mode === 'tap' ? 't' : 'm' }].slice(-HISTORY);
  return u;
}

/** 'none' | 'unsicher' | 'wird' | 'sitzt' */
export function status(unit) {
  if (!unit || unit.n === 0) return 'none';
  if (unit.box >= SITZT_BOX) return 'sitzt';
  if (unit.box >= WIRD_BOX) return 'wird';
  return 'unsicher';
}

export const STATUS_ORDER = { none: 0, unsicher: 1, wird: 2, sitzt: 3 };

/** Beherrschung 0–100: Box (80 %) + Tempo (20 %) */
export function mastery(unit) {
  if (!unit || unit.n === 0) return 0;
  const boxPart = (unit.box / MAX_BOX) * 80;
  const speed = unit.rt == null ? 0 : Math.max(0, Math.min(1, (SLOW_SEC - unit.rt) / (SLOW_SEC - 1)));
  return Math.round(boxPart + speed * 20);
}

export function isDue(unit, now) {
  if (!unit || unit.last == null) return true;
  return daysBetween(dayKey(unit.last), dayKey(now)) >= INTERVAL_DAYS[unit.box];
}

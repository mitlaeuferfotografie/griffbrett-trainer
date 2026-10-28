// Session-Zusammenstellung: Die App wählt jede Aufgabe selbst.
// Mischung: ca. 70 % fällige/schwache, 20 % neue, 10 % Wiederholung von Sitzendem.
// Falsch Beantwortetes kommt in derselben Session nach einigen Aufgaben noch einmal.
// Neue Positionen kommen dazu, solange weniger als WORKING_SET Positionen „unsicher“
// sind (höchstens MAX_NEW_PER_SESSION pro Session) – wer schnell lernt, bekommt schneller Neues.
import { pitchClass } from './notes.js';
import { isDue, mastery, status } from './srs.js';

export const MIX = { due: 0.7, new: 0.2, review: 0.1 };
export const MAX_NEW_PER_SESSION = 12;
export const WORKING_SET = 5;
export const RETRY_GAP = 3;
const RECENT = 3;

export function createSession() {
  return { asked: 0, newCount: 0, recent: [], retry: [] };
}

function pickRandom(list, rand) {
  return list[Math.floor(rand() * list.length)];
}

/**
 * Nächste Aufgabe oder null (wenn keine Positionen aktiv sind).
 * positions: aktive Positionen [{ string, fret, key, group }]
 */
export function pickTask({ strings, positions, units, session, now, rand = Math.random }) {
  if (!positions.length) return null;
  const notRecent = (p) => !session.recent.includes(p.key);

  const retry = session.retry.find((r) => r.at <= session.asked);
  if (retry) {
    const p = positions.find((x) => x.key === retry.key);
    if (p) return makeTask(strings, p, 'retry');
  }

  const introduced = positions.filter((p) => units[p.key] && units[p.key].n > 0);
  const byMastery = (a, b) => mastery(units[a.key]) - mastery(units[b.key]);
  const pools = {
    due: () => introduced.filter((p) => isDue(units[p.key], now)).sort(byMastery).slice(0, 5),
    weak: () => [...introduced].sort(byMastery).slice(0, 6),
    new: () => {
      if (session.newCount >= MAX_NEW_PER_SESSION) return [];
      if (introduced.filter((p) => status(units[p.key]) === 'unsicher').length >= WORKING_SET) return [];
      const fresh = positions.filter((p) => !units[p.key] || units[p.key].n === 0);
      if (!fresh.length) return [];
      const g = Math.min(...fresh.map((p) => p.group ?? 0));
      return fresh.filter((p) => (p.group ?? 0) === g);
    },
    review: () => introduced.filter((p) => status(units[p.key]) === 'sitzt' && !isDue(units[p.key], now)),
  };
  const ORDER = {
    due: ['due', 'new', 'weak', 'review'],
    new: ['new', 'due', 'weak', 'review'],
    review: ['review', 'due', 'weak', 'new'],
  };
  const r = rand();
  const first = r < MIX.due ? 'due' : r < MIX.due + MIX.new ? 'new' : 'review';
  for (const kind of ORDER[first]) {
    const pool = pools[kind]();
    const fresh = pool.filter(notRecent);
    const pick = fresh.length ? pickRandom(fresh, rand) : null;
    if (pick) return makeTask(strings, pick, kind);
  }
  // alles kürzlich gefragt: irgendeine andere Position
  const any = positions.filter(notRecent);
  return makeTask(strings, pickRandom(any.length ? any : positions, rand), 'weak');
}

export function makeTask(strings, p, kind) {
  return { string: p.string, fret: p.fret, key: p.key, pc: pitchClass(strings[p.string] + p.fret), kind };
}

/** Session-Zustand nach einer Antwort fortschreiben. */
export function advanceSession(session, task, correct) {
  const retry = session.retry.filter((r) => r.key !== task.key);
  if (!correct) retry.push({ key: task.key, at: session.asked + 1 + RETRY_GAP });
  return {
    asked: session.asked + 1,
    newCount: session.newCount + (task.kind === 'new' ? 1 : 0),
    recent: [...session.recent, task.key].slice(-RECENT),
    retry,
  };
}

/** Alle Bünde (0 … fretMax) dieser Tonklasse auf der Saite. */
export function validFrets(strings, string, pc, fretMax) {
  const out = [];
  for (let f = 0; f <= fretMax; f++) if (pitchClass(strings[string] + f) === pc) out.push(f);
  return out;
}

/**
 * Prüft einen gespielten Ton (MIDI) gegen die Aufgabe.
 * Richtig = gleiche Tonklasse UND auf genau dieser Saite im Bereich 0 … fretMax spielbar
 * (verhindert „zufällig richtig“ in anderer Oktave). Gutgeschrieben wird die gespielte
 * Position, sofern sie eine Lerneinheit ist (Bund ≥ 1), sonst die gefragte.
 */
export function judge(strings, task, midi, fretMax) {
  const fret = Math.round(midi) - strings[task.string];
  const onString = fret >= 0 && fret <= fretMax;
  const correct = onString && pitchClass(midi) === task.pc;
  const creditFret = correct && fret >= 1 ? fret : task.fret;
  return {
    correct,
    playedFret: onString ? fret : null,
    creditKey: `${strings[task.string]}:${creditFret}`,
    creditFret,
  };
}

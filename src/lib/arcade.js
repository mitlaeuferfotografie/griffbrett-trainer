// „Fallende Töne“: Töne fallen in der Spur ihrer Saite auf eine Trefferlinie zu und
// müssen im richtigen Moment gespielt werden. Reine Logik, in Node getestet.
//
// Fortschritt eines Tons p: 0 = oben, 1 = Trefferlinie.
//   p < EARLY        → zu früh (zählt nicht, Ton fällt weiter)
//   EARLY … PERFECT  → „gut“
//   PERFECT … LATE   → „perfekt“
//   p > LATE         → verpasst (kostet ein Leben)
// Falscher Ton: Serie endet, kein Lebensverlust.
// Tempo: alle HITS_PER_LEVEL Treffer eine Stufe schneller, nach 2 verpassten Tönen
// in Folge eine Stufe langsamer.
import { status } from './srs.js';
import { groupUnits, buildGroups } from './curriculum.js';
import { pitchClass } from './notes.js';

export const MAX_LEVEL = 10;
export const HITS_PER_LEVEL = 8;
export const LIVES = 5;
export const ZONE = { early: 0.6, perfect: 0.85, late: 1.15 };

/** Fallzeit in ms: Stufe 1 = 6 s, Stufe 10 ≈ 1,5 s */
export function fallMs(level) {
  return Math.round(6000 * Math.pow(0.857, clampLevel(level) - 1));
}

/** Abstand zwischen zwei neuen Tönen */
export function spawnGapMs(level) {
  return Math.round(fallMs(level) * 0.55);
}

export function clampLevel(level) {
  return Math.max(1, Math.min(MAX_LEVEL, level));
}

/** 'early' | 'good' | 'perfect' | 'miss' */
export function rateTiming(p) {
  if (p < ZONE.early) return 'early';
  if (p < ZONE.perfect) return 'good';
  if (p <= ZONE.late) return 'perfect';
  return 'miss';
}

/** Punkte: Stufe × Qualität × Serien-Multiplikator (+1 je 10 Treffer in Folge) */
export function points(level, quality, combo) {
  const base = quality === 'perfect' ? 150 : 100;
  return base * clampLevel(level) * (1 + Math.floor(combo / 10));
}

/**
 * Startstufe „Automatisch“: aus dem Anteil sitzender Positionen im Tonvorrat und der
 * bisher erreichten Höchststufe (2 darunter), Stufe 1 … 7.
 */
export function autoStartLevel(units, pool, bestLevel = 0) {
  const share = pool.length ? pool.filter((p) => status(units[p.key]) === 'sitzt').length / pool.length : 0;
  return Math.max(1, Math.min(7, Math.max(1 + Math.round(share * 5), bestLevel - 2)));
}

/**
 * Tonvorrat. mode 'learned': aktive Positionen, bevorzugt bereits eingeführte (wenn ≥ 6);
 * mode 'naturals': alle natürlichen Töne auf allen Saiten.
 */
export function buildPool(mode, { strings, fretMax, positions, units }) {
  if (mode === 'naturals') {
    return buildGroups(strings)
      .filter((g) => g.kind === 'natural')
      .flatMap((g) => groupUnits(g, strings, Math.min(fretMax, 12)));
  }
  const known = positions.filter((p) => units[p.key] && units[p.key].n > 0);
  return known.length >= 6 ? known : positions;
}

/** Nächster Ton: zufällig, nicht dieselbe Position wie zuletzt, möglichst andere Saite. */
export function pickNote(pool, last, rand = Math.random) {
  if (!pool.length) return null;
  let candidates = pool.filter((p) => !last || (p.key !== last.key && p.string !== last.string));
  if (!candidates.length) candidates = pool.filter((p) => !last || p.key !== last.key);
  if (!candidates.length) candidates = pool;
  const p = candidates[Math.floor(rand() * candidates.length)];
  return { ...p, pc: pitchClass(p.midi) };
}

export function createRun(startLevel) {
  return {
    level: clampLevel(startLevel),
    startLevel: clampLevel(startLevel),
    maxLevel: clampLevel(startLevel),
    score: 0,
    combo: 0,
    maxCombo: 0,
    hits: 0,
    perfect: 0,
    misses: 0,
    wrong: 0,
    lives: LIVES,
    levelHits: 0,
    missStreak: 0,
  };
}

/** Treffer verbuchen → { run, gained } */
export function registerHit(run, quality) {
  const combo = run.combo + 1;
  const gained = points(run.level, quality, run.combo);
  let { level, levelHits } = run;
  levelHits += 1;
  if (levelHits >= HITS_PER_LEVEL && level < MAX_LEVEL) {
    level += 1;
    levelHits = 0;
  }
  return {
    gained,
    run: {
      ...run,
      score: run.score + gained,
      combo,
      maxCombo: Math.max(run.maxCombo, combo),
      hits: run.hits + 1,
      perfect: run.perfect + (quality === 'perfect' ? 1 : 0),
      level,
      maxLevel: Math.max(run.maxLevel, level),
      levelHits,
      missStreak: 0,
    },
  };
}

/** Verpasster Ton: ein Leben weniger; nach 2 in Folge eine Stufe langsamer. */
export function registerMiss(run) {
  const missStreak = run.missStreak + 1;
  const slower = missStreak >= 2 && run.level > 1;
  return {
    ...run,
    combo: 0,
    misses: run.misses + 1,
    lives: run.lives - 1,
    missStreak: slower ? 0 : missStreak,
    level: slower ? run.level - 1 : run.level,
    levelHits: slower ? 0 : run.levelHits,
  };
}

/** Falscher Ton: nur die Serie endet. */
export function registerWrong(run) {
  return { ...run, combo: 0, wrong: run.wrong + 1 };
}

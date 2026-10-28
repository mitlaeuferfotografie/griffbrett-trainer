// Progressive Einführung: Saiten-Gruppen werden nacheinander freigeschaltet.
//  1. Natürliche Töne auf tiefster und höchster Saite (Standard: tiefe + hohe E-Saite)
//  2. Natürliche Töne auf der 2. Saite (A)
//  3. 3. und 4. Saite (D, G)
//  4. 5. Saite (H)
//  5. nur 7-Saiter: tiefe H-Saite (bzw. Drop-A-Saite)
//  6. Vorzeichen auf allen Saiten
// Freigeschaltet wird durch Können, nicht durch Zeit: Die nächste Gruppe kommt,
// wenn von allen bisher freien Positionen ≥ UNLOCK_WIRD „wird“ oder besser und
// ≥ UNLOCK_SITZT „sitzt“. Einmal freigeschaltet bleibt freigeschaltet.
import { isNatural } from './notes.js';
import { stringName } from './fretboard.js';
import { unitKey, status, STATUS_ORDER } from './srs.js';

export const UNLOCK_WIRD = 0.8;
export const UNLOCK_SITZT = 0.5;

export function buildGroups(strings) {
  const n = strings.length;
  const main = n === 7 ? [1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4, 5];
  const groups = [
    { id: 'g1', strings: [main[0], main[5]], kind: 'natural' },
    { id: 'g2', strings: [main[1]], kind: 'natural' },
    { id: 'g3', strings: [main[2], main[3]], kind: 'natural' },
    { id: 'g4', strings: [main[4]], kind: 'natural' },
  ];
  if (n === 7) groups.push({ id: 'g5', strings: [0], kind: 'natural' });
  groups.push({ id: 'g6', strings: strings.map((_, i) => i), kind: 'accidental' });
  return groups;
}

export function groupLabel(group, strings, names) {
  if (group.kind === 'accidental') return 'Vorzeichen auf allen Saiten';
  const list = group.strings.map((s) => stringName(strings, s, names));
  const joined = list.length > 1 ? `${list.slice(0, -1).join(', ')} & ${list[list.length - 1]}` : list[0];
  return `${joined[0].toUpperCase()}${joined.slice(1)}`;
}

/** Positionen einer Gruppe (Bund 1 … fretMax; Leersaiten werden nicht abgefragt). */
export function groupUnits(group, strings, fretMax, groupIndex = 0) {
  const out = [];
  for (const s of group.strings) {
    for (let f = 1; f <= fretMax; f++) {
      const midi = strings[s] + f;
      if ((group.kind === 'natural') === isNatural(midi)) {
        out.push({ string: s, fret: f, midi, key: unitKey(strings[s], f), group: groupIndex });
      }
    }
  }
  return out;
}

export function allPositions(strings, fretMax) {
  const out = [];
  strings.forEach((open, s) => {
    for (let f = 1; f <= fretMax; f++) out.push({ string: s, fret: f, midi: open + f, key: unitKey(open, f) });
  });
  return out;
}

export function shareAtLeast(positions, units, minStatus) {
  if (!positions.length) return 0;
  const min = STATUS_ORDER[minStatus];
  return positions.filter((p) => STATUS_ORDER[status(units[p.key])] >= min).length / positions.length;
}

/** Anzahl freigeschalteter Gruppen (mind. `stored`, nie weniger). */
export function computeUnlocked(groups, strings, fretMax, units, stored = 1) {
  let n = Math.max(1, stored || 1);
  while (n < groups.length) {
    const pos = groups.slice(0, n).flatMap((g, i) => groupUnits(g, strings, fretMax, i));
    if (shareAtLeast(pos, units, 'wird') >= UNLOCK_WIRD && shareAtLeast(pos, units, 'sitzt') >= UNLOCK_SITZT) n++;
    else break;
  }
  return Math.min(n, groups.length);
}

/** Fortschritt zur nächsten Freischaltung, 0…1 (Minimum beider Bedingungen). */
export function unlockProgress(groups, strings, fretMax, units, unlocked) {
  if (unlocked >= groups.length) return null;
  const pos = groups.slice(0, unlocked).flatMap((g, i) => groupUnits(g, strings, fretMax, i));
  const w = shareAtLeast(pos, units, 'wird') / UNLOCK_WIRD;
  const s = shareAtLeast(pos, units, 'sitzt') / UNLOCK_SITZT;
  return { next: groups[unlocked], value: Math.min(1, w, s) };
}

/** Positionen der aktiven Gruppen (automatisch freigeschaltet oder manuell gewählt). */
export function activePositions(groups, strings, fretMax, { unlocked, manual }) {
  const chosen = manual && manual.length ? groups.map((g, i) => [g, i]).filter(([g]) => manual.includes(g.id)) : groups.slice(0, unlocked).map((g, i) => [g, i]);
  return chosen.flatMap(([g, i]) => groupUnits(g, strings, fretMax, i));
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAnswer, status, isDue, mastery, dayKey, daysBetween, newUnit } from '../src/lib/srs.js';
import { buildGroups, groupUnits, groupLabel, computeUnlocked, activePositions, unlockProgress } from '../src/lib/curriculum.js';
import { createSession, pickTask, advanceSession, judge, validFrets, MAX_NEW_PER_SESSION, WORKING_SET } from '../src/lib/session.js';
import {
  addPractice, calendar, weekDays, evaluateMilestones, updateBests, improvements, needsBackup, normalizeProgress, shiftDays,
} from '../src/lib/stats.js';
import { buildExport, parseImport, DEFAULT_SETTINGS } from '../src/lib/storage.js';
import { mulberry32 } from '../src/audio/synth.js';
import { getTuning } from '../src/lib/tunings.js';

const STD = getTuning('std-6').strings;
const S7 = getTuning('std-7', 7).strings;
const DAY = 86400000;
const T0 = new Date(2026, 9, 28, 18, 0).getTime();

// ---------- srs ----------

test('„sitzt“ erst nach schnellen richtigen Antworten an zwei verschiedenen Tagen', () => {
  let u = applyAnswer(null, { correct: true, rt: 2, now: T0 });
  assert.equal(u.box, 1);
  u = applyAnswer(u, { correct: true, rt: 2, now: T0 + 60000 });
  assert.equal(status(u), 'wird');
  u = applyAnswer(u, { correct: true, rt: 1.5, now: T0 + 120000 });
  assert.equal(status(u), 'wird', 'am selben Tag keine weitere Beförderung');
  u = applyAnswer(u, { correct: true, rt: 1.5, now: T0 + DAY });
  assert.equal(status(u), 'sitzt');
});

test('Richtig nach langem Suchen ist nicht „sitzt“', () => {
  let u = newUnit(T0);
  for (let d = 0; d < 5; d++) u = applyAnswer(u, { correct: true, rt: 6, now: T0 + d * DAY });
  assert.equal(status(u), 'unsicher');
  u = applyAnswer({ ...u, box: 3 }, { correct: true, rt: 9, now: T0 + 6 * DAY });
  assert.equal(u.box, 2, 'über 8 s eine Box zurück');
});

test('Fehler: zwei Boxen zurück, aber nie unter 1', () => {
  assert.equal(applyAnswer({ ...newUnit(T0), box: 5, n: 5 }, { correct: false, now: T0 }).box, 3);
  assert.equal(applyAnswer({ ...newUnit(T0), box: 1, n: 1 }, { correct: false, now: T0 }).box, 1);
  assert.equal(applyAnswer(null, { correct: false, now: T0 }).box, 1);
});

test('Antippen bringt höchstens bis „wird“', () => {
  let u = null;
  for (let d = 0; d < 6; d++) u = applyAnswer(u, { correct: true, rt: 1, mode: 'tap', now: T0 + d * DAY });
  assert.equal(status(u), 'wird');
  const sitzt = { ...newUnit(T0), box: 4, n: 4, lastPromoDay: dayKey(T0) };
  assert.equal(applyAnswer(sitzt, { correct: true, rt: 1, mode: 'tap', now: T0 + DAY }).box, 4, 'Antippen stuft nicht herab');
});

test('Reaktionszeit als gleitender Mittelwert, nur bei richtigen Mikrofon-Antworten', () => {
  let u = applyAnswer(null, { correct: true, rt: 4, now: T0 });
  u = applyAnswer(u, { correct: true, rt: 2, now: T0 });
  assert.ok(Math.abs(u.rt - 3.2) < 1e-9);
  u = applyAnswer(u, { correct: false, rt: 1, now: T0 });
  assert.ok(Math.abs(u.rt - 3.2) < 1e-9);
  assert.ok(mastery(u) > 0 && mastery(u) <= 100);
});

test('Fälligkeit nach Kalendertagen', () => {
  const u = { ...newUnit(T0), box: 3, n: 3, last: T0 };
  assert.equal(isDue(u, T0 + 2 * DAY), false);
  assert.equal(isDue(u, T0 + 3 * DAY), true);
  assert.equal(isDue({ ...u, box: 1 }, T0), true);
  assert.equal(daysBetween('2026-10-24', '2026-10-26'), 2); // über die Zeitumstellung
});

// ---------- curriculum ----------

test('Gruppen: 6-Saiter E-Saiten zuerst, 7-Saiter mit eigener tiefer Saite, Vorzeichen zuletzt', () => {
  const g6 = buildGroups(STD);
  assert.deepEqual(g6.map((g) => g.strings), [[0, 5], [1], [2, 3], [4], [0, 1, 2, 3, 4, 5]]);
  assert.equal(groupLabel(g6[0], STD, {}), 'Tiefe E-Saite & hohe E-Saite');
  const g7 = buildGroups(S7);
  assert.deepEqual(g7.map((g) => g.id), ['g1', 'g2', 'g3', 'g4', 'g5', 'g6']);
  assert.deepEqual(g7[0].strings, [1, 6]);
  assert.deepEqual(g7[4].strings, [0]);
  // natürliche Töne tiefe E-Saite bis Bund 12: F G A H C D E (ohne Leersaite)
  assert.deepEqual(groupUnits(g6[0], STD, 12).filter((p) => p.string === 0).map((p) => p.fret), [1, 3, 5, 7, 8, 10, 12]);
  // Vorzeichen: 5 pro Saite und Oktave
  assert.equal(groupUnits(g6[4], STD, 12).length, 30);
});

test('Freischaltung durch Können, bleibt erhalten', () => {
  const groups = buildGroups(STD);
  const first = groupUnits(groups[0], STD, 12);
  const units = {};
  assert.equal(computeUnlocked(groups, STD, 12, units, 1), 1);
  first.forEach((p, i) => {
    units[p.key] = { ...newUnit(T0), n: 3, box: i < first.length * 0.6 ? 3 : 2 };
  });
  assert.equal(computeUnlocked(groups, STD, 12, units, 1), 2);
  assert.equal(computeUnlocked(groups, STD, 12, {}, 3), 3, 'nie wieder gesperrt');
  const prog = unlockProgress(groups, STD, 12, {}, 1);
  assert.equal(prog.value, 0);
  assert.equal(prog.next.id, 'g2');
});

test('Manuelle Gruppenwahl', () => {
  const groups = buildGroups(STD);
  const pos = activePositions(groups, STD, 12, { unlocked: 1, manual: ['g4'] });
  assert.ok(pos.length > 0 && pos.every((p) => p.string === 4));
});

// ---------- session ----------

test('Prüflogik: Tonklasse und Lage auf genau dieser Saite', () => {
  const task = { string: 1, fret: 8, key: '45:8', pc: 5 }; // F auf der A-Saite
  assert.equal(judge(STD, task, 53, 12).correct, true); // F3
  assert.equal(judge(STD, task, 41, 12).correct, false, 'F2 liegt nicht auf der A-Saite');
  assert.equal(judge(STD, task, 65, 12).correct, false, 'F4 wäre Bund 20');
  assert.equal(judge(STD, task, 65, 24).correct, true);
  assert.equal(judge(STD, task, 65, 24).creditKey, '45:20');
  assert.equal(judge(STD, task, 52, 12).playedFret, 7);
  // E auf der tiefen E-Saite: Bund 0 und 12 zählen, gutgeschrieben wird Bund 12
  const e = { string: 0, fret: 12, key: '40:12', pc: 4 };
  assert.equal(judge(STD, e, 40, 12).correct, true);
  assert.equal(judge(STD, e, 40, 12).creditKey, '40:12');
  assert.deepEqual(validFrets(STD, 0, 4, 12), [0, 12]);
});

test('Session: neue Positionen begrenzt, keine direkte Wiederholung, Fehler kommen wieder', () => {
  const groups = buildGroups(STD);
  const positions = activePositions(groups, STD, 12, { unlocked: 1 });
  const rand = mulberry32(5);
  let session = createSession();
  const units = {};
  const keys = [];
  let wrongKey = null;
  let wrongAt = -1;
  for (let i = 0; i < 40; i++) {
    const t = pickTask({ strings: STD, positions, units, session, now: T0, rand });
    keys.push(t.key);
    const correct = !(i === 2);
    if (!correct) {
      wrongKey = t.key;
      wrongAt = i;
    }
    units[t.key] = applyAnswer(units[t.key], { correct, rt: 2, now: T0 });
    session = advanceSession(session, t, correct);
  }
  for (let i = 1; i < keys.length; i++) assert.notEqual(keys[i], keys[i - 1]);
  assert.ok(Object.keys(units).length <= MAX_NEW_PER_SESSION, `neu: ${Object.keys(units).length}`);
  assert.ok(Object.keys(units).length > 4, 'bei schnellen richtigen Antworten kommt Nachschub');
  assert.ok(keys.slice(wrongAt + 1, wrongAt + 7).includes(wrongKey), 'falsche Position kommt bald wieder');
});

test('Session-Mischung: überwiegend fällige/schwache, auch neue und Wiederholung', () => {
  const groups = buildGroups(STD);
  const positions = activePositions(groups, STD, 12, { unlocked: 2 });
  const units = {};
  positions.forEach((p, i) => {
    if (i % 3 === 0) units[p.key] = { ...newUnit(T0), n: 4, box: 4, last: T0 }; // sitzt, nicht fällig
    else if (i % 3 === 1) units[p.key] = { ...newUnit(T0), n: 2, box: 2, last: T0 - 2 * DAY }; // wird, fällig
  });
  const counts = {};
  const rand = mulberry32(9);
  for (let i = 0; i < 2000; i++) {
    const t = pickTask({ strings: STD, positions, units, session: createSession(), now: T0, rand });
    counts[t.kind] = (counts[t.kind] || 0) + 1;
  }
  assert.ok(counts.due / 2000 > 0.6 && counts.due / 2000 < 0.8, JSON.stringify(counts));
  assert.ok(counts.new / 2000 > 0.12, JSON.stringify(counts));
  assert.ok(counts.review / 2000 > 0.05, JSON.stringify(counts));
});

// ---------- stats ----------

test('Übungskalender und Wochenziel', () => {
  let p = normalizeProgress(null);
  p = addPractice(p, T0, { sec: 300, answers: 40, correct: 35 });
  p = addPractice(p, shiftDays(T0, -2), { sec: 120, answers: 10, correct: 8 });
  const cal = calendar(p, T0);
  assert.equal(cal.length, 28);
  assert.equal(cal.filter((d) => d.practiced).length, 2);
  assert.equal(cal[27].today, true);
  assert.equal(p.totals.correct, 43);
  // 28.10.2026 ist ein Mittwoch → 26.10. (Mo) zählt zur Woche
  assert.equal(weekDays(p, T0), 2);
});

test('Meilensteine werden einmal vergeben', () => {
  let p = normalizeProgress(null);
  p = { ...p, totals: { ...p.totals, sessions: 1 } };
  const r1 = evaluateMilestones(p, STD, {}, T0);
  assert.deepEqual(r1.newly, ['Erste Session']);
  const r2 = evaluateMilestones(r1.progress, STD, {}, T0);
  assert.deepEqual(r2.newly, []);
  // A-Saite komplett
  const units = {};
  for (let f = 1; f <= 12; f++) units[`45:${f}`] = { ...newUnit(T0), n: 3, box: 3 };
  const r3 = evaluateMilestones({ ...r2.progress, units }, STD, {}, T0);
  assert.ok(r3.newly.includes('A-Saite komplett'), r3.newly.join(' | '));
  assert.ok(r3.newly.includes('A-Saite: alle natürlichen Töne'), r3.newly.join(' | '));
  const s7 = evaluateMilestones({ ...normalizeProgress(null), units: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`35:${i + 1}`, { ...newUnit(T0), n: 3, box: 3 }])) }, S7, {}, T0);
  assert.ok(s7.newly.includes('7. Saite gemeistert'));
});

test('Bestwerte: Serie und Reaktionszeit je Saite', () => {
  const p = normalizeProgress(null);
  const results = Array.from({ length: 8 }, () => ({ open: 45, correct: true, rt: 2, mode: 'mic' }));
  const r1 = updateBests(p, results, STD, {});
  assert.equal(r1.progress.bests.run, 8);
  assert.equal(r1.progress.bests.rtByString[45], 2);
  const faster = results.map((r) => ({ ...r, rt: 1.5 }));
  const r2 = updateBests(r1.progress, faster, STD, {});
  assert.ok(r2.news.some((n) => n.startsWith('A-Saite: Ø 1,5 s')), r2.news.join(' | '));
});

test('Verbesserungen und Backup-Erinnerung', () => {
  const before = { a: { ...newUnit(T0), n: 1, box: 1 } };
  const after = { a: { ...newUnit(T0), n: 2, box: 2 }, b: { ...newUnit(T0), n: 1, box: 1 } };
  assert.deepEqual(improvements(before, after), [{ key: 'a', from: 'unsicher', to: 'wird' }]);
  const p = { ...normalizeProgress(null), units: after, totals: { sessions: 3, answers: 0, correct: 0, sec: 0 } };
  assert.equal(needsBackup(p, T0), true);
  assert.equal(needsBackup({ ...p, lastExport: T0 - 3 * DAY }, T0), false);
  assert.equal(needsBackup({ ...p, lastExport: T0 - 15 * DAY }, T0), true);
});

test('Export/Import', () => {
  const data = { settings: { ...DEFAULT_SETTINGS, stringCount: 7 }, progress: normalizeProgress({ units: { '45:3': newUnit(T0) } }) };
  const r = parseImport(buildExport(data, T0));
  assert.equal(r.ok, true);
  assert.equal(r.data.settings.stringCount, 7);
  assert.ok(r.data.progress.units['45:3']);
  assert.equal(parseImport('kein json').ok, false);
  assert.equal(parseImport('{"app":"anders"}').ok, false);
});

test('Arbeitsmenge: bei vielen Fehlern kommen keine weiteren neuen Positionen', () => {
  const groups = buildGroups(STD);
  const positions = activePositions(groups, STD, 12, { unlocked: 3 });
  const rand = mulberry32(11);
  let session = createSession();
  const units = {};
  for (let i = 0; i < 60; i++) {
    const t = pickTask({ strings: STD, positions, units, session, now: T0, rand });
    units[t.key] = applyAnswer(units[t.key], { correct: false, now: T0 });
    session = advanceSession(session, t, false);
  }
  assert.ok(Object.keys(units).length <= WORKING_SET, `eingeführt: ${Object.keys(units).length}`);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { cagedPositions, cagedBase, scaleInPosition, playOrder, rootOfGrip, SHAPES, QUALITIES, CAGED_ORDER } from '../src/lib/caged.js';
import { getTuning } from '../src/lib/tunings.js';
import { getScale } from '../src/lib/scales.js';

const STD = getTuning('std-6').strings;
const mod12 = (x) => ((x % 12) + 12) % 12;

test('Offene Griffe sind die richtigen Akkorde', () => {
  for (const [quality, shapes] of Object.entries(SHAPES)) {
    const triad = QUALITIES[quality].triad;
    for (const id of CAGED_ORDER) {
      const sh = shapes[id];
      const pcs = sh.grip.map((f, s) => (f == null ? null : mod12(STD[s] + f - sh.rootPc))).filter((x) => x != null);
      assert.ok(pcs.every((p) => triad.includes(p)), `${quality} ${id}: ${pcs}`);
      assert.deepEqual([...new Set(pcs)].sort((a, b) => a - b), [...triad].sort((a, b) => a - b), `${quality} ${id} vollständig`);
      // Fenster enthält den ganzen Griff
      for (const f of sh.grip) if (f != null) assert.ok(f >= sh.win[0] && f <= sh.win[1], `${quality} ${id} Fenster`);
    }
  }
});

test('C-Dur: Reihenfolge entlang des Halses C → A → G → E → D', () => {
  const pos = cagedPositions(STD, 0, 'major', 15);
  assert.deepEqual(pos.slice(0, 6).map((p) => p.id), ['C', 'A', 'G', 'E', 'D', 'C']);
  assert.deepEqual(pos.slice(0, 5).map((p) => p.shift), [0, 3, 5, 8, 10]);
  // E-Form-Barré in C: Grundton tiefe E-Saite Bund 8
  const e = pos.find((p) => p.id === 'E');
  assert.deepEqual(rootOfGrip(e), { string: 0, fret: 8, midi: 48, semis: 0 });
});

test('G-Dur beginnt mit der E-Form (offen), A-Dur-Barré liegt in der E-Form am 5. Bund', () => {
  const g = cagedPositions(STD, 7, 'major', 12);
  assert.equal(g[0].id, 'G'); // offene G-Form, Bund 0–3
  assert.equal(g.find((p) => p.id === 'E').shift, 3);
  const a = cagedPositions(STD, 9, 'major', 12);
  assert.equal(a.find((p) => p.id === 'E').shift, 5);
  assert.equal(a.find((p) => p.id === 'A').shift, 0);
});

test('Lagen schließen lückenlos aneinander an (jeder Bund gehört zu einer Form)', () => {
  for (const quality of ['major', 'minor']) {
    for (let r = 0; r < 12; r++) {
      const pos = cagedPositions(STD, r, quality, 24).filter((p) => p.hi <= 20);
      for (let f = 3; f <= 15; f++) assert.ok(pos.some((p) => p.lo <= f && f <= p.hi), `${quality} ${r} Bund ${f}`);
    }
  }
});

test('Arpeggio nur Dreiklangstöne, Tonleiter im Fenster; Spielfolge ohne Doppelte', () => {
  const pos = cagedPositions(STD, 9, 'minor', 12).find((p) => p.id === 'E'); // a-Moll E-Form, Bund 5
  assert.ok(pos.arp.every((n) => [0, 3, 7].includes(n.semis)));
  const sc = scaleInPosition(STD, pos, 9, getScale('pent-minor'));
  assert.ok(sc.length >= 12, String(sc.length));
  const seq = playOrder(pos.arp);
  for (let i = 1; i < seq.length; i++) assert.ok(seq[i].midi > seq[i - 1].midi);
  assert.equal(seq[0].semis, 0, 'beginnt mit dem Grundton');
});

test('Stimmungen: Standard und 7-Saiter ja, Drop D nein', () => {
  assert.equal(cagedBase(STD), 0);
  assert.equal(cagedBase(getTuning('std-7', 7).strings), 1);
  assert.equal(cagedBase(getTuning('drop-d-6').strings), null);
  assert.deepEqual(cagedPositions(getTuning('drop-d-6').strings, 0), []);
});

import { cagedUnits, computeCagedUnlocked, makeCagedTask, cagedKey, CAGED_GROUPS, CAGED_FRET_LIMIT } from '../src/lib/caged.js';
import { newUnit } from '../src/lib/srs.js';
import { normalizeProgress } from '../src/lib/stats.js';

test('CAGED-Übung: jede Einheit ergibt eine Aufgabe bis Bund 15, Arpeggio aufwärts', () => {
  for (const u of cagedUnits(CAGED_GROUPS.length)) {
    const t = makeCagedTask(STD, u, 'new');
    assert.ok(t, u.key);
    assert.ok(t.pos.hi <= CAGED_FRET_LIMIT, u.key);
    assert.equal(t.pos.id, u.shape);
    assert.ok(t.seq.length >= 6, `${u.key}: ${t.seq.length}`);
    assert.ok(t.seq.some((n) => n.semis === 0));
  }
  assert.equal(cagedUnits(1).length, 24);
});

test('CAGED-Übung: Freischaltung nach Fortschritt, Lernstand alter Daten', () => {
  assert.equal(computeCagedUnlocked({}, 1), 1);
  const units = {};
  const now = Date.UTC(2026, 9, 28);
  for (const u of cagedUnits(1)) units[u.key] = { ...newUnit(now), n: 4, box: 3, fastDays: ['2026-10-27', '2026-10-28'] };
  assert.ok(computeCagedUnlocked(units, 1) >= 2);
  assert.equal(cagedKey('major', 'E', 9), 'major:E:9');
  assert.deepEqual(normalizeProgress({}).caged, { units: {}, unlocked: 1 });
});

import { rootFirstOrder } from '../src/lib/caged.js';

test('Vom Grundton aus: hoch, runter bis zum tiefsten Ton, zurück zum Grundton', () => {
  const u = { key: 'major:C:0', quality: 'major', shape: 'C', rootPc: 0 };
  const plain = makeCagedTask(STD, u, 'new').seq.map((n) => n.midi);
  assert.deepEqual(plain, [40, 43, 48, 52, 55, 60, 64, 67]); // E G | C E G C E G
  const t = makeCagedTask(STD, u, 'new', { fromRoot: true }).seq.map((n) => n.midi);
  assert.deepEqual(t, [48, 52, 55, 60, 64, 67, 64, 60, 55, 52, 48, 43, 40, 43, 48]);
  // Form beginnt schon mit dem Grundton → unverändert aufwärts
  const e = makeCagedTask(STD, { key: 'major:E:0', quality: 'major', shape: 'E', rootPc: 0 }, 'new');
  assert.deepEqual(rootFirstOrder(e.seq), e.seq);
});

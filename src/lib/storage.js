// Speicherung pro Gerät (localStorage). Safari kann Website-Daten nach längerer
// Nichtnutzung löschen → Export/Import als JSON-Datei, dezente Backup-Erinnerung.
import { DEFAULT_PROGRESS, normalizeProgress } from './stats.js';

const KEY = 'griffbrett-trainer:v1';
export const EXPORT_APP = 'griffbrett-trainer';
export const EXPORT_FORMAT = 1;

export const DEFAULT_SETTINGS = {
  stringCount: 6,
  tuningId: 'std-6',
  a4: 440,
  naming: 'de', // 'de' (H/B) | 'int' (B/B♭)
  accidentals: 'sharp', // 'sharp' | 'flat' | 'both'
  minDb: -75, // Eingangsschwelle (am iPhone mit Gitarre ermittelt, 28.10.2026)
  fretMax: 12, // 12 | 24
  sessionMinutes: 5, // 3 | 5 | 10
  groupMode: 'auto', // 'auto' | 'manual'
  manualGroups: [], // Gruppen-Ids bei groupMode 'manual'
  showGoals: true, // Tagesziel und Wochenziel
  showBests: true, // Bestwerte und Meilensteine
  theme: 'dark', // 'dark' | 'light'
  intervalDir: 'both', // Intervalle: 'both' | 'up' | 'down'
  intervalRootFirst: false, // Intervalle: erst Grundton, dann Intervall spielen
  scaleRoot: 7, // Tonarten: zuletzt gewählter Grundton (Tonklasse, 7 = G)
  scaleId: 'major', // Tonarten: zuletzt gewählte Skala
  scalePattern: 'all', // Tonarten: 'all' (ganzes Griffbrett) | 3 (3NPS) | 2 (2NPS)
  scaleColors: 'mono', // Tonarten: 'mono' (einfarbig, Grundton hervorgehoben) | 'degree' (Stufenfarben)
  micExplained: false,
};

export function loadData() {
  try {
    const raw = localStorage.getItem(KEY);
    const data = raw ? JSON.parse(raw) : {};
    return { settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) }, progress: normalizeProgress(data.progress) };
  } catch {
    return { settings: { ...DEFAULT_SETTINGS }, progress: normalizeProgress(null) };
  }
}

export function saveData(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function buildExport(data, now = Date.now()) {
  return JSON.stringify({
    app: EXPORT_APP,
    format: EXPORT_FORMAT,
    exportedAt: new Date(now).toISOString(),
    settings: data.settings,
    progress: data.progress,
  });
}

/** Prüft eine importierte Datei. → { ok: true, data } | { ok: false, error } */
export function parseImport(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Die Datei ist kein gültiges JSON.' };
  }
  if (!obj || obj.app !== EXPORT_APP) return { ok: false, error: 'Die Datei stammt nicht aus dem Griffbrett-Trainer.' };
  if (obj.format > EXPORT_FORMAT) return { ok: false, error: 'Die Datei stammt aus einer neueren Version der App.' };
  if (!obj.progress || typeof obj.progress.units !== 'object') return { ok: false, error: 'In der Datei ist kein Lernstand enthalten.' };
  return {
    ok: true,
    data: { settings: { ...DEFAULT_SETTINGS, ...(obj.settings || {}), micExplained: true }, progress: normalizeProgress(obj.progress) },
    exportedAt: obj.exportedAt,
  };
}

export function emptyProgress() {
  return normalizeProgress(DEFAULT_PROGRESS);
}

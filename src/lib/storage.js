// Speicherung pro Gerät (localStorage). Safari kann Website-Daten nach längerer
// Nichtnutzung löschen → Export/Import (JSON) kommt mit Version 1.

const KEY = 'griffbrett-trainer:v1';

export const DEFAULT_SETTINGS = {
  stringCount: 6,
  tuningId: 'std-6',
  a4: 440,
  naming: 'de', // 'de' (H/B) | 'int' (B/B♭)
  accidentals: 'sharp', // 'sharp' | 'flat' | 'both'
  minDb: -50, // Eingangsschwelle
  fretMax: 12,
  sessionMinutes: 5,
  micExplained: false,
};

export function loadData() {
  try {
    const raw = localStorage.getItem(KEY);
    const data = raw ? JSON.parse(raw) : {};
    return { ...data, settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) } };
  } catch {
    return { settings: { ...DEFAULT_SETTINGS } };
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

// Lernstand als Datei sichern / laden (Browser).
import { buildExport } from '../lib/storage.js';
import { dayKey } from '../lib/srs.js';

/**
 * Exportiert als JSON. Auf dem iPhone öffnet sich das Teilen-Menü („In Dateien sichern“),
 * sonst wird die Datei heruntergeladen. Rückgabe: true, wenn exportiert (nicht abgebrochen).
 */
export async function exportToFile(data) {
  const json = buildExport(data);
  const name = `griffbrett-trainer-${dayKey(Date.now())}.json`;
  const file = typeof File !== 'undefined' ? new File([json], name, { type: 'application/json' }) : null;
  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Griffbrett-Trainer Lernstand' });
      return true;
    } catch (e) {
      if (e && e.name === 'AbortError') return false;
    }
  }
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}

export function readFileText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

import React from 'react';
import { Shield, X } from 'lucide-react';

// ==========================================
// IMPRESSUM & DATENSCHUTZ
// ==========================================

export const IMPRESSUM = {
  name: 'Peter Brandsch',
  street: 'Großhurdener Berg 40b',
  city: '51491 Overath',
  email: 'p.brandsch@gmx.de',
};

export function LegalModal({ onClose }) {
  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border-2 border-slate-700 rounded-3xl max-w-lg w-full p-6 max-h-[85vh] overflow-y-auto relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} aria-label="Schließen" className="absolute top-4 right-4 text-slate-400 bg-slate-800 rounded-full p-2">
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-black mb-3">Impressum</h2>
        <div className="text-sm text-slate-300 leading-relaxed mb-6">
          <p>
            {IMPRESSUM.name}
            <br />
            {IMPRESSUM.street}
            <br />
            {IMPRESSUM.city}
          </p>
          <p className="mt-2">
            E-Mail:{' '}
            <a href={`mailto:${IMPRESSUM.email}`} className="text-indigo-300 underline underline-offset-2">
              {IMPRESSUM.email}
            </a>
          </p>
          <p className="mt-2">Verantwortlich für den Inhalt: {IMPRESSUM.name}, Anschrift wie oben.</p>
        </div>
        <div className="flex items-center gap-3 mb-3 pt-5 border-t-2 border-slate-800">
          <Shield className="w-6 h-6 text-indigo-400" />
          <h2 className="text-xl font-black">Datenschutz</h2>
        </div>
        <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
          <p>Verantwortlich: {IMPRESSUM.name} (Kontakt siehe Impressum). Der Griffbrett-Trainer ist ein privates, nicht-kommerzielles Projekt ohne Konten, Werbung oder Analyse-Dienste.</p>
          <div>
            <p className="font-bold text-slate-100 mb-1">Mikrofon</p>
            <p>Das Mikrofonsignal wird ausschließlich lokal in deinem Browser ausgewertet, um die Tonhöhe zu bestimmen. Es wird nicht aufgezeichnet, nicht gespeichert und nicht übertragen. Das Mikrofon ist nur aktiv, solange Stimmgerät, Diagnose oder eine Übung geöffnet ist.</p>
          </div>
          <div>
            <p className="font-bold text-slate-100 mb-1">Gespeicherte Daten</p>
            <p>Einstellungen und Lernstand liegen nur im lokalen Speicher (localStorage) dieses Geräts. Es gibt keine Cookies und keinen Server, der diese Daten erhält. Du kannst sie löschen, indem du die Website-Daten im Browser entfernst.</p>
          </div>
          <div>
            <p className="font-bold text-slate-100 mb-1">Hosting</p>
            <p>Die App wird über GitHub Pages (GitHub Inc., USA) ausgeliefert. Beim Aufruf verarbeitet GitHub technisch notwendige Verbindungsdaten wie die IP-Adresse. Alle Dateien der App werden von mitlaeuferfotografie.github.io geladen, es werden keine weiteren Drittanbieter eingebunden.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect } from 'react';
import { ChevronLeft, Mic, MicOff, Pause } from 'lucide-react';
import { startMic, stopMic } from '../audio/mic.js';
import { useMicStatus, useWakeLock } from './hooks.js';

export const BUILD = typeof __BUILD__ !== 'undefined' ? __BUILD__ : 'dev';

export function fmtCents(c) {
  const r = Math.round(c);
  return `${r > 0 ? '+' : r < 0 ? '−' : '±'}${Math.abs(r)}`;
}

export function namesOf(settings) {
  return { naming: settings.naming, accidentals: settings.accidentals };
}

// ==========================================
// BAUSTEINE
// ==========================================

export function Card({ children, className = '' }) {
  return <div className={`bg-slate-900 border-2 border-slate-800 rounded-3xl p-5 ${className}`}>{children}</div>;
}

export function Header({ title, onBack, right }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Zurück"
          className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-900 border-2 border-slate-800 text-slate-300 active:scale-95 transition-transform"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}
      <h1 className="text-2xl font-black tracking-tight flex-1">{title}</h1>
      {right}
    </div>
  );
}

export function Segmented({ options, value, onChange }) {
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={`flex-1 py-3 px-2 rounded-2xl border-2 font-bold text-sm transition-colors ${
            value === o.value
              ? 'bg-indigo-600 border-indigo-400 text-white'
              : 'bg-slate-950 border-slate-800 text-slate-300'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function LevelMeter({ db, minDb }) {
  const pct = (v) => Math.max(0, Math.min(100, ((v + 90) / 90) * 100));
  const above = db >= minDb;
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-400 mb-1 tabular">
        <span>Eingang</span>
        <span>{db > -120 ? `${Math.round(db)} dB` : '–'}</span>
      </div>
      <div className="relative h-3 rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-75 ${above ? 'bg-indigo-400' : 'bg-slate-600'}`}
          style={{ width: `${pct(db)}%` }}
        />
        <div className="absolute inset-y-0 w-0.5 bg-slate-200" style={{ left: `${pct(minDb)}%` }} />
      </div>
    </div>
  );
}

// ==========================================
// MIKROFON-ZUGANG
// ==========================================

const MIC_ERRORS = {
  denied: {
    title: 'Mikrofon nicht erlaubt',
    text: 'So erlaubst du es wieder: In Safari auf „aA“ in der Adressleiste → Website-Einstellungen → Mikrofon → Erlauben. Oder in den iOS-Einstellungen → Apps → Safari → Mikrofon. Danach die Seite neu laden.',
  },
  insecure: { title: 'Keine sichere Verbindung', text: 'Das Mikrofon funktioniert nur über https. Öffne die App über die GitHub-Pages-Adresse.' },
  unsupported: { title: 'Nicht unterstützt', text: 'Dieser Browser bietet keinen Mikrofonzugriff an.' },
  nodevice: { title: 'Kein Mikrofon gefunden', text: 'Es wurde kein Eingang gefunden.' },
  busy: { title: 'Mikrofon belegt', text: 'Eine andere App nutzt gerade das Mikrofon (z. B. ein Anruf). Beende sie und versuche es erneut.' },
  unknown: { title: 'Mikrofon-Fehler', text: 'Das Mikrofon konnte nicht gestartet werden.' },
};

export function MicGate({ settings, update, children, onTapMode }) {
  const mic = useMicStatus();
  useWakeLock(mic.status === 'running');
  useEffect(() => () => stopMic(), []);

  if (mic.status === 'running') return children;

  const start = () => {
    if (!settings.micExplained) update({ micExplained: true });
    startMic();
  };

  if (mic.status === 'starting') {
    return <Card className="text-center text-slate-300 py-10">Mikrofon wird gestartet …</Card>;
  }

  if (mic.status === 'interrupted') {
    return (
      <Card className="text-center">
        <Pause className="w-10 h-10 mx-auto text-slate-400 mb-3" />
        <p className="font-bold text-lg mb-1">Mikrofon pausiert</p>
        <p className="text-slate-400 text-sm mb-5">iOS hat die Audioverbindung unterbrochen (Bildschirmsperre oder App-Wechsel).</p>
        <button onClick={start} className="w-full py-4 rounded-2xl bg-indigo-600 border-2 border-indigo-400 font-black text-lg active:scale-95 transition-transform">
          Fortsetzen
        </button>
      </Card>
    );
  }

  if (mic.status === 'error') {
    const e = MIC_ERRORS[mic.error] || MIC_ERRORS.unknown;
    return (
      <Card>
        <MicOff className="w-10 h-10 text-rose-400 mb-3" />
        <p className="font-bold text-lg mb-2">{e.title}</p>
        <p className="text-slate-300 text-sm leading-relaxed mb-5">{e.text}</p>
        {mic.error !== 'insecure' && mic.error !== 'unsupported' && (
          <button onClick={start} className="w-full py-4 rounded-2xl bg-slate-800 border-2 border-slate-700 font-bold active:scale-95 transition-transform">
            Erneut versuchen
          </button>
        )}
        {onTapMode && (
          <button onClick={onTapMode} className="w-full mt-3 py-3 rounded-2xl bg-slate-950 border-2 border-slate-800 font-bold text-slate-300 active:scale-95 transition-transform">
            Ohne Mikrofon üben (Antippen)
          </button>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <Mic className="w-10 h-10 text-indigo-400 mb-3" />
      <p className="font-black text-xl mb-2">Mikrofon</p>
      <p className="text-slate-300 text-sm leading-relaxed mb-3">
        Die App hört über das Mikrofon, welchen Ton du spielst. Das Signal wird nur hier auf dem Gerät ausgewertet. Nichts wird aufgenommen, gespeichert oder übertragen.
      </p>
      {!settings.micExplained && <p className="text-slate-300 text-sm leading-relaxed mb-3">Gleich fragt Safari nach der Erlaubnis.</p>}
      <p className="text-slate-400 text-sm leading-relaxed mb-5">
        Tipp: Eine unverstärkte E-Gitarre ist fürs Handy-Mikrofon sehr leise. Besser leise über Amp oder Kopfhörer-Amp, oder die Westerngitarre.
      </p>
      <button onClick={start} className="w-full py-4 rounded-2xl bg-indigo-600 border-2 border-indigo-400 font-black text-lg active:scale-95 transition-transform">
        Mikrofon starten
      </button>
      {onTapMode && (
        <button onClick={onTapMode} className="w-full mt-3 py-3 rounded-2xl bg-slate-950 border-2 border-slate-800 font-bold text-slate-300 active:scale-95 transition-transform">
          Ohne Mikrofon üben (Antippen)
        </button>
      )}
    </Card>
  );
}

/**
 * Übungs-Layout: im Hochformat untereinander, im Querformat nebeneinander
 * (links die Aufgabe, rechts Griffbrett/Eingabe). Der erste Abstand rechts entfällt quer.
 */
export function Split({ left, right }) {
  return (
    <div className="landscape:grid landscape:grid-cols-2 landscape:gap-4 landscape:items-start">
      <div>{left}</div>
      <div className="landscape:[&>*:first-child]:mt-0">{right}</div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronDown, ChevronRight, Mic, MicOff, Pause } from 'lucide-react';
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

/** Ausklappbarer Abschnitt; zugeklappt zeigt `summary` die aktuelle Wahl. */
export function Collapsible({ title, summary, icon: Icon, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl mb-3 overflow-hidden">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-center gap-3 px-5 py-4 text-left">
        {Icon && <Icon className="w-5 h-5 text-indigo-400 flex-shrink-0" />}
        <span className="flex-1 min-w-0">
          <span className="block font-black">{title}</span>
          {!open && summary && <span className="block text-sm text-slate-400 truncate">{summary}</span>}
        </span>
        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

/** Kompaktes Auswahlfeld (natives select → auf dem iPhone die Auswahl-Walze). */
export function SelectField({ label, value, onChange, children, className = '' }) {
  return (
    <label className={`relative block ${className}`}>
      <span className="block text-[11px] uppercase tracking-widest text-slate-400 font-bold mb-1">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-slate-950 border-2 border-slate-800 rounded-2xl pl-4 pr-10 py-3 font-black text-lg text-slate-100 focus:border-indigo-400 outline-none"
      >
        {children}
      </select>
      <ChevronDown className="absolute right-3 bottom-4 w-5 h-5 text-slate-400 pointer-events-none" />
    </label>
  );
}

/** Zeile in einer Liste (Menü „Mehr“, weitere Übungen). */
export function ListRow({ icon: Icon, title, text, onClick }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-4 px-4 py-3.5 text-left active:bg-slate-800/60 transition-colors">
      <span className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-black leading-tight">{title}</span>
        {text && <span className="block text-xs text-slate-400 mt-0.5">{text}</span>}
      </span>
      <ChevronRight className="w-5 h-5 text-slate-500 flex-shrink-0" />
    </button>
  );
}

/** Reiter-Leiste unten (wie bei iPhone-Apps). tabs: [{ id, label, icon }] */
export function TabBar({ tabs, active, onChange }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 bg-slate-900/95 backdrop-blur border-t-2 border-slate-800 tabbar-safe">
      <div className="max-w-md landscape:max-w-4xl mx-auto flex">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            aria-current={active === id ? 'page' : undefined}
            className={`flex-1 flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-bold transition-colors ${active === id ? 'text-indigo-300' : 'text-slate-500'}`}
          >
            <Icon className="w-6 h-6" />
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}

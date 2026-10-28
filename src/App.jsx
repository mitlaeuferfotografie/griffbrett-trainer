import React, { useState, useEffect, useCallback } from 'react';
import {
  Gauge, Activity, Settings, Play, BarChart3, Layers, Timer, HardDriveDownload, ArrowLeftToLine, Shapes, Music, Ellipsis, Shield, Smartphone, Sparkles, Grid3x3,
} from 'lucide-react';
import { startMic } from './audio/mic.js';
import { getTuning, tuningNotes } from './lib/tunings.js';
import { loadData, saveData, isStandalone, isIOS, requestPersistence } from './lib/storage.js';
import { todaySeconds, weekDays, WEEK_GOAL_DAYS, needsBackup } from './lib/stats.js';
import { BUILD, namesOf, ListRow, TabBar } from './ui/common.jsx';
import { Ring } from './ui/board.jsx';
import { exportToFile } from './ui/backup.js';
import { TunerView } from './views/Tuner.jsx';
import { DiagnoseView } from './views/Diagnose.jsx';
import { SettingsView } from './views/Settings.jsx';
import { LegalModal } from './views/Legal.jsx';
import { TrainingView } from './views/Training.jsx';
import { OneNoteView } from './views/OneNote.jsx';
import { ChallengeView } from './views/Challenge.jsx';
import { ProgressView, UnlockCard } from './views/Progress.jsx';
import { ArcadeView } from './views/Arcade.jsx';
import { IntervalsView } from './views/Intervals.jsx';
import { ScalesView } from './views/Scales.jsx';
import { ImprovView } from './views/Improv.jsx';
import { CagedTrainerView } from './views/CagedTrainer.jsx';

// Reiter unten; alle anderen Ansichten (Übungen, Stimmgerät …) laufen ohne Reiter-Leiste
// im Vollbild und kehren mit „Zurück“ zum Reiter zurück, von dem sie geöffnet wurden.
const TABS = [
  { id: 'menu', label: 'Üben', icon: Play },
  { id: 'scales', label: 'Tonarten', icon: Music },
  { id: 'tuner', label: 'Stimmgerät', icon: Gauge, mic: true },
  { id: 'progress', label: 'Fortschritt', icon: BarChart3 },
  { id: 'more', label: 'Mehr', icon: Ellipsis },
];
const TAB_IDS = TABS.map((t) => t.id);

// ==========================================
// REITER „ÜBEN“
// ==========================================

function Menu({ settings, update, progress, go, onExport, onSnooze }) {
  const showHomeHint = isIOS() && !isStandalone() && !settings.homeHintDismissed;
  const hasProgress = Object.keys(progress.units).length > 0 || progress.totals.answers > 0;
  const names = namesOf(settings);
  const tuning = getTuning(settings.tuningId, settings.stringCount);
  const now = Date.now();
  const today = todaySeconds(progress, now);
  const goal = settings.sessionMinutes * 60;
  const week = weekDays(progress, now);
  return (
    <div>
      <div className="mb-4 mt-2">
        <h1 className="text-3xl font-black tracking-tight">Griffbrett-Trainer</h1>
        <p className="text-slate-400 mt-1 text-sm">
          {tuning.label(names)} · {tuningNotes(tuning, names)} · a′ = {settings.a4} Hz
        </p>
      </div>

      {showHomeHint && (
        <div className="mb-3 p-4 rounded-3xl border-2 border-indigo-400/60 bg-slate-900">
          <div className="flex items-start gap-3">
            <Smartphone className="w-6 h-6 text-indigo-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">Am sichersten als App vom Home-Bildschirm</p>
              <p className="text-sm text-slate-400">
                In Safari unten auf das Teilen-Symbol, dann „Zum Home-Bildschirm“. Dort bleibt dein Lernstand dauerhaft gespeichert und die App startet im Vollbild.
              </p>
              {hasProgress && (
                <p className="text-sm text-slate-400 mt-1">
                  Die Home-Bildschirm-App hat einen eigenen Speicher: Exportiere hier vorher deinen Lernstand und importiere ihn dort unter Mehr → Einstellungen → Lernstand.
                </p>
              )}
              <div className="flex gap-2 mt-3">
                {hasProgress && (
                  <button onClick={onExport} className="px-4 py-2 rounded-xl bg-indigo-600 border-2 border-indigo-400 text-white font-bold text-sm">
                    Lernstand exportieren
                  </button>
                )}
                <button onClick={() => update({ homeHintDismissed: true })} className="px-4 py-2 rounded-xl bg-slate-800 border-2 border-slate-700 font-bold text-sm">
                  Ausblenden
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {needsBackup(progress, now) && (
        <div className="mb-3 p-4 rounded-3xl border-2 border-slate-700 bg-slate-900">
          <div className="flex items-start gap-3">
            <HardDriveDownload className="w-6 h-6 text-indigo-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">Lernstand sichern?</p>
              <p className="text-sm text-slate-400">Safari kann Website-Daten nach längerer Pause löschen. Eine Sicherung als Datei schützt deinen Fortschritt.</p>
              <div className="flex gap-2 mt-3">
                <button onClick={onExport} className="px-4 py-2 rounded-xl bg-indigo-600 border-2 border-indigo-400 text-white font-bold text-sm">
                  Exportieren
                </button>
                <button onClick={onSnooze} className="px-4 py-2 rounded-xl bg-slate-800 border-2 border-slate-700 font-bold text-sm">
                  Später
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="landscape:grid landscape:grid-cols-2 landscape:gap-3">
        <div>
          <div className="rounded-3xl border-2 border-indigo-400 bg-indigo-600 text-white p-5 mb-3">
            <button onClick={() => go('train', true)} className="w-full flex items-center gap-4 text-left active:scale-[0.98] transition-transform">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500 flex items-center justify-center flex-shrink-0">
                <Play className="w-9 h-9" fill="currentColor" />
              </div>
              <div className="flex-1">
                <div className="text-3xl font-black">Start</div>
                <div className="text-indigo-100">Ton finden · {settings.sessionMinutes} Minuten</div>
              </div>
            </button>
            <div className="flex gap-2 mt-4">
              {[3, 5, 10].map((m) => (
                <button
                  key={m}
                  onClick={() => update({ sessionMinutes: m })}
                  className={`flex-1 py-2 rounded-xl border-2 font-bold text-sm ${
                    settings.sessionMinutes === m ? 'bg-white text-indigo-700 border-white' : 'border-indigo-400 text-indigo-100'
                  }`}
                >
                  {m} Min
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border-2 border-slate-800 bg-slate-900 p-4 mb-3">
            {settings.showGoals && (
              <div className="flex items-center gap-4 mb-4">
                <Ring value={today / goal} done={today >= goal} size={52} stroke={6}>
                  <span className="text-xs font-black tabular">{Math.floor(today / 60)}′</span>
                </Ring>
                <div className="text-sm">
                  <p className="font-bold">{today >= goal ? 'Tagesziel erreicht' : `Heute ${Math.floor(today / 60)} von ${settings.sessionMinutes} Minuten`}</p>
                  <p className="text-slate-400">
                    Diese Woche {week} von {WEEK_GOAL_DAYS} Übungstagen
                  </p>
                </div>
              </div>
            )}
            <UnlockCard settings={settings} progress={progress} compact />
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-2 ml-1">Weitere Übungen</p>
          <div className="rounded-3xl border-2 border-slate-800 bg-slate-900 overflow-hidden divide-y divide-slate-800 mb-3">
            <ListRow icon={Sparkles} title="Improvisieren" text="Was spiele ich da? Live-Stufen und Auswertung" onClick={() => go('improv')} />
            <ListRow icon={Shapes} title="Intervalle" text="Griff-Formen vom Grundton aus" onClick={() => go('intervals')} />
            <ListRow icon={Grid3x3} title="CAGED" text="Akkord in einer Form finden, Arpeggio spielen" onClick={() => go('caged')} />
            <ListRow icon={Layers} title="Ein Ton – alle Saiten" text="Oktav-Verbindungen" onClick={() => go('onenote')} />
            <ListRow icon={ArrowLeftToLine} title="Tonlauf" text="Im richtigen Moment spielen, wird schneller" onClick={() => go('arcade')} />
            <ListRow icon={Timer} title="Challenge" text="Eine Saite auf Zeit" onClick={() => go('challenge')} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// REITER „MEHR“
// ==========================================

function More({ go, onPrivacy }) {
  return (
    <div>
      <h1 className="text-3xl font-black tracking-tight mt-2 mb-4">Mehr</h1>
      <div className="rounded-3xl border-2 border-slate-800 bg-slate-900 overflow-hidden divide-y divide-slate-800 mb-3">
        <ListRow icon={Settings} title="Einstellungen" text="Instrument, Training, Anzeige, Lernstand" onClick={() => go('settings')} />
        <ListRow icon={Activity} title="Diagnose" text="Tonerkennung live prüfen, Selbsttest" onClick={() => go('diagnose', true)} />
        <ListRow icon={Shield} title="Impressum · Datenschutz" onClick={onPrivacy} />
      </div>
      <p className="text-center text-xs text-slate-600 mt-6">Version {BUILD}</p>
    </div>
  );
}

// ==========================================
// APP
// ==========================================

export default function App() {
  const [data, setData] = useState(() => loadData());
  const [view, setView] = useState('menu');
  const [tab, setTab] = useState('menu');
  const [runKey, setRunKey] = useState(0);
  const [privacy, setPrivacy] = useState(false);
  const [storageStatus, setStorageStatus] = useState('unknown');
  const { settings, progress } = data;

  useEffect(() => {
    saveData(data);
  }, [data]);

  // Dauerhaften Speicher anfordern (iOS löscht die Daten dann nicht automatisch)
  useEffect(() => {
    requestPersistence().then(setStorageStatus);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', settings.theme === 'light' ? '#f1f5f9' : '#020617');
  }, [settings.theme]);

  const update = useCallback((patch) => setData((d) => ({ ...d, settings: { ...d.settings, ...patch } })), []);
  const setProgress = useCallback((fn) => setData((d) => ({ ...d, progress: fn(d.progress) })), []);

  // Mikrofon direkt im Tipp starten (iOS verlangt eine Nutzergeste), sofern schon erklärt
  const go = (v, needsMic) => {
    if (needsMic && settings.micExplained) startMic();
    if (v === 'train') setRunKey((k) => k + 1);
    if (TAB_IDS.includes(v)) setTab(v);
    setView(v);
    window.scrollTo(0, 0);
  };
  const back = () => go(tab);
  const isTab = TAB_IDS.includes(view);

  const onExport = async () => {
    if (await exportToFile(data)) setProgress((p) => ({ ...p, lastExport: Date.now() }));
  };

  return (
    <div className={`min-h-screen bg-slate-950 text-slate-100 safe-area ${isTab ? 'with-tabbar' : ''}`}>
      <div className="max-w-md landscape:max-w-4xl mx-auto">
        {view === 'menu' && (
          <Menu
            settings={settings}
            update={update}
            progress={progress}
            go={go}
            onExport={onExport}
            onSnooze={() => setProgress((p) => ({ ...p, backupSnooze: Date.now() }))}
          />
        )}
        {view === 'more' && <More go={go} onPrivacy={() => setPrivacy(true)} />}
        {view === 'train' && (
          <TrainingView
            key={runKey}
            settings={settings}
            update={update}
            progress={progress}
            setProgress={setProgress}
            onBack={back}
            onDone={{ again: () => go('train', true), menu: back }}
          />
        )}
        {view === 'onenote' && <OneNoteView settings={settings} update={update} setProgress={setProgress} onBack={back} />}
        {view === 'challenge' && <ChallengeView settings={settings} update={update} progress={progress} setProgress={setProgress} onBack={back} />}
        {view === 'improv' && <ImprovView settings={settings} update={update} setProgress={setProgress} onBack={back} />}
        {view === 'scales' && <ScalesView settings={settings} update={update} progress={progress} setProgress={setProgress} />}
        {view === 'intervals' && <IntervalsView settings={settings} update={update} progress={progress} setProgress={setProgress} onBack={back} />}
        {view === 'caged' && <CagedTrainerView settings={settings} update={update} progress={progress} setProgress={setProgress} onBack={back} />}
        {view === 'arcade' && <ArcadeView settings={settings} update={update} progress={progress} setProgress={setProgress} onBack={back} />}
        {view === 'progress' && <ProgressView settings={settings} progress={progress} />}
        {view === 'tuner' && <TunerView settings={settings} update={update} />}
        {view === 'diagnose' && <DiagnoseView settings={settings} update={update} onBack={back} />}
        {view === 'settings' && <SettingsView settings={settings} update={update} data={data} setData={setData} onBack={back} storageStatus={storageStatus} />}
      </div>
      {isTab && <TabBar tabs={TABS} active={view} onChange={(id) => go(id, TABS.find((t) => t.id === id).mic)} />}
      {privacy && <LegalModal onClose={() => setPrivacy(false)} />}
    </div>
  );
}

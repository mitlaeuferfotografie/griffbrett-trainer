import React, { useState, useEffect, useCallback } from 'react';
import { Gauge, Activity, Settings, Play, BarChart3, Layers, Timer, HardDriveDownload, ArrowDownToLine, Shapes, Music } from 'lucide-react';
import { startMic } from './audio/mic.js';
import { getTuning, tuningNotes } from './lib/tunings.js';
import { loadData, saveData } from './lib/storage.js';
import { todaySeconds, weekDays, WEEK_GOAL_DAYS, needsBackup } from './lib/stats.js';
import { BUILD, namesOf } from './ui/common.jsx';
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

// ==========================================
// MENÜ
// ==========================================

function Tile({ icon: Icon, title, text, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-2 p-4 rounded-3xl border-2 bg-slate-900 border-slate-800 text-left transition-transform active:scale-[0.97]"
    >
      <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-slate-800">
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <div className="font-black leading-tight">{title}</div>
        <div className="text-xs text-slate-400 mt-0.5">{text}</div>
      </div>
    </button>
  );
}

function WideTile({ icon: Icon, title, text, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 mb-3 rounded-3xl border-2 bg-slate-900 border-slate-800 text-left transition-transform active:scale-[0.98]"
    >
      <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-slate-800 flex-shrink-0">
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1">
        <div className="font-black leading-tight">{title}</div>
        <div className="text-xs text-slate-400 mt-0.5">{text}</div>
      </div>
    </button>
  );
}

function Menu({ settings, update, progress, go, onPrivacy, onExport, onSnooze }) {
  const names = namesOf(settings);
  const tuning = getTuning(settings.tuningId, settings.stringCount);
  const now = Date.now();
  const today = todaySeconds(progress, now);
  const goal = settings.sessionMinutes * 60;
  const week = weekDays(progress, now);
  return (
    <div>
      <div className="mb-5 mt-2">
        <h1 className="text-3xl font-black tracking-tight">Griffbrett-Trainer</h1>
        <p className="text-slate-400 mt-1">
          {tuning.label(names)} · {tuningNotes(tuning, names)} · a′ = {settings.a4} Hz
        </p>
      </div>

      {needsBackup(progress, now) && (
        <div className="mb-4 p-4 rounded-3xl border-2 border-slate-700 bg-slate-900">
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
            <Ring value={today / goal} done={today >= goal} size={56} stroke={6}>
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

      <WideTile icon={Shapes} title="Intervalle" text="Griff-Formen vom Grundton aus (Stufe 2)" onClick={() => go('intervals')} />
      <WideTile icon={Music} title="Tonarten" text="Dur, Moll, Modi, Pentatonik – ganzes Griffbrett mit Stufen" onClick={() => go('scales')} />
      <WideTile icon={ArrowDownToLine} title="Fallende Töne" text="Im richtigen Moment spielen, wird immer schneller" onClick={() => go('arcade')} />

      <div className="grid grid-cols-2 gap-3">
        <Tile icon={BarChart3} title="Fortschritt" text="Heatmap, Kalender, Bestwerte" onClick={() => go('progress')} />
        <Tile icon={Layers} title="Ein Ton – alle Saiten" text="Oktav-Verbindungen" onClick={() => go('onenote')} />
        <Tile icon={Timer} title="Challenge" text="Eine Saite auf Zeit" onClick={() => go('challenge')} />
        <Tile icon={Gauge} title="Stimmgerät" text="Chromatisch" onClick={() => go('tuner', true)} />
        <Tile icon={Activity} title="Diagnose" text="Tonerkennung prüfen" onClick={() => go('diagnose', true)} />
        <Tile icon={Settings} title="Einstellungen" text="Saiten, Stimmung, Lernstand" onClick={() => go('settings')} />
      </div>

      <div className="text-center mt-8 text-xs text-slate-500">
        <button onClick={onPrivacy} className="underline underline-offset-2">
          Impressum · Datenschutz
        </button>
        <p className="mt-2 text-slate-600">Version {BUILD}</p>
      </div>
    </div>
  );
}

// ==========================================
// APP
// ==========================================

export default function App() {
  const [data, setData] = useState(() => loadData());
  const [view, setView] = useState('menu');
  const [runKey, setRunKey] = useState(0);
  const [privacy, setPrivacy] = useState(false);
  const { settings, progress } = data;

  useEffect(() => {
    saveData(data);
  }, [data]);

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
    setView(v);
    window.scrollTo(0, 0);
  };
  const back = () => go('menu');

  const onExport = async () => {
    if (await exportToFile(data)) setProgress((p) => ({ ...p, lastExport: Date.now() }));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 safe-area">
      <div className="max-w-md mx-auto">
        {view === 'menu' && (
          <Menu
            settings={settings}
            update={update}
            progress={progress}
            go={go}
            onPrivacy={() => setPrivacy(true)}
            onExport={onExport}
            onSnooze={() => setProgress((p) => ({ ...p, backupSnooze: Date.now() }))}
          />
        )}
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
        {view === 'scales' && <ScalesView settings={settings} update={update} setProgress={setProgress} onBack={back} />}
        {view === 'intervals' && <IntervalsView settings={settings} update={update} progress={progress} setProgress={setProgress} onBack={back} />}
        {view === 'arcade' && <ArcadeView settings={settings} update={update} progress={progress} setProgress={setProgress} onBack={back} />}
        {view === 'progress' && <ProgressView settings={settings} progress={progress} onBack={back} />}
        {view === 'tuner' && <TunerView settings={settings} update={update} onBack={back} />}
        {view === 'diagnose' && <DiagnoseView settings={settings} update={update} onBack={back} />}
        {view === 'settings' && (
          <SettingsView settings={settings} update={update} data={data} setData={setData} onBack={back} onPrivacy={() => setPrivacy(true)} />
        )}
      </div>
      {privacy && <LegalModal onClose={() => setPrivacy(false)} />}
    </div>
  );
}

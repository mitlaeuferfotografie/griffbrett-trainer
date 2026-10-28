import React, { useRef, useState } from 'react';
import { Minus, Plus, Download, Upload, RotateCcw, Guitar, Timer, Type, Mic, Trophy, HardDrive, ShieldCheck, ShieldAlert } from 'lucide-react';
import { getTuning, tuningsFor, tuningNotes, DEFAULT_TUNING } from '../lib/tunings.js';
import { buildGroups, groupLabel } from '../lib/curriculum.js';
import { parseImport, emptyProgress, isStandalone, isIOS } from '../lib/storage.js';
import { Header, Segmented, Collapsible, namesOf } from '../ui/common.jsx';
import { exportToFile, readFileText } from '../ui/backup.js';

// Einstellungen in ausklappbaren Abschnitten; zugeklappt zeigt jeder Abschnitt die aktuelle Wahl.

function Section({ title, children, hint }) {
  return (
    <div className="mb-5 last:mb-0">
      <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-2">{title}</p>
      {children}
      {hint && <p className="text-xs text-slate-500 mt-1.5">{hint}</p>}
    </div>
  );
}

function Toggle({ label, value, onChange }) {
  return (
    <button onClick={() => onChange(!value)} className="w-full flex items-center justify-between py-2">
      <span className="font-bold text-left">{label}</span>
      <span className={`w-12 h-7 rounded-full p-1 transition-colors flex-shrink-0 ${value ? 'bg-indigo-500' : 'bg-slate-700'}`}>
        <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${value ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  );
}

export function SettingsView({ settings, update, data, setData, onBack, storageStatus }) {
  const names = namesOf(settings);
  const tunings = tuningsFor(settings.stringCount);
  const tuning = getTuning(settings.tuningId, settings.stringCount);
  const groups = buildGroups(tuning.strings);
  const sharpLabel = settings.naming === 'int' ? 'F♯' : 'Fis';
  const flatLabel = settings.naming === 'int' ? 'G♭' : 'Ges';
  const fileRef = useRef(null);
  const [message, setMessage] = useState(null);
  const [pendingImport, setPendingImport] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const toggleGroup = (id) => {
    const set = new Set(settings.manualGroups);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    update({ manualGroups: groups.map((g) => g.id).filter((g) => set.has(g)) });
  };

  const doExport = async () => {
    const ok = await exportToFile(data);
    if (ok) {
      setData((d) => ({ ...d, progress: { ...d.progress, lastExport: Date.now() } }));
      setMessage({ ok: true, text: 'Lernstand exportiert.' });
    }
  };

  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const r = parseImport(await readFileText(file));
    if (!r.ok) setMessage({ ok: false, text: r.error });
    else setPendingImport(r);
  };

  const accLabel = { sharp: sharpLabel, flat: flatLabel, both: `${sharpLabel}/${flatLabel}` }[settings.accidentals];
  const lastExport = data.progress.lastExport ? new Date(data.progress.lastExport).toLocaleDateString('de-DE') : null;
  const standalone = isStandalone();
  const persisted = storageStatus === 'persisted';
  const safe = persisted && (standalone || !isIOS());
  const storageText = [
    persisted ? 'Speicher dauerhaft' : storageStatus === 'not-persisted' ? 'Speicher nicht dauerhaft' : storageStatus === 'unsupported' ? 'dauerhafter Speicher nicht verfügbar' : 'Speicher wird geprüft …',
    isIOS() ? (standalone ? 'Home-Bildschirm-App' : 'im Safari-Tab') : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div>
      <Header title="Einstellungen" onBack={onBack} />

      <Collapsible
        title="Instrument"
        icon={Guitar}
        summary={`${settings.stringCount} Saiten · ${tuning.label(names)} (${tuningNotes(tuning, names)}) · a′ ${settings.a4} Hz`}
      >
        <Section title="Saiten">
          <Segmented
            options={[{ value: 6, label: '6 Saiten' }, { value: 7, label: '7 Saiten' }]}
            value={settings.stringCount}
            onChange={(n) => update({ stringCount: n, tuningId: DEFAULT_TUNING[n], manualGroups: [] })}
          />
        </Section>
        <Section title="Stimmung" hint="Der Trainer fragt die Töne ab, die du in dieser Stimmung greifst.">
          <div className="flex flex-col gap-2">
            {tunings.map((t) => (
              <button
                key={t.id}
                onClick={() => update({ tuningId: t.id })}
                className={`flex justify-between items-center px-4 py-3 rounded-2xl border-2 font-bold ${
                  t.id === settings.tuningId ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-300'
                }`}
              >
                <span>{t.label(names)}</span>
                <span className="text-sm font-normal opacity-80">{tuningNotes(t, names)}</span>
              </button>
            ))}
          </div>
        </Section>
        <Section title="Referenzton a′">
          <div className="flex items-center gap-3">
            <button
              onClick={() => update({ a4: Math.max(435, settings.a4 - 1) })}
              className="w-14 h-14 rounded-2xl bg-slate-950 border-2 border-slate-800 flex items-center justify-center active:scale-95"
              aria-label="tiefer"
            >
              <Minus className="w-6 h-6" />
            </button>
            <div className="flex-1 text-center font-black text-2xl tabular">{settings.a4} Hz</div>
            <button
              onClick={() => update({ a4: Math.min(445, settings.a4 + 1) })}
              className="w-14 h-14 rounded-2xl bg-slate-950 border-2 border-slate-800 flex items-center justify-center active:scale-95"
              aria-label="höher"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>
        </Section>
      </Collapsible>

      <Collapsible
        title="Training"
        icon={Timer}
        summary={`${settings.sessionMinutes} Min · bis Bund ${settings.fretMax} · Reihenfolge ${settings.groupMode === 'auto' ? 'automatisch' : 'manuell'}`}
      >
        <Section title="Session-Dauer (Tagesziel)">
          <Segmented
            options={[{ value: 3, label: '3 Min' }, { value: 5, label: '5 Min' }, { value: 10, label: '10 Min' }]}
            value={settings.sessionMinutes}
            onChange={(v) => update({ sessionMinutes: v })}
          />
        </Section>
        <Section title="Bundbereich">
          <Segmented
            options={[{ value: 12, label: 'bis Bund 12' }, { value: 24, label: 'bis Bund 24' }]}
            value={settings.fretMax}
            onChange={(v) => update({ fretMax: v })}
          />
        </Section>
        <Section
          title="Lernreihenfolge"
          hint={
            settings.groupMode === 'auto'
              ? 'Neue Saiten werden durch Können freigeschaltet (Standard).'
              : 'Nur die gewählten Bereiche werden abgefragt.'
          }
        >
          <Segmented
            options={[{ value: 'auto', label: 'Automatisch' }, { value: 'manual', label: 'Manuell' }]}
            value={settings.groupMode}
            onChange={(v) => update({ groupMode: v, manualGroups: v === 'manual' && !settings.manualGroups.length ? ['g1'] : settings.manualGroups })}
          />
          {settings.groupMode === 'manual' && (
            <div className="flex flex-col gap-2 mt-3">
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => toggleGroup(g.id)}
                  className={`px-4 py-3 rounded-2xl border-2 text-left font-bold text-sm ${
                    settings.manualGroups.includes(g.id) ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-300'
                  }`}
                >
                  {groupLabel(g, tuning.strings, names)}
                  {g.kind === 'natural' ? ': natürliche Töne' : ''}
                </button>
              ))}
            </div>
          )}
        </Section>
      </Collapsible>

      <Collapsible
        title="Tonnamen & Darstellung"
        icon={Type}
        summary={`${settings.naming === 'de' ? 'Deutsch (H, B)' : 'International (B, B♭)'} · ${accLabel} · ${settings.theme === 'dark' ? 'Dunkel' : 'Hell'}`}
      >
        <Section title="Tonnamen">
          <Segmented
            options={[{ value: 'de', label: 'Deutsch (H, B)' }, { value: 'int', label: 'International (B, B♭)' }]}
            value={settings.naming}
            onChange={(v) => update({ naming: v })}
          />
        </Section>
        <Section title="Vorzeichen">
          <Segmented
            options={[
              { value: 'sharp', label: sharpLabel },
              { value: 'flat', label: flatLabel },
              { value: 'both', label: `${sharpLabel}/${flatLabel}` },
            ]}
            value={settings.accidentals}
            onChange={(v) => update({ accidentals: v })}
          />
        </Section>
        <Section title="Darstellung">
          <Segmented
            options={[{ value: 'dark', label: 'Dunkel' }, { value: 'light', label: 'Hell' }]}
            value={settings.theme}
            onChange={(v) => update({ theme: v })}
          />
        </Section>
      </Collapsible>

      <Collapsible title="Mikrofon" icon={Mic} summary={`Eingangsschwelle ${settings.minDb} dB`}>
        <Section
          title={`Eingangsschwelle: ${settings.minDb} dB`}
          hint="Leiser als die Schwelle wird ignoriert. Höher stellen, wenn Raumgeräusche als Töne erkannt werden; tiefer, wenn leise Töne fehlen. Den Pegel siehst du live in der Diagnose."
        >
          <input
            type="range"
            min={-90}
            max={-30}
            step={1}
            value={settings.minDb}
            onChange={(e) => update({ minDb: Number(e.target.value) })}
            className="w-full accent-indigo-500"
          />
        </Section>
      </Collapsible>

      <Collapsible
        title="Motivation"
        icon={Trophy}
        summary={`Tagesziel ${settings.showGoals ? 'an' : 'aus'} · Bestwerte ${settings.showBests ? 'an' : 'aus'}`}
      >
        <Toggle label="Tagesziel und Übungskalender" value={settings.showGoals} onChange={(v) => update({ showGoals: v })} />
        <Toggle label="Bestwerte und Meilensteine" value={settings.showBests} onChange={(v) => update({ showBests: v })} />
      </Collapsible>

      <Collapsible
        title="Lernstand"
        icon={HardDrive}
        defaultOpen={!!(pendingImport || confirmReset)}
        summary={`${safe ? 'Sicher gespeichert' : storageText} · ${lastExport ? `Export ${lastExport}` : 'noch nicht exportiert'}`}
      >
        <div className={`flex items-start gap-2 rounded-2xl border-2 p-3 mb-3 ${safe ? 'border-emerald-500/60' : 'border-orange-500/60'}`}>
          {safe ? <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" /> : <ShieldAlert className="w-5 h-5 text-orange-400 flex-shrink-0" />}
          <div className="text-sm">
            <p className="font-bold">{storageText}</p>
            <p className="text-slate-400 text-xs mt-0.5">
              {safe
                ? 'iOS löscht den Lernstand dieser App nicht automatisch. Ein Export ab und zu schützt zusätzlich, z. B. bei Gerätewechsel.'
                : isIOS() && !standalone
                  ? 'Am sichersten: in Safari Teilen → „Zum Home-Bildschirm“ und die App von dort öffnen. Achtung, dort gibt es einen eigenen Speicher – vorher exportieren, dort importieren.'
                  : 'Der Browser kann Website-Daten bei Speichermangel oder langer Nichtnutzung löschen. Exportiere den Lernstand regelmäßig.'}
            </p>
          </div>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Der Lernstand liegt nur auf diesem Gerät. Safari kann Website-Daten nach längerer Nichtnutzung löschen – sichere ihn ab und zu als Datei (z. B. in iCloud Drive).
        </p>
        <div className="flex flex-col gap-2">
          <button onClick={doExport} className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-indigo-600 border-2 border-indigo-400 text-white font-bold active:scale-95 transition-transform">
            <Download className="w-5 h-5" /> Exportieren
          </button>
          <button onClick={() => fileRef.current?.click()} className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-slate-950 border-2 border-slate-800 font-bold active:scale-95 transition-transform">
            <Upload className="w-5 h-5" /> Importieren
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFile} />
          <button onClick={() => setConfirmReset(true)} className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-slate-950 border-2 border-slate-800 text-slate-400 font-bold active:scale-95 transition-transform">
            <RotateCcw className="w-5 h-5" /> Zurücksetzen
          </button>
        </div>

        {message && <p className={`text-sm font-bold mt-3 ${message.ok ? 'text-emerald-400' : 'text-orange-400'}`}>{message.text}</p>}

        {pendingImport && (
          <div className="rounded-2xl border-2 border-indigo-400 p-4 mt-3">
            <p className="font-bold mb-1">Lernstand ersetzen?</p>
            <p className="text-sm text-slate-400 mb-3">
              Die Datei vom {pendingImport.exportedAt ? new Date(pendingImport.exportedAt).toLocaleDateString('de-DE') : '–'} ersetzt den Lernstand und die Einstellungen auf diesem Gerät.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setData(pendingImport.data);
                  setPendingImport(null);
                  setMessage({ ok: true, text: 'Lernstand importiert.' });
                }}
                className="flex-1 py-3 rounded-2xl bg-indigo-600 border-2 border-indigo-400 text-white font-bold"
              >
                Ersetzen
              </button>
              <button onClick={() => setPendingImport(null)} className="flex-1 py-3 rounded-2xl bg-slate-800 border-2 border-slate-700 font-bold">
                Abbrechen
              </button>
            </div>
          </div>
        )}

        {confirmReset && (
          <div className="rounded-2xl border-2 border-orange-500 p-4 mt-3">
            <p className="font-bold mb-1">Lernstand wirklich löschen?</p>
            <p className="text-sm text-slate-400 mb-3">Alle Positionen, Übungstage, Bestwerte und Meilensteine werden auf diesem Gerät gelöscht. Einstellungen bleiben. Tipp: vorher exportieren.</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setData((d) => ({ ...d, progress: emptyProgress() }));
                  setConfirmReset(false);
                  setMessage({ ok: true, text: 'Lernstand zurückgesetzt.' });
                }}
                className="flex-1 py-3 rounded-2xl bg-orange-600 border-2 border-orange-400 text-white font-bold"
              >
                Löschen
              </button>
              <button onClick={() => setConfirmReset(false)} className="flex-1 py-3 rounded-2xl bg-slate-800 border-2 border-slate-700 font-bold">
                Abbrechen
              </button>
            </div>
          </div>
        )}
      </Collapsible>
    </div>
  );
}

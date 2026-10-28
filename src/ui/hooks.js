import { useState, useEffect, useRef, useMemo } from 'react';
import { getMicState, subscribeStatus, subscribeFrames } from '../audio/mic.js';
import { createNoteTracker } from '../audio/detector.js';

// ==========================================
// HOOKS
// ==========================================

export function useMicStatus() {
  const [s, setS] = useState(getMicState());
  useEffect(() => subscribeStatus(setS), []);
  return s;
}

export function useMicFrames(handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => subscribeFrames((f) => ref.current(f)), []);
}

/** Bildschirm wach halten, solange `active` (Fehler werden ignoriert). */
export function useWakeLock(active) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return undefined;
    let lock = null;
    let cancelled = false;
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
      } catch {
        /* nicht verfügbar oder abgelehnt */
      }
    };
    request();
    const onVis = () => {
      if (document.visibilityState === 'visible' && !cancelled) request();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      lock?.release().catch(() => {});
    };
  }, [active]);
}

/** Notenverfolgung; profile z. B. TRACKER_FAST für schnelles Spiel (Improvisieren). */
export function useTracker(settings, profile = null) {
  return useMemo(
    () => createNoteTracker({ ...(profile || {}), a4: settings.a4, minDb: settings.minDb }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings.a4, settings.minDb, profile],
  );
}

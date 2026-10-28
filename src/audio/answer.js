// Antwort-Sperre für Übungen mit „richtig/falsch“: Der richtige Ton zählt sofort,
// ein falscher erst, wenn er WRONG_HOLD_MS lang stabil klingt. So werden Slides,
// Rutschgeräusche und kurze Nebengeräusche (besonders bei Verzerrung) nicht als
// falsche Antwort gewertet – am Ende eines Slides zählt der Ton, auf dem man landet.
// Reine Logik → in Node testbar.

export const WRONG_HOLD_MS = 300;

export function createAnswerGate({ holdWrongMs = WRONG_HOLD_MS } = {}) {
  let pending = null; // { midi, since }

  return {
    reset() {
      pending = null;
    },
    /**
     * Pro Messung aufrufen. u = Ergebnis von tracker.update(frame).
     * isCorrect(midi) → boolean. Rückgabe: { midi, correct } wenn gewertet wird, sonst null.
     */
    update(u, time, isCorrect) {
      if (u.event) {
        const midi = u.event.midi;
        if (isCorrect(midi)) {
          pending = null;
          return { midi, correct: true };
        }
        pending = { midi, since: time };
        return null;
      }
      if (!pending) return null;
      // Die aktuelle Messung muss beim Kandidaten bleiben: Bei einem Slide gleitet die
      // Tonhöhe stufenlos weiter, während der Tracker den Startton noch als „stabil“ führt.
      if (u.valid && Math.abs(u.midiFloat - pending.midi) > 0.5) {
        pending = null;
        return null;
      }
      if (!u.stable || u.stable.midi !== pending.midi) {
        pending = null; // weitergerutscht oder verklungen
        return null;
      }
      if (time - pending.since >= holdWrongMs) {
        const midi = pending.midi;
        pending = null;
        return { midi, correct: false };
      }
      return null;
    },
  };
}

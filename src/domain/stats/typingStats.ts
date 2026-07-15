import type { RunEvent } from "@/domain/runs/runTypes";

function totals(events: RunEvent[]): { chars: number; corrections: number } | null {
  let chars = 0;
  let corrections = 0;
  let sawTyping = false;

  for (const event of events) {
    if (event.keystrokes !== undefined) {
      sawTyping = true;
      chars += event.keystrokes.chars;
      corrections += event.keystrokes.corrections;
    }
  }

  return sawTyping ? { chars, corrections } : null;
}

/**
 * The run's effective typing accuracy, charging corrections against the characters typed.
 *
 * Null when the run typed nothing at all: a navigation run has no keystroke accuracy, and null is
 * not 1 — the caller decides what a typing-free run's accuracy falls back to (the validator's,
 * per `useGameRun.buildFinished`), rather than this module silently picking "perfect" for it.
 */
export function keystrokeAccuracy(events: RunEvent[]): number | null {
  const typed = totals(events);

  if (typed === null || typed.chars === 0) {
    return typed === null ? null : 1;
  }

  return Math.max(0, (typed.chars - typed.corrections) / typed.chars);
}

/** Conventional five characters per word. Null when the run typed nothing, or elapsed time is not positive. */
export function typingWpm(events: RunEvent[], elapsedMs: number): number | null {
  const typed = totals(events);

  if (typed === null || elapsedMs <= 0) {
    return null;
  }

  return typed.chars / 5 / (elapsedMs / 60_000);
}

/** The run's total keystroke corrections — the honest "typed wrong, fixed it" count. Zero when the run typed nothing. */
export function typingCorrections(events: RunEvent[]): number {
  return totals(events)?.corrections ?? 0;
}

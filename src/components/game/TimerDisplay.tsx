"use client";

import { useEffect, useState } from "react";

import { formatElapsed } from "@/lib/format";

type TimerDisplayProps = {
  /** Epoch milliseconds, or null before the client starts the clock. */
  startedAt: number | null;
  /** Set once the run is over, which stops the clock on the final time. */
  frozenElapsedMs: number | null;
};

/**
 * The clock keeps its elapsed time in its own state and animates itself, so a ticking timer
 * re-renders this one span rather than the whole grid underneath it.
 */
export function TimerDisplay({ startedAt, frozenElapsedMs }: TimerDisplayProps) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (startedAt === null || frozenElapsedMs !== null) {
      return;
    }

    setElapsedMs(0);

    let frame = requestAnimationFrame(function tick() {
      setElapsedMs(Date.now() - startedAt);
      frame = requestAnimationFrame(tick);
    });

    return () => cancelAnimationFrame(frame);
  }, [startedAt, frozenElapsedMs]);

  const shown = frozenElapsedMs ?? elapsedMs;

  return (
    <span
      aria-label="Elapsed time"
      data-testid="timer"
      className="text-2xl font-semibold tabular-nums text-ink"
    >
      {formatElapsed(shown)}
    </span>
  );
}

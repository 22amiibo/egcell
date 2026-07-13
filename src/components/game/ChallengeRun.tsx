"use client";

import { useCallback, useRef } from "react";

import { ChallengePrompt } from "@/components/game/ChallengePrompt";
import { ResultCard } from "@/components/game/ResultCard";
import { TimerDisplay } from "@/components/game/TimerDisplay";
import { Toolbar } from "@/components/game/Toolbar";
import { SpreadsheetGrid } from "@/components/grid/SpreadsheetGrid";
import type { Challenge, ChallengeMode } from "@/domain/challenges/challengeTypes";
import { useGameRun, type FinishedRun } from "@/hooks/useGameRun";
import type { LocalPersonalRecords } from "@/hooks/useLocalPersonalRecords";

type ChallengeRunProps = {
  challenge: Challenge;
  mode: ChallengeMode;
  records: LocalPersonalRecords;
  onNext: () => void;
  /** Fired once per completed run, so the shell can log it to the local history. */
  onFinished?: (finished: FinishedRun) => void;
};

/**
 * One run of one challenge. `GameShell` keys this by challenge id, so switching challenges mounts a
 * fresh run rather than carrying the old clock and grid across.
 */
export function ChallengeRun({ challenge, mode, records, onNext, onFinished }: ChallengeRunProps) {
  const run = useGameRun(challenge, mode, records, { onFinished });
  const gridRef = useRef<HTMLDivElement | null>(null);

  // Retry puts focus straight back on the grid, so a keyboard player never has to reach for the
  // mouse between attempts.
  const retry = useCallback(() => {
    run.retry();
    gridRef.current?.focus({ preventScroll: true });
  }, [run]);

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex w-full items-end justify-between gap-8">
        <ChallengePrompt challenge={challenge} />
        <TimerDisplay startedAt={run.startedAt} frozenElapsedMs={run.result?.elapsedMs ?? null} />
      </div>

      <div className="flex w-full justify-start">
        <Toolbar challenge={challenge} grid={run.grid} onAction={run.dispatch} />
      </div>

      <div className="relative">
        <SpreadsheetGrid
          grid={run.grid}
          onAction={run.dispatch}
          allowedActions={challenge.allowedActions}
          focusRef={gridRef}
        />

        {run.result !== null && (
          <div className="absolute inset-0 flex items-center justify-center bg-canvas/70 backdrop-blur-[2px]">
            <ResultCard
              challenge={challenge}
              mode={mode}
              run={run.result}
              onRetry={retry}
              onNext={onNext}
            />
          </div>
        )}
      </div>
    </div>
  );
}

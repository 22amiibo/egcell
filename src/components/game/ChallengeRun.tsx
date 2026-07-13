"use client";

import { ChallengePrompt } from "@/components/game/ChallengePrompt";
import { ResultCard } from "@/components/game/ResultCard";
import { TimerDisplay } from "@/components/game/TimerDisplay";
import { Toolbar } from "@/components/game/Toolbar";
import { SpreadsheetGrid } from "@/components/grid/SpreadsheetGrid";
import type { Challenge, ChallengeMode } from "@/domain/challenges/challengeTypes";
import { useGameRun } from "@/hooks/useGameRun";
import type { LocalPersonalRecords } from "@/hooks/useLocalPersonalRecords";

type ChallengeRunProps = {
  challenge: Challenge;
  mode: ChallengeMode;
  records: LocalPersonalRecords;
  onNext: () => void;
};

/**
 * One run of one challenge. `GameShell` keys this by challenge id, so switching challenges mounts a
 * fresh run rather than carrying the old clock and grid across.
 */
export function ChallengeRun({ challenge, mode, records, onNext }: ChallengeRunProps) {
  const run = useGameRun(challenge, mode, records);

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
        <SpreadsheetGrid grid={run.grid} onAction={run.dispatch} />

        {run.result !== null && (
          <div className="absolute inset-0 flex items-center justify-center bg-canvas/70 backdrop-blur-[2px]">
            <ResultCard challenge={challenge} run={run.result} onRetry={run.retry} onNext={onNext} />
          </div>
        )}
      </div>
    </div>
  );
}

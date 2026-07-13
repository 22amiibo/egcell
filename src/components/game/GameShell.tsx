"use client";

import { ChallengePrompt } from "@/components/game/ChallengePrompt";
import { ResultCard } from "@/components/game/ResultCard";
import { TimerDisplay } from "@/components/game/TimerDisplay";
import { SpreadsheetGrid } from "@/components/grid/SpreadsheetGrid";
import { defaultChallenge } from "@/data/challenges";
import type { ChallengeMode } from "@/domain/challenges/challengeTypes";
import { recordKey } from "@/domain/records/personalRecords";
import { useGameRun } from "@/hooks/useGameRun";
import { useLocalPersonalRecords } from "@/hooks/useLocalPersonalRecords";
import { formatElapsed } from "@/lib/format";

const MODE: ChallengeMode = "main-speed";

export function GameShell() {
  const challenge = defaultChallenge;
  const records = useLocalPersonalRecords();
  const run = useGameRun(challenge, MODE, records);

  const best = records.records[recordKey(challenge.id, MODE)];

  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-line px-6 py-3">
        <span className="text-[13px] font-semibold tracking-tight text-ink">
          Excel Speed Trainer
        </span>

        <div className="flex items-center gap-5 text-[12px] text-muted">
          <span>main speed</span>
          <span data-testid="best-time">
            {best === undefined ? "no record yet" : `best ${formatElapsed(best.bestElapsedMs)}`}
          </span>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center gap-6 px-6 py-10">
        <div className="flex w-full max-w-4xl items-end justify-between gap-8">
          <ChallengePrompt challenge={challenge} />
          <TimerDisplay startedAt={run.startedAt} frozenElapsedMs={run.result?.elapsedMs ?? null} />
        </div>

        <div className="relative">
          <SpreadsheetGrid grid={run.grid} onAction={run.dispatch} />

          {run.result !== null && (
            <div className="absolute inset-0 flex items-center justify-center bg-canvas/70 backdrop-blur-[2px]">
              <ResultCard challenge={challenge} run={run.result} onRetry={run.retry} />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

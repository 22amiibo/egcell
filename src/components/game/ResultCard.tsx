"use client";

import { RetryButton } from "@/components/game/RetryButton";
import { StatRow } from "@/components/game/StatRow";
import type { Challenge } from "@/domain/challenges/challengeTypes";
import type { FinishedRun } from "@/hooks/useGameRun";
import { formatElapsed, formatPercent, formatScore } from "@/lib/format";

type ResultCardProps = {
  challenge: Challenge;
  run: FinishedRun;
  onRetry: () => void;
};

function PersonalBest({ run }: { run: FinishedRun }) {
  if (run.isNewRecord) {
    const previous = run.previousBest;

    return (
      <p className="text-[13px] font-semibold text-accent-strong" data-testid="pr-line">
        {previous === undefined
          ? "First personal record."
          : `New personal record. Beat ${formatElapsed(previous.bestElapsedMs)} by ${formatElapsed(
              previous.bestElapsedMs - run.elapsedMs,
            )}.`}
      </p>
    );
  }

  if (run.previousBest === undefined) {
    return null;
  }

  return (
    <p className="text-[13px] text-muted" data-testid="pr-line">
      {`Personal best stands at ${formatElapsed(run.previousBest.bestElapsedMs)} for ${formatScore(
        run.previousBest.bestScore,
      )} points.`}
    </p>
  );
}

export function ResultCard({ challenge, run, onRetry }: ResultCardProps) {
  return (
    <div
      role="dialog"
      aria-label="Run result"
      data-testid="result-card"
      className="w-80 rounded-lg border border-line bg-surface p-5 shadow-2xl shadow-black/40"
    >
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-medium tracking-widest text-muted uppercase">
          Complete
        </span>
        <span className="text-[11px] tabular-nums text-muted">
          target {challenge.scoring.targetSeconds}s
        </span>
      </div>

      <p className="mt-3 text-4xl font-semibold tabular-nums text-ink" data-testid="final-time">
        {formatElapsed(run.elapsedMs)}
      </p>

      <p className="mt-1 text-lg font-medium tabular-nums text-accent-strong" data-testid="score">
        {formatScore(run.score.score)} points
      </p>

      <div className="mt-4">
        <PersonalBest run={run} />
      </div>

      <div className="mt-4 flex flex-col gap-1 border-t border-line pt-4">
        <StatRow label="Correctness" value={formatPercent(run.validation.correctness)} />
      </div>

      <details className="mt-3 border-t border-line pt-3">
        <summary className="cursor-pointer text-[12px] text-muted hover:text-ink">Details</summary>

        <div className="mt-3 flex flex-col gap-1">
          <StatRow label="Completion" value={formatPercent(run.validation.completionPercent)} />
          <StatRow label="Accuracy" value={formatPercent(run.validation.accuracy)} />
          <StatRow label="Speed multiplier" value={`${run.score.speedMultiplier.toFixed(2)}x`} />
          <StatRow label="Base points" value={formatScore(challenge.scoring.basePoints)} />
          <StatRow label="Challenge" value={`${challenge.id} ${challenge.version}`} />
          <StatRow label="Seed" value={challenge.seed} />
        </div>
      </details>

      <div className="mt-5">
        <RetryButton onRetry={onRetry} />
      </div>
    </div>
  );
}

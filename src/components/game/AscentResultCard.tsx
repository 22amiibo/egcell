"use client";

import { NewPrBadge } from "@/components/game/NewPrBadge";
import { RetryButton } from "@/components/game/RetryButton";
import { StatRow } from "@/components/game/StatRow";
import type { AscentResult } from "@/domain/ascent/ascentResult";
import type { AscentRecord } from "@/domain/records/ascentRecords";
import { formatPercent, formatScore } from "@/lib/format";

type AscentResultCardProps = {
  result: AscentResult;
  /** The book's entry before this run banked. Undefined on this duration's first-ever climb. */
  previousBest: AscentRecord | undefined;
  isNewRecord: boolean;
  /** This climb's own longest combo streak — independent of anything the record book tracks. */
  bestStreak: number;
  onRetry: () => void;
};

/**
 * Mirrors `PersonalBest` (`ResultCard.tsx`) and `SessionBest` (`SessionResultCard.tsx`): silent
 * beyond the badge on a duration's first-ever climb, and otherwise always names the book's own
 * number, so a run that did not win still says what it would have taken to win.
 */
function AscentBest({
  previousBest,
  isNewRecord,
}: {
  previousBest: AscentRecord | undefined;
  isNewRecord: boolean;
}) {
  if (isNewRecord) {
    return (
      <p className="text-[13px] font-semibold text-accent-strong" data-testid="ascent-pr-line">
        {previousBest === undefined
          ? "First personal record for Ascent."
          : `New personal record. Beat ${formatScore(previousBest.bestScore)} points.`}
      </p>
    );
  }

  if (previousBest === undefined) {
    return null;
  }

  return (
    <p className="text-[13px] text-muted" data-testid="ascent-pr-line">
      {`Personal best stands at T${previousBest.bestPeakTier} · ${formatScore(
        previousBest.bestScore,
      )} points.`}
    </p>
  );
}

/**
 * The climb's buzzer summary. The headline is the ladder's own payoff — peak tier and tasks, not
 * a time — with the score right under it, this run's own combo peak, typing stats when the run
 * typed anything at all, and the book's best. Replaces the inline `ended` summary that used to
 * live in `AscentRun`, with the same test ids (`ascent-result-card`, `ascent-peak-tier`,
 * `ascent-score`, `ascent-tasks`) and the same "Peak tier" text, so `e2e/ascent.spec.ts` reads it
 * exactly as before.
 */
export function AscentResultCard({
  result,
  previousBest,
  isNewRecord,
  bestStreak,
  onRetry,
}: AscentResultCardProps) {
  const typed = result.wpm !== null;

  return (
    <div
      role="dialog"
      aria-label="Ascent result"
      data-testid="ascent-result-card"
      className="w-96 rounded-lg border border-line bg-surface p-5 shadow-2xl shadow-black/40"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium tracking-widest text-muted uppercase">
          Time&apos;s up
        </span>
        {isNewRecord && <NewPrBadge />}
      </div>

      <div className="mt-3 flex flex-col gap-1">
        <p className="text-[13px] text-muted">
          Peak tier
          <span
            className="ml-2 text-xl font-semibold tabular-nums text-ink"
            data-testid="ascent-peak-tier"
          >
            {result.peakTier}
          </span>
          <span className="mx-1.5">·</span>
          <span data-testid="ascent-tasks">
            {result.tasksCompleted} task{result.tasksCompleted === 1 ? "" : "s"} completed
          </span>
        </p>
        <p
          className="text-lg font-medium tabular-nums text-accent-strong"
          data-testid="ascent-score"
        >
          {formatScore(result.totalScore)} points
        </p>
      </div>

      <div className="mt-4">
        <AscentBest previousBest={previousBest} isNewRecord={isNewRecord} />
      </div>

      <div className="mt-4 flex flex-col gap-1 border-t border-line pt-4">
        <StatRow label="Best streak" value={bestStreak} />
        {typed && (
          <>
            <StatRow label="WPM" value={Math.round(result.wpm ?? 0)} />
            <StatRow label="Accuracy" value={formatPercent(result.keystrokeAccuracy ?? 1)} />
          </>
        )}
      </div>

      <div className="mt-5 flex items-center gap-2">
        <RetryButton onRetry={onRetry} />
      </div>
    </div>
  );
}

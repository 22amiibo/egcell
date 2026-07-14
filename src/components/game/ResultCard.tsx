"use client";

import { FastestPathCard } from "@/components/game/FastestPathCard";
import { NewPrBadge } from "@/components/game/NewPrBadge";
import { PracticeNotes } from "@/components/game/PracticeNotes";
import { RetryButton } from "@/components/game/RetryButton";
import { StatRow } from "@/components/game/StatRow";
import type { Challenge, ChallengeMode } from "@/domain/challenges/challengeTypes";
import { calculateLiveRunStats } from "@/domain/stats/liveRunStats";
import { useFastestPath } from "@/hooks/useFastestPath";
import type { FinishedRun } from "@/hooks/useGameRun";
import { formatElapsed, formatPercent, formatScore } from "@/lib/format";

type ResultCardProps = {
  challenge: Challenge;
  mode: ChallengeMode;
  run: FinishedRun;
  onRetry: () => void;
  onNext: () => void;
};

function PersonalBest({ run }: { run: FinishedRun }) {
  if (run.isNewRecord) {
    const previous = run.previousBest;
    // A record falls to the higher score first, faster time second. A higher-scoring but slower
    // run is still a record, and must not be described as beating a time it did not beat.
    const timeDelta = previous === undefined ? 0 : previous.bestElapsedMs - run.elapsedMs;

    return (
      <p className="text-[13px] font-semibold text-accent-strong" data-testid="pr-line">
        {previous === undefined
          ? "First personal record."
          : timeDelta > 0
            ? `New personal record. Beat ${formatElapsed(previous.bestElapsedMs)} by ${formatElapsed(
                timeDelta,
              )}.`
            : `New personal record. ${formatScore(run.score.score)} points beats the old ${formatScore(
                previous.bestScore,
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

export function ResultCard({ challenge, mode, run, onRetry, onNext }: ResultCardProps) {
  const actions = run.submission.replayEvents.length;
  const shortcutActions = run.submission.replayEvents.filter(
    (event) => event.inputMethod === "keyboard",
  ).length;
  const stats = calculateLiveRunStats({
    elapsedMs: run.elapsedMs,
    actions,
    shortcutActions,
    mistakes: Math.round(actions * (1 - run.validation.accuracy)),
    completedTasks: run.validation.completionPercent,
    totalTasks: 1,
    pbMs: run.previousBest?.bestElapsedMs ?? null,
    // This card does not display combo — the feedback lane above the grid already owns that
    // cue during the run — so there is no real streak to plumb through here.
    combo: 0,
  });
  const pbDelta =
    stats.pbDeltaMs === null
      ? "First result"
      : stats.pbDeltaMs === 0
        ? "Matched"
        : stats.pbDeltaMs < 0
          ? `${formatElapsed(Math.abs(stats.pbDeltaMs))} faster`
          : `${formatElapsed(stats.pbDeltaMs)} behind`;
  // The run is over, which is exactly where the plan allows the solve to cost something (§6.3): the
  // result card mounting is the trigger, and `routeCache` means a drill seen twice is solved once.
  // Nothing here runs while the player is still pressing keys.
  const path = useFastestPath(challenge, run.submission.replayEvents, true);

  return (
    <div
      role="dialog"
      aria-label="Run result"
      data-testid="result-card"
      className="w-80 rounded-lg border border-line bg-surface p-5 shadow-2xl shadow-black/40"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium tracking-widest text-muted uppercase">
          Complete
        </span>
        <span className="flex items-center gap-2">
          {run.isNewRecord && <NewPrBadge />}
          <span className="text-[11px] tabular-nums text-muted">
            target {challenge.scoring.targetSeconds}s
          </span>
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <p className="text-4xl font-semibold tabular-nums text-ink" data-testid="final-time">
            {formatElapsed(run.elapsedMs)}
          </p>
          <p
            className="mt-1 text-lg font-medium tabular-nums text-accent-strong"
            data-testid="score"
          >
            {formatScore(run.score.score)} points
          </p>
        </div>
        <div className="pb-1 text-right">
          <p className="text-[10px] font-medium tracking-widest text-muted uppercase">EPM</p>
          <p className="text-xl font-semibold tabular-nums text-ink">{stats.epm}</p>
        </div>
      </div>

      <div className="mt-4">
        <PersonalBest run={run} />
      </div>

      {/* The whole two-second read: result, record pace, and how efficiently it was earned. */}
      <div className="mt-4 flex flex-col gap-1 border-t border-line pt-4">
        <StatRow label="PB delta" value={pbDelta} />
        <StatRow label="Correctness" value={formatPercent(run.validation.correctness)} />
        <StatRow label="Accuracy" value={formatPercent(run.validation.accuracy)} />
        <StatRow label="Shortcut efficiency" value={`${stats.shortcutEfficiency}%`} />
      </div>

      {path !== null && <FastestPathCard path={path} />}

      {mode === "practice" && <PracticeNotes notes={challenge.practiceNotes} />}

      <details className="mt-3 border-t border-line pt-3">
        <summary className="cursor-pointer text-[12px] text-muted hover:text-ink">Details</summary>

        <div className="mt-3 flex flex-col gap-1">
          <StatRow label="Completion" value={formatPercent(run.validation.completionPercent)} />
          <StatRow label="Speed multiplier" value={`${run.score.speedMultiplier.toFixed(2)}x`} />
          <StatRow label="Base points" value={formatScore(challenge.scoring.basePoints)} />
          <StatRow label="Challenge" value={`${challenge.id} ${challenge.version}`} />
          <StatRow label="Seed" value={challenge.seed} />
          <StatRow label="Moves" value={run.submission.replayEvents.length} />
          <StatRow label="Run digest" value={run.submission.eventDigest} />
        </div>
      </details>

      {/* Retry is the primary action. Chasing the time again is the whole point of the game. */}
      <div className="mt-5 flex items-center gap-2">
        <RetryButton onRetry={onRetry} />
        <button
          type="button"
          onClick={onNext}
          className="rounded-md border border-line px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-raised hover:text-ink"
        >
          Next challenge
        </button>
      </div>
    </div>
  );
}

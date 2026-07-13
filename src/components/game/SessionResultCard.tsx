"use client";

import { NewPrBadge } from "@/components/game/NewPrBadge";
import { RetryButton } from "@/components/game/RetryButton";
import { StatRow } from "@/components/game/StatRow";
import type { SessionRecord } from "@/domain/sessions/sessionRecords";
import {
  SESSION_PLANS,
  sessionModeLabel,
  type SessionResult,
  type SessionTaskResult,
} from "@/domain/sessions/sessionTypes";
import { formatElapsed, formatPercent, formatScore } from "@/lib/format";

type SessionResultCardProps = {
  result: SessionResult;
  previousBest: SessionRecord | undefined;
  isNewRecord: boolean;
  onRetry: () => void;
};

function outcomeLabel(task: SessionTaskResult): string {
  switch (task.outcome) {
    case "completed":
      return formatElapsed(task.elapsedMs);
    case "skipped":
      return "skipped";
    case "expired":
      return "time ran out";
  }
}

function SessionBest({
  result,
  previousBest,
  isNewRecord,
}: {
  result: SessionResult;
  previousBest: SessionRecord | undefined;
  isNewRecord: boolean;
}) {
  if (isNewRecord) {
    // A session record can fall on the score, or on the tiebreaks behind an equal score. A zero
    // or negative "beat by" would read as a lie, so the tiebreak case says what actually happened.
    const scoreDelta =
      previousBest === undefined ? 0 : result.totalScore - previousBest.bestScore;

    return (
      <p className="text-[13px] font-semibold text-accent-strong" data-testid="session-pr-line">
        {previousBest === undefined
          ? "First personal record for this mode."
          : scoreDelta > 0
            ? `New personal record. Beat ${formatScore(previousBest.bestScore)} points by ${formatScore(
                scoreDelta,
              )}.`
            : "New personal record. Matched the score and won on the tiebreak."}
      </p>
    );
  }

  if (previousBest === undefined) {
    return null;
  }

  return (
    <p className="text-[13px] text-muted" data-testid="session-pr-line">
      {`Personal best stands at ${formatScore(previousBest.bestScore)} points in ${formatElapsed(
        previousBest.bestElapsedMs,
      )}.`}
    </p>
  );
}

export function SessionResultCard({
  result,
  previousBest,
  isNewRecord,
  onRetry,
}: SessionResultCardProps) {
  const plan = SESSION_PLANS[result.mode];
  const heading = plan.kind === "task-count" ? "Sprint complete" : "Time's up";

  return (
    <div
      role="dialog"
      aria-label="Session result"
      data-testid="session-result-card"
      className="w-96 rounded-lg border border-line bg-surface p-5 shadow-2xl shadow-black/40"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium tracking-widest text-muted uppercase">
          {heading}
        </span>
        <span className="flex items-center gap-2">
          {isNewRecord && <NewPrBadge />}
          <span className="text-[11px] text-muted">{sessionModeLabel(result.mode)}</span>
        </span>
      </div>

      <p className="mt-3 text-4xl font-semibold tabular-nums text-ink" data-testid="session-final-time">
        {plan.kind === "task-count"
          ? formatElapsed(result.totalElapsedMs)
          : `${result.tasksCompleted} ${result.tasksCompleted === 1 ? "task" : "tasks"}`}
      </p>

      <p
        className="mt-1 text-lg font-medium tabular-nums text-accent-strong"
        data-testid="session-score"
      >
        {formatScore(result.totalScore)} points
      </p>

      <div className="mt-4">
        <SessionBest result={result} previousBest={previousBest} isNewRecord={isNewRecord} />
      </div>

      <div className="mt-4 flex flex-col gap-1 border-t border-line pt-4">
        <StatRow
          label="Tasks completed"
          value={
            <span data-testid="session-tasks">{`${result.tasksCompleted} of ${result.taskCount}`}</span>
          }
        />
        <StatRow label="Completion" value={formatPercent(result.completionPercent)} />
        <StatRow label="Accuracy" value={formatPercent(result.accuracy)} />
        {plan.kind === "fixed-time" && (
          <StatRow label="Total time" value={formatElapsed(result.totalElapsedMs)} />
        )}
      </div>

      <details className="mt-3 border-t border-line pt-3">
        <summary className="cursor-pointer text-[12px] text-muted hover:text-ink">
          Task breakdown
        </summary>

        <ol className="mt-3 flex flex-col gap-1.5">
          {result.tasks.map((task, index) => (
            <li
              key={`${task.challengeId}:${index}`}
              className="flex items-baseline justify-between gap-4 text-[13px]"
            >
              <span className={task.outcome === "completed" ? "text-ink" : "text-muted"}>
                {index + 1}. {task.title}
              </span>
              <span className="shrink-0 tabular-nums text-muted">
                {outcomeLabel(task)} · {formatScore(task.score)} pts
              </span>
            </li>
          ))}
        </ol>
      </details>

      {/* Retry is the primary action here just as it is on a single run: chase the total. */}
      <div className="mt-5 flex items-center gap-2">
        <RetryButton onRetry={onRetry} />
      </div>
    </div>
  );
}

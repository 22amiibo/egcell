"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";

import { SessionResultCard } from "@/components/game/SessionResultCard";
import { TimerDisplay } from "@/components/game/TimerDisplay";
import { Toolbar } from "@/components/game/Toolbar";
import { SpreadsheetGrid } from "@/components/grid/SpreadsheetGrid";
import { challenges } from "@/data/challenges";
import type { Challenge } from "@/domain/challenges/challengeTypes";
import { sessionRecordFromResult } from "@/domain/sessions/sessionRecords";
import { buildSessionResult, taskChallengeAt } from "@/domain/sessions/sessionResult";
import {
  SESSION_PLANS,
  sessionModeLabel,
  type SessionMode,
  type SessionResult,
  type SessionTaskResult,
  type TaskOutcome,
} from "@/domain/sessions/sessionTypes";
import { createRunClock } from "@/hooks/runClock";
import { useGameRun, type FinishedRun } from "@/hooks/useGameRun";
import type { LocalPersonalRecords } from "@/hooks/useLocalPersonalRecords";
import type { LocalSessionRecords, SessionRecordSubmission } from "@/hooks/useLocalSessionRecords";

type SessionRunProps = {
  sessionMode: SessionMode;
  personalRecords: LocalPersonalRecords;
  sessionRecords: LocalSessionRecords;
};

function toTaskResult(
  challenge: Challenge,
  finished: FinishedRun,
  outcome: TaskOutcome,
): SessionTaskResult {
  return {
    challengeId: challenge.id,
    challengeVersion: challenge.version,
    title: challenge.title,
    outcome,
    elapsedMs: finished.elapsedMs,
    score: finished.score.score,
    correctness: finished.validation.correctness,
    completionPercent: finished.validation.completionPercent,
    accuracy: finished.validation.accuracy,
  };
}

type SessionTaskProps = {
  challenge: Challenge;
  records: LocalPersonalRecords;
  onFinished: (finished: FinishedRun, outcome: TaskOutcome) => void;
  /** True once the session is over: the grid freezes and the skip control goes away. */
  frozen: boolean;
};

/**
 * One task inside a session. It is the single-challenge run machinery with two differences: no
 * per-task result card, because the session advances instead, and no per-challenge personal
 * record, because the session banks one record for the whole run.
 */
function SessionTask({ challenge, records, onFinished, frozen }: SessionTaskProps) {
  const handleFinished = useCallback(
    (finished: FinishedRun) => onFinished(finished, "completed"),
    [onFinished],
  );

  const run = useGameRun(challenge, "main-speed", records, {
    recordPersonalBest: false,
    onFinished: handleFinished,
  });

  // Skipping still grades the grid, so a half-formatted range pays its partial credit rather
  // than vanishing. A skip that turns out to be complete counts as completed.
  const skip = useCallback(() => {
    const finished = run.finishNow();

    onFinished(finished, finished.validation.isComplete ? "completed" : "skipped");
  }, [run, onFinished]);

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div className="flex w-full items-center justify-between gap-4">
        <Toolbar challenge={challenge} grid={run.grid} onAction={run.dispatch} />
        <span aria-hidden className="flex-1" />
        {!frozen && (
          <button
            type="button"
            onClick={skip}
            className="rounded border border-line px-2.5 py-1 text-[12px] font-medium text-muted transition-colors hover:bg-surface-raised hover:text-ink"
          >
            Skip task
          </button>
        )}
      </div>

      <SpreadsheetGrid
        grid={run.grid}
        onAction={run.dispatch}
        allowedActions={challenge.allowedActions}
      />
    </div>
  );
}

export function SessionRun({ sessionMode, personalRecords, sessionRecords }: SessionRunProps) {
  const plan = SESSION_PLANS[sessionMode];

  const [clock] = useState(createRunClock);
  const sessionStartedAt = useSyncExternalStore(
    clock.subscribe,
    clock.getSnapshot,
    clock.getServerSnapshot,
  );

  const [taskIndex, setTaskIndex] = useState(0);
  const [, setTasks] = useState<SessionTaskResult[]>([]);
  const [outcome, setOutcome] = useState<{
    result: SessionResult;
    submission: SessionRecordSubmission;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);

  const tasksRef = useRef<SessionTaskResult[]>([]);

  const challenge = taskChallengeAt(challenges, taskIndex);

  const finishSession = useCallback(
    (allTasks: SessionTaskResult[]) => {
      const now = Date.now();
      const result = buildSessionResult({
        mode: sessionMode,
        tasks: allTasks,
        totalElapsedMs: now - clock.startedAt(),
        finishedAtMs: now,
      });
      const submission = sessionRecords.submit(sessionRecordFromResult(result));

      setOutcome({ result, submission });
    },
    [sessionMode, clock, sessionRecords],
  );

  const handleTaskFinished = useCallback(
    (finished: FinishedRun, taskOutcome: TaskOutcome) => {
      const next = [...tasksRef.current, toTaskResult(challenge, finished, taskOutcome)];

      tasksRef.current = next;
      setTasks(next);

      if (plan.kind === "task-count" && next.length >= plan.taskCount) {
        finishSession(next);
      } else {
        setTaskIndex(next.length);
      }
    },
    [challenge, plan, finishSession],
  );

  const retry = useCallback(() => {
    tasksRef.current = [];

    setTasks([]);
    setTaskIndex(0);
    setOutcome(null);
    setAttempt((current) => current + 1);
    clock.restart();
  }, [clock]);

  const taskNumber =
    plan.kind === "task-count" ? Math.min(taskIndex + 1, plan.taskCount) : taskIndex + 1;

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex w-full items-end justify-between gap-8">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium tracking-widest text-muted uppercase">
            {sessionModeLabel(sessionMode)}
            {plan.kind === "task-count" && ` · task ${taskNumber} of ${plan.taskCount}`}
          </span>
          <h1 className="text-xl font-semibold tracking-tight text-ink">{challenge.prompt}</h1>
        </div>
        <TimerDisplay
          startedAt={sessionStartedAt}
          frozenElapsedMs={outcome?.result.totalElapsedMs ?? null}
        />
      </div>

      <div className="relative flex w-full flex-col items-center">
        {/*
          Keyed by attempt and task, so each task mounts a fresh run and retry starts the whole
          session over from a clean grid.
        */}
        <SessionTask
          key={`${attempt}:${taskIndex}`}
          challenge={challenge}
          records={personalRecords}
          onFinished={handleTaskFinished}
          frozen={outcome !== null}
        />

        {outcome !== null && (
          <div className="absolute inset-0 flex items-center justify-center bg-canvas/70 backdrop-blur-[2px]">
            <SessionResultCard
              result={outcome.result}
              previousBest={outcome.submission.previousBest}
              isNewRecord={outcome.submission.isNewRecord}
              onRetry={retry}
            />
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { LiveStatsBar } from "@/components/game/LiveStatsBar";
import {
  feedbackEventForRun,
  RunFeedbackLayer,
  shortcutLabelForEvent,
} from "@/components/game/RunFeedbackLayer";
import { SessionResultCard } from "@/components/game/SessionResultCard";
import { TaskProgressRail } from "@/components/game/TaskProgressRail";
import { TimerDisplay } from "@/components/game/TimerDisplay";
import { Toolbar } from "@/components/game/Toolbar";
import { SpreadsheetGrid } from "@/components/grid/SpreadsheetGrid";
import { SESSION_DIFFICULTY, buildSessionQueue } from "@/data/challenges/queue";
import type { Challenge } from "@/domain/challenges/challengeTypes";
import { sessionRecordFromResult } from "@/domain/sessions/sessionRecords";
import { buildSessionResult } from "@/domain/sessions/sessionResult";
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
import type { NewRunEntry } from "@/hooks/useLocalRunHistory";
import type { LocalSessionRecords, SessionRecordSubmission } from "@/hooks/useLocalSessionRecords";
import { useSettings } from "@/hooks/useSettings";
import {
  getSoundCue,
  playSoundCue,
  soundEventForFeedback,
  type SoundPreferences,
} from "@/lib/sound/runSounds";

type SessionRunProps = {
  sessionMode: SessionMode;
  personalRecords: LocalPersonalRecords;
  sessionRecords: LocalSessionRecords;
  /** Lets the shell log the finished session to the local run history. */
  recordHistory?: (entry: NewRunEntry) => void;
  /**
   * Pins the queue seed, for tests and shared runs. With an override, retry re-races the exact
   * same queue; without one, every attempt draws a fresh queue, like a fresh Monkeytype test.
   */
  seedOverride?: string | null;
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
  /** Epoch milliseconds when the session clock runs out, or null for sprints. */
  deadlineAtMs: number | null;
  /** True once the session is over: the grid freezes and the skip control goes away. */
  frozen: boolean;
  sessionStartedAt: number | null;
  frozenSessionElapsedMs: number | null;
  previousActions: number;
  previousShortcutActions: number;
  previousMistakes: number;
  completedTasks: number;
  totalTasks: number;
  liveStatsEnabled: boolean;
  reducedMotion: boolean;
  showCombo: boolean;
  showShortcut: boolean;
  soundPreferences: SoundPreferences;
};

/**
 * One task inside a session. It is the single-challenge run machinery with two differences: no
 * per-task result card, because the session advances instead, and no per-challenge personal
 * record, because the session banks one record for the whole run.
 */
function SessionTask({
  challenge,
  records,
  onFinished,
  deadlineAtMs,
  frozen,
  sessionStartedAt,
  frozenSessionElapsedMs,
  previousActions,
  previousShortcutActions,
  previousMistakes,
  completedTasks,
  totalTasks,
  liveStatsEnabled,
  reducedMotion,
  showCombo,
  showShortcut,
  soundPreferences,
}: SessionTaskProps) {
  // A task reports its result exactly once, whichever of completion, skip, or the session
  // deadline gets there first.
  const reportedRef = useRef(false);

  const report = useCallback(
    (finished: FinishedRun, outcome: TaskOutcome) => {
      if (reportedRef.current) {
        return;
      }

      reportedRef.current = true;
      onFinished(finished, outcome);
    },
    [onFinished],
  );

  const handleFinished = useCallback(
    (finished: FinishedRun) => report(finished, "completed"),
    [report],
  );

  const run = useGameRun(challenge, "main-speed", records, {
    recordPersonalBest: false,
    onFinished: handleFinished,
  });

  const { finishNow } = run;

  // Skipping still grades the grid, so a half-formatted range pays its partial credit rather
  // than vanishing. A skip that turns out to be complete counts as completed.
  const skip = useCallback(() => {
    const finished = finishNow();

    report(finished, finished.validation.isComplete ? "completed" : "skipped");
  }, [finishNow, report]);

  // The session deadline lands mid-task. Whatever is on the grid at that moment is graded as is.
  useEffect(() => {
    if (deadlineAtMs === null || frozen) {
      return;
    }

    const timer = setTimeout(
      () => {
        const finished = finishNow();

        report(finished, finished.validation.isComplete ? "completed" : "expired");
      },
      Math.max(deadlineAtMs - Date.now(), 0),
    );

    return () => clearTimeout(timer);
  }, [deadlineAtMs, frozen, finishNow, report]);

  const taskActions = run.events.length;
  const taskShortcutActions = run.events.filter(
    (event) => event.inputMethod === "keyboard",
  ).length;
  const taskMistakes = Math.round(taskActions * (1 - run.validation.accuracy));
  const feedbackEvent = feedbackEventForRun(run.events, run.validation, run.result !== null);

  useEffect(() => {
    const soundEvent = soundEventForFeedback(feedbackEvent);

    playSoundCue(soundEvent === null ? null : getSoundCue(soundEvent, soundPreferences));
  }, [feedbackEvent, run.events.length, soundPreferences]);

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div className="flex w-full justify-start">
        <LiveStatsBar
          startedAt={sessionStartedAt}
          frozenElapsedMs={frozenSessionElapsedMs}
          actions={previousActions + taskActions}
          shortcutActions={previousShortcutActions + taskShortcutActions}
          mistakes={previousMistakes + taskMistakes}
          completedTasks={completedTasks + run.validation.completionPercent}
          totalTasks={totalTasks}
          pbMs={null}
          enabled={liveStatsEnabled}
        />
      </div>

      <div className="relative" data-testid="grid-stage">
        <SpreadsheetGrid
          grid={run.grid}
          onAction={run.dispatch}
          allowedActions={challenge.allowedActions}
        />
        <RunFeedbackLayer
          event={feedbackEvent}
          reducedMotion={reducedMotion}
          combo={taskActions - taskMistakes}
          shortcutLabel={shortcutLabelForEvent(run.events.at(-1))}
          showCombo={showCombo}
          showShortcut={showShortcut}
        />
      </div>

      <div className="flex min-h-9 w-full items-center justify-between gap-4">
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
    </div>
  );
}

export function SessionRun({
  sessionMode,
  personalRecords,
  sessionRecords,
  recordHistory,
  seedOverride,
}: SessionRunProps) {
  const plan = SESSION_PLANS[sessionMode];
  const { settings } = useSettings();

  const [clock] = useState(createRunClock);
  const sessionStartedAt = useSyncExternalStore(
    clock.subscribe,
    clock.getSnapshot,
    clock.getServerSnapshot,
  );

  const [taskIndex, setTaskIndex] = useState(0);
  const [tasks, setTasks] = useState<SessionTaskResult[]>([]);
  const [finishedTaskStats, setFinishedTaskStats] = useState<
    Array<{ actions: number; shortcutActions: number; mistakes: number }>
  >([]);
  const [outcome, setOutcome] = useState<{
    result: SessionResult;
    submission: SessionRecordSubmission;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);

  const tasksRef = useRef<SessionTaskResult[]>([]);

  // Sessions only mount on a player's click, so a wall-clock seed never renders on the server.
  const drawCounter = useRef(0);
  const [runSeed, setRunSeed] = useState<string>(
    () => seedOverride ?? `s${Date.now().toString(36)}`,
  );

  const queue = useMemo(() => buildSessionQueue(sessionMode, runSeed), [sessionMode, runSeed]);

  // The overshoot is generous, but a superhuman prefix consumer wraps rather than crashes.
  const challenge: Challenge = queue.tasks[taskIndex % queue.tasks.length].variant;

  const durationMs = plan.kind === "fixed-time" ? plan.durationSeconds * 1000 : null;
  const deadlineAtMs =
    durationMs !== null && sessionStartedAt !== null ? sessionStartedAt + durationMs : null;

  // Only the stable submit function may enter dependency arrays below. The records object itself
  // is rebuilt every render, and its identity would cascade into the deadline effect and re-arm
  // the countdown timer on every unrelated re-render.
  const { submit: submitSessionRecord } = sessionRecords;

  const finishSession = useCallback(
    (allTasks: SessionTaskResult[]) => {
      const now = Date.now();
      const result = buildSessionResult({
        mode: sessionMode,
        tasks: allTasks,
        totalElapsedMs: now - clock.startedAt(),
        finishedAtMs: now,
      });
      const submission = submitSessionRecord(sessionRecordFromResult(result, SESSION_DIFFICULTY));

      recordHistory?.({
        modeKey: sessionMode,
        label: sessionModeLabel(sessionMode),
        score: result.totalScore,
        elapsedMs: result.totalElapsedMs,
        // A sprint with skips is a finished session but not a completed one. A timed run always
        // ran its full course.
        completed:
          SESSION_PLANS[sessionMode].kind === "task-count"
            ? result.tasksCompleted === result.taskCount
            : true,
        tasksCompleted: result.tasksCompleted,
        isNewRecord: submission.isNewRecord,
      });

      setOutcome({ result, submission });
    },
    [sessionMode, clock, submitSessionRecord, recordHistory],
  );

  const handleTaskFinished = useCallback(
    (finished: FinishedRun, taskOutcome: TaskOutcome) => {
      const next = [...tasksRef.current, toTaskResult(challenge, finished, taskOutcome)];

      tasksRef.current = next;
      setTasks(next);
      const replayEvents = finished.submission.replayEvents;
      setFinishedTaskStats((current) => [
        ...current,
        {
          actions: replayEvents.length,
          shortcutActions: replayEvents.filter((event) => event.inputMethod === "keyboard").length,
          mistakes: Math.round(replayEvents.length * (1 - finished.validation.accuracy)),
        },
      ]);

      const sprintDone = plan.kind === "task-count" && next.length >= plan.taskCount;
      // In a timed run the queue only stops when the clock does. The wall clock is checked here
      // as well as the outcome tag, because setTimeout is a lower bound: a completion can land
      // after the true deadline but before the pending timer fires, and it must end the session
      // rather than start a task the clock has no room for.
      const timeUp =
        plan.kind === "fixed-time" &&
        (taskOutcome === "expired" || (deadlineAtMs !== null && Date.now() >= deadlineAtMs));

      if (sprintDone || timeUp) {
        finishSession(next);
      } else {
        setTaskIndex(next.length);
      }
    },
    [challenge, plan, finishSession, deadlineAtMs],
  );

  const retry = useCallback(() => {
    tasksRef.current = [];
    drawCounter.current += 1;

    setTasks([]);
    setFinishedTaskStats([]);
    setTaskIndex(0);
    setOutcome(null);
    setAttempt((current) => current + 1);
    // A pinned seed re-races the same queue; otherwise retry is a fresh draw.
    setRunSeed(seedOverride ?? `s${Date.now().toString(36)}-${drawCounter.current}`);
    clock.restart();
  }, [clock, seedOverride]);

  const completedCount = tasks.filter((task) => task.outcome === "completed").length;
  const taskNumber = plan.kind === "task-count" ? Math.min(taskIndex + 1, plan.taskCount) : taskIndex + 1;

  // A finished timed run froze at the buzzer, so the countdown shows zero rather than overshoot.
  const frozenElapsedMs =
    outcome === null
      ? null
      : durationMs === null
        ? outcome.result.totalElapsedMs
        : Math.min(outcome.result.totalElapsedMs, durationMs);
  const previousTaskStats = outcome === null ? finishedTaskStats : finishedTaskStats.slice(0, -1);
  const previousActions = previousTaskStats.reduce((sum, stats) => sum + stats.actions, 0);
  const previousShortcutActions = previousTaskStats.reduce(
    (sum, stats) => sum + stats.shortcutActions,
    0,
  );
  const previousMistakes = previousTaskStats.reduce((sum, stats) => sum + stats.mistakes, 0);
  const statsCompletedCount =
    outcome === null
      ? completedCount
      : tasks.slice(0, -1).filter((task) => task.outcome === "completed").length;

  return (
    <div data-testid="practice-frame" className="flex flex-col items-center gap-4">
      <div
        data-testid="prompt-rail"
        className="flex min-h-14 w-full items-end justify-between gap-8"
      >
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium tracking-widest text-muted uppercase">
            {sessionModeLabel(sessionMode)}
            {plan.kind === "task-count"
              ? ` · task ${taskNumber} of ${plan.taskCount}`
              : ` · task ${taskNumber} · ${completedCount} done`}
          </span>
          <h1 className="text-xl font-semibold tracking-tight text-ink">{challenge.prompt}</h1>
        </div>
        <div className="flex items-end gap-5">
          <TaskProgressRail
            currentTask={taskNumber}
            completedTasks={completedCount}
            totalTasks={plan.kind === "task-count" ? plan.taskCount : null}
          />
          <TimerDisplay
            startedAt={sessionStartedAt}
            frozenElapsedMs={frozenElapsedMs}
            countdownFromMs={durationMs ?? undefined}
          />
        </div>
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
          deadlineAtMs={deadlineAtMs}
          frozen={outcome !== null}
          sessionStartedAt={sessionStartedAt}
          frozenSessionElapsedMs={frozenElapsedMs}
          previousActions={previousActions}
          previousShortcutActions={previousShortcutActions}
          previousMistakes={previousMistakes}
          completedTasks={statsCompletedCount}
          totalTasks={plan.kind === "task-count" ? plan.taskCount : 0}
          liveStatsEnabled={settings.feedback.liveStats}
          reducedMotion={settings.accessibility.reducedMotion}
          showCombo={settings.feedback.combo}
          showShortcut={settings.feedback.shortcutFlash}
          soundPreferences={settings.sound}
        />

        {outcome !== null && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-canvas/70 backdrop-blur-[2px]">
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

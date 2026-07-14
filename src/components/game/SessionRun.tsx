"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { HelpControl, HelpPanel } from "@/components/game/HelpPanel";
import { LiveStatsBar } from "@/components/game/LiveStatsBar";
import { UnrankedBadge } from "@/components/game/UnrankedBadge";
import {
  chordLabelForEvent,
  feedbackEventForRun,
  RunFeedbackLayer,
} from "@/components/game/RunFeedbackLayer";
import { SessionResultCard } from "@/components/game/SessionResultCard";
import { TaskProgressRail } from "@/components/game/TaskProgressRail";
import { TimerDisplay } from "@/components/game/TimerDisplay";
import { Toolbar } from "@/components/game/Toolbar";
import { SpreadsheetGrid } from "@/components/grid/SpreadsheetGrid";
import { SESSION_DIFFICULTY, buildSessionQueue } from "@/data/challenges/queue";
import type { Challenge } from "@/domain/challenges/challengeTypes";
import type { GridDensity, Settings } from "@/domain/settings/themes";
import { createNewSessionSeed } from "@/domain/random/seeds";
import { compareRoute } from "@/domain/routes/compareRoute";
import { getRoutes } from "@/domain/routes/routeCache";
import { runRecordForSession, type NewRunRecord } from "@/domain/runs/runRecord";
import {
  advanceCombo,
  comboMultiplier,
  comboOutcomeFrom,
  COMBO_RESET,
  type ComboState,
} from "@/domain/scoring/combo";
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
import { calculateLiveRunStats } from "@/domain/stats/liveRunStats";
import { createRunClock } from "@/hooks/runClock";
import { useAssist, type Assist } from "@/hooks/useAssist";
import { useFastestPath } from "@/hooks/useFastestPath";
import { useGameRun, type FinishedRun } from "@/hooks/useGameRun";
import type { LocalPersonalRecords } from "@/hooks/useLocalPersonalRecords";
import type { LocalSessionRecords, SessionRecordSubmission } from "@/hooks/useLocalSessionRecords";
import { useSettings } from "@/hooks/useSettings";
import { useWarmRoutes } from "@/hooks/useWarmRoutes";
import { getPlatform } from "@/lib/platform";
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
  /** Lets the shell log the finished session to the run log. */
  recordHistory?: (entry: NewRunRecord) => void;
  /**
   * Pins the queue seed, for tests and shared runs. With an override, retry re-races the exact
   * same queue; without one, every attempt draws a fresh queue, like a fresh Monkeytype test.
   */
  seedOverride?: string | null;
  /** UI-boundary injection keeps normal-play seed assertions deterministic in tests. */
  createSessionSeed?: () => string;
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
    subgoals: finished.validation.subgoals,
  };
}

type SessionTaskProps = {
  challenge: Challenge;
  records: LocalPersonalRecords;
  /** The session's assist, not the task's: help revealed on one task assists the whole session. */
  assist: Assist;
  onFinished: (finished: FinishedRun, outcome: TaskOutcome) => void;
  /** Read at finish time (hotkey plan §1a.14): the streak *entering* this task scores it. */
  getComboMultiplier: () => number;
  /** The driver's streak right now, for the live feedback lane. */
  comboStreak: number;
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
  gridDensity: GridDensity;
  gridlineStrength: Settings["grid"]["gridlineStrength"];
  largeTargets: boolean;
};

/**
 * One task inside a session. It is the single-challenge run machinery with two differences: no
 * per-task result card, because the session advances instead, and no per-challenge personal
 * record, because the session banks one record for the whole run.
 */
function SessionTask({
  challenge,
  records,
  assist,
  onFinished,
  getComboMultiplier,
  comboStreak,
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
  gridDensity,
  gridlineStrength,
  largeTargets,
}: SessionTaskProps) {
  // A task reports its result exactly once, whichever of completion, skip, or the session
  // deadline gets there first.
  const reportedRef = useRef(false);
  // Toolbar clicks steal DOM focus (§2.3 fact 3 of the plan); this is how it's returned so a
  // hybrid keyboard+toolbar route doesn't go dead mid-task.
  const gridFocusRef = useRef<HTMLDivElement>(null);

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
    assist: assist.assist,
    onFinished: handleFinished,
    getComboMultiplier,
  });
  const path = useFastestPath(challenge, run.events, assist.stage === "revealed");

  // Warms the route cache off the render path, so `compareRoute` at finish time — and the combo
  // judgment it feeds — is a cache hit rather than a fresh solve (see useWarmRoutes).
  useWarmRoutes(challenge);

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
          combo={comboStreak}
          enabled={liveStatsEnabled}
        />
      </div>

      {/* `w-full` so the row is bounded by the frame instead of by its own content; see ChallengeRun. */}
      <div className="flex w-full items-start gap-4">
        {/* `min-w-0` so this column can shrink below the grid's natural width; see ChallengeRun. */}
        <div className="flex min-w-0 flex-col">
          {/* Above the grid, in the flow. See RunFeedbackLayer: laid over the grid, these cues sat on
              the column headers and on the last row. */}
          <RunFeedbackLayer
            event={feedbackEvent}
            reducedMotion={reducedMotion}
            combo={comboStreak}
            shortcutLabel={chordLabelForEvent(run.events.at(-1), getPlatform())}
            showCombo={showCombo}
            showShortcut={showShortcut}
          />

          <div className="relative max-w-full" data-testid="grid-stage">
            {/* The sheet scrolls in here rather than overflowing the centred column. */}
            <div className="max-w-full overflow-x-auto" data-testid="grid-scroll">
              <SpreadsheetGrid
                grid={run.grid}
                onAction={run.dispatch}
                allowedActions={challenge.allowedActions}
                focusRef={gridFocusRef}
                density={gridDensity}
                gridlineStrength={gridlineStrength}
                largeTargets={largeTargets}
              />
            </div>
          </div>
        </div>

        {/* Width held from mount, so revealing the path cannot shift the grid mid-task (§7.2). */}
        <div className="hidden w-64 shrink-0 lg:block">
          {assist.visible && !frozen && <HelpPanel path={path} />}
        </div>
      </div>

      <div className="flex min-h-9 w-full items-center justify-between gap-4">
        <Toolbar
          challenge={challenge}
          grid={run.grid}
          onAction={run.dispatch}
          gridFocusRef={gridFocusRef}
        />
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
  createSessionSeed = createNewSessionSeed,
}: SessionRunProps) {
  const plan = SESSION_PLANS[sessionMode];
  const { settings } = useSettings();
  // One assist for the whole session, not one per task: the session is a single performance and
  // banks a single record, so seeing the answer once is seeing it, and there is nothing to unrank
  // more finely than the session itself. Practice's auto-reveal does not apply — a session is not
  // Practice, and a session that opened pre-assisted could never be ranked at all.
  const assist = useAssist({ confirmBeforeReveal: settings.help.confirmBeforeReveal });

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
    /** Null when the session was assisted: no session record was written, and none is claimed. */
    submission: SessionRecordSubmission | null;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [gridPresentation] = useState(() => ({
    density: settings.grid.density,
    gridlineStrength: settings.grid.gridlineStrength,
    largeTargets: settings.accessibility.largeTargets,
  }));

  const tasksRef = useRef<SessionTaskResult[]>([]);

  // The combo lives outside React state for the same reason the run clock does: the multiplier
  // must be read at the *next* task's finish time, not at whatever render happened to be current
  // when it changed. `comboStreak` mirrors it into state purely so the feedback lane re-renders.
  const comboRef = useRef<ComboState>(COMBO_RESET);
  const [comboStreak, setComboStreak] = useState(0);
  const getComboMultiplier = useCallback(() => comboMultiplier(comboRef.current), []);

  const [runSeed, setRunSeed] = useState<string>(() => seedOverride ?? createSessionSeed());

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
      // Help revealed on any one task assists the *whole session*. A session banks one record for
      // one continuous performance, so there is no way to unrank the third task while still ranking
      // the sprint it belongs to. The honest move is to bank nothing — and to say nothing, rather
      // than fabricate a submission for a record that was never written.
      const submission =
        assist.assist === "revealed"
          ? null
          : submitSessionRecord(sessionRecordFromResult(result, SESSION_DIFFICULTY));

      // A sprint with skips is a finished session but not a completed one; a timed run always ran
      // its full course. `runRecordForSession` owns that distinction now (§1a.11).
      recordHistory?.(
        runRecordForSession({
          mode: sessionMode,
          result,
          isNewRecord: submission?.isNewRecord ?? false,
          assist: assist.assist,
        }),
      );

      setOutcome({ result, submission });
    },
    [sessionMode, clock, submitSessionRecord, recordHistory, assist.assist],
  );

  const handleTaskFinished = useCallback(
    (finished: FinishedRun, taskOutcome: TaskOutcome) => {
      const next = [...tasksRef.current, toTaskResult(challenge, finished, taskOutcome)];

      tasksRef.current = next;
      setTasks(next);

      const replayEvents = finished.submission.replayEvents;
      // The solve was warmed off the render path (`useWarmRoutes`), so this is a cache hit rather
      // than the difficulty-5 cost of a fresh search landing here, mid-session.
      const routes = getRoutes(challenge);
      const comparison = compareRoute(replayEvents, routes, getPlatform());
      // Unknown waste (`confidence: "low"`) never breaks a combo or inflates the mistake count —
      // the engine's ignorance is not the player's fault.
      const highConfidenceExtraActions =
        comparison.confidence === "high" ? comparison.extraActions : 0;

      setFinishedTaskStats((current) => [
        ...current,
        {
          actions: replayEvents.length,
          shortcutActions: replayEvents.filter((event) => event.inputMethod === "keyboard").length,
          mistakes: highConfidenceExtraActions,
        },
      ]);

      // The multiplier scores the streak *entering* a task; the driver advances it only after that
      // task is fully consumed (hotkey plan §1a.14). A skip or an expiry breaks the chain outright,
      // whatever the grid happened to look like at that moment.
      const comboOutcome = comboOutcomeFrom({
        elapsedMs: finished.elapsedMs,
        targetSeconds: challenge.scoring.targetSeconds,
        extraActions: comparison.confidence === "high" ? comparison.extraActions : null,
        corrections: 0,
      });

      comboRef.current = advanceCombo(
        comboRef.current,
        taskOutcome === "completed" ? comboOutcome : { underTarget: false, clean: false },
      );
      setComboStreak(comboRef.current.streak);

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
    comboRef.current = COMBO_RESET;

    setTasks([]);
    setFinishedTaskStats([]);
    setComboStreak(0);
    setTaskIndex(0);
    setOutcome(null);
    setAttempt((current) => current + 1);
    // A pinned seed re-races the same queue; otherwise retry is a fresh draw.
    setRunSeed(seedOverride ?? createSessionSeed());
    clock.restart();
  }, [clock, createSessionSeed, seedOverride]);

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
  const finalActions = finishedTaskStats.reduce((sum, stats) => sum + stats.actions, 0);
  const finalShortcutActions = finishedTaskStats.reduce(
    (sum, stats) => sum + stats.shortcutActions,
    0,
  );
  const finalMistakes = finishedTaskStats.reduce((sum, stats) => sum + stats.mistakes, 0);
  const finalLiveStats =
    outcome === null
      ? undefined
      : calculateLiveRunStats({
          elapsedMs: outcome.result.totalElapsedMs,
          actions: finalActions,
          shortcutActions: finalShortcutActions,
          mistakes: finalMistakes,
          completedTasks: outcome.result.tasksCompleted,
          totalTasks: outcome.result.taskCount,
          pbMs: outcome.submission?.previousBest?.bestElapsedMs ?? null,
          // The streak at session end. `SessionResultCard` does not read `combo` off this object
          // today, but the value is real rather than a placeholder that would rot silently.
          combo: comboStreak,
        });

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
          {assist.stage === "revealed" && <UnrankedBadge />}
          <HelpControl assist={assist} available={outcome === null} />
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
          assist={assist}
          onFinished={handleTaskFinished}
          getComboMultiplier={getComboMultiplier}
          comboStreak={comboStreak}
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
          gridDensity={gridPresentation.density}
          gridlineStrength={gridPresentation.gridlineStrength}
          largeTargets={gridPresentation.largeTargets}
        />

        {outcome !== null && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-canvas/70 backdrop-blur-[2px]">
            <SessionResultCard
              result={outcome.result}
              previousBest={outcome.submission?.previousBest}
              isNewRecord={outcome.submission?.isNewRecord ?? false}
              liveStats={finalLiveStats}
              onRetry={retry}
            />
          </div>
        )}
      </div>
    </div>
  );
}

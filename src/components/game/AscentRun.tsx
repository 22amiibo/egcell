"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { AscentResultCard } from "@/components/game/AscentResultCard";
import { ChallengePrompt } from "@/components/game/ChallengePrompt";
import {
  chordLabelForEvent,
  feedbackEventForRun,
  RunFeedbackLayer,
} from "@/components/game/RunFeedbackLayer";
import { TierMeter } from "@/components/game/TierMeter";
import { TimerDisplay } from "@/components/game/TimerDisplay";
import { Toolbar } from "@/components/game/Toolbar";
import { SpreadsheetGrid } from "@/components/grid/SpreadsheetGrid";
import { generatedTemplates } from "@/data/challenges/generated";
import { DATASET_THEMES } from "@/data/datasets/themes";
import { advanceAscent } from "@/domain/ascent/ascentEngine";
import { ascentRecordFromResult, type AscentResult } from "@/domain/ascent/ascentResult";
import { ascentTaskScore } from "@/domain/ascent/ascentScore";
import { ASCENT_CONFIG, ASCENT_START, type AscentState } from "@/domain/ascent/ascentTypes";
import type { ChallengeDifficulty } from "@/domain/challenges/challengeTypes";
import type { ChallengeVariant } from "@/domain/challenges/variantTypes";
import { drawAscentTask } from "@/domain/ascent/drawAscentTask";
import type { AscentRecord } from "@/domain/records/ascentRecords";
import { createNewSessionSeed } from "@/domain/random/seeds";
import { compareRoute } from "@/domain/routes/compareRoute";
import { getRoutes } from "@/domain/routes/routeCache";
import { runRecordForAscent, type NewRunRecord } from "@/domain/runs/runRecord";
import type { RunEvent } from "@/domain/runs/runTypes";
import {
  advanceCombo,
  comboMultiplier,
  comboOutcomeFrom,
  COMBO_RESET,
  type ComboState,
} from "@/domain/scoring/combo";
import type { GridDensity, Settings } from "@/domain/settings/themes";
import type { TaskOutcome } from "@/domain/sessions/sessionTypes";
import { keystrokeAccuracy, typingCorrections, typingWpm } from "@/domain/stats/typingStats";
import { createRunClock } from "@/hooks/runClock";
import { useGameRun, type FinishedRun } from "@/hooks/useGameRun";
import type { LocalAscentRecords } from "@/hooks/useLocalAscentRecords";
import type { LocalPersonalRecords } from "@/hooks/useLocalPersonalRecords";
import { useSettings } from "@/hooks/useSettings";
import { useWarmRoutes } from "@/hooks/useWarmRoutes";
import { getPlatform } from "@/lib/platform";

/**
 * One completed-or-not task on the ladder, logged so the frozen summary can total the run without
 * re-deriving it from `AscentState`, which only keeps the running counters, not the per-task story.
 */
export type AscentTaskRow = {
  title: string;
  tier: ChallengeDifficulty;
  score: number;
  underTarget: boolean;
  completed: boolean;
};

type AscentTaskProps = {
  variant: ChallengeVariant;
  records: LocalPersonalRecords;
  getComboMultiplier: () => number;
  comboStreak: number;
  deadlineAtMs: number | null;
  frozen: boolean;
  reducedMotion: boolean;
  showCombo: boolean;
  showShortcut: boolean;
  gridDensity: GridDensity;
  gridlineStrength: Settings["grid"]["gridlineStrength"];
  largeTargets: boolean;
  onFinished: (finished: FinishedRun, outcome: TaskOutcome) => void;
};

/**
 * One task inside the climb. Mirrors `SessionTask` exactly: the same single-run machinery, the
 * same per-task deadline effect, the same skip-grades-what's-there behaviour. No per-task result
 * card and no personal record — the ladder's one continuous performance is what the frozen summary
 * reports on, same reasoning as a session task.
 */
function AscentTask({
  variant,
  records,
  getComboMultiplier,
  comboStreak,
  deadlineAtMs,
  frozen,
  reducedMotion,
  showCombo,
  showShortcut,
  gridDensity,
  gridlineStrength,
  largeTargets,
  onFinished,
}: AscentTaskProps) {
  // A task reports its result exactly once, whichever of completion, skip, or the run's deadline
  // gets there first.
  const reportedRef = useRef(false);
  // Toolbar clicks steal DOM focus (§2.3 fact 3 of the plan); this is how it's returned so a hybrid
  // keyboard+toolbar route doesn't go dead mid-task.
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

  const run = useGameRun(variant, "main-speed", records, {
    recordPersonalBest: false,
    onFinished: handleFinished,
    getComboMultiplier,
  });

  // Warms the route cache off the render path, so `compareRoute` at finish time — and the combo
  // judgment it feeds — is a cache hit rather than a fresh solve (see useWarmRoutes).
  useWarmRoutes(variant);

  const { finishNow } = run;

  // Skipping still grades the grid, so a half-formatted range pays its partial credit rather than
  // vanishing. A skip that turns out to be complete counts as completed.
  const skip = useCallback(() => {
    const finished = finishNow();

    report(finished, finished.validation.isComplete ? "completed" : "skipped");
  }, [finishNow, report]);

  // The run's deadline lands mid-task. Whatever is on the grid at that moment is graded as is.
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

  const feedbackEvent = feedbackEventForRun(run.events, run.validation, run.result !== null);

  return (
    <div className="flex w-full flex-col items-center gap-5">
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
                allowedActions={variant.allowedActions}
                focusRef={gridFocusRef}
                density={gridDensity}
                gridlineStrength={gridlineStrength}
                largeTargets={largeTargets}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-h-9 w-full items-center justify-between gap-4">
        <Toolbar
          challenge={variant}
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

type AscentRunProps = {
  /** Pins the run's task draws, for tests and shared runs. Retry always draws a fresh one. */
  runSeed: string;
  durationSeconds: number;
  records: LocalPersonalRecords;
  /**
   * The Ascent record book. One shared instance, passed down from `GameShell` rather than called
   * here directly: `useLocalAscentRecords`'s own docs warn that two separate instances would each
   * hold their own snapshot, and a bank through one would not appear in the other (GameShell's
   * `bestLabel`) until a reload.
   */
  ascentRecords: LocalAscentRecords;
  /**
   * Appends the finished climb to the run log. Optional, like `SessionRun`'s `recordHistory`: a
   * component test that only cares about the ladder itself need not wire one up.
   */
  recordHistory?: (entry: NewRunRecord) => void;
  /** UI-boundary injection keeps retry's seed assertions deterministic in tests. */
  createSessionSeed?: () => string;
};

/**
 * The fixed-clock ladder. One clock for the whole run — the tier only ever climbs, and a slow or
 * skipped clear costs heat, never the tier itself (`advanceAscent`'s ratchet). No fail state: the
 * clock ending is the only thing that ends a climb.
 */
export function AscentRun({
  runSeed: initialRunSeed,
  durationSeconds,
  records,
  ascentRecords,
  recordHistory,
  createSessionSeed = createNewSessionSeed,
}: AscentRunProps) {
  const { settings } = useSettings();
  const { submit: submitAscentRecord } = ascentRecords;

  const [clock] = useState(createRunClock);
  const startedAt = useSyncExternalStore(clock.subscribe, clock.getSnapshot, clock.getServerSnapshot);

  const [attempt, setAttempt] = useState(0);
  const [runSeed, setRunSeed] = useState(initialRunSeed);

  const [ascent, setAscent] = useState<AscentState>(ASCENT_START);
  const comboRef = useRef<ComboState>(COMBO_RESET);
  const [comboStreak, setComboStreak] = useState(0);
  const [taskIndex, setTaskIndex] = useState(0);
  const [taskLog, setTaskLog] = useState<AscentTaskRow[]>([]);
  const [lastTemplateIds, setLastTemplateIds] = useState<string[]>([]);
  const [ended, setEnded] = useState(false);
  // The task in play when the clock stops. Held so the finish's own state updates (a promotion, the
  // template history) cannot redraw the frozen drill out from under the summary.
  const [frozenVariant, setFrozenVariant] = useState<ChallengeVariant | null>(null);
  // This climb's longest combo streak, independent of the current one — `comboStreak` resets on a
  // slow or dirty clear, but the result card reports the peak the run actually reached.
  const [bestStreak, setBestStreak] = useState(0);
  // Every task's replay events, whatever the challenge, concatenated so the buzzer can compute one
  // run-wide wpm/keystrokeAccuracy instead of a single task's. A ref rather than state: nothing
  // reads it before the run ends, and by then it must already hold the finishing task's events —
  // appended synchronously inside `handleTaskFinished`, ahead of the state updates that flip
  // `ended` — which a state setter's own render delay could not guarantee.
  const replayEventsRef = useRef<RunEvent[]>([]);
  // Guards the bank-once effect below across a re-render after `ended` flips true (and React
  // Strict Mode's double effect invocation in development): without it, banking would run twice.
  const bankedRef = useRef(false);
  const [bankedOutcome, setBankedOutcome] = useState<{
    result: AscentResult;
    previousBest: AscentRecord | undefined;
    isNewRecord: boolean;
  } | null>(null);

  const [gridPresentation] = useState(() => ({
    density: settings.grid.density,
    gridlineStrength: settings.grid.gridlineStrength,
    largeTargets: settings.accessibility.largeTargets,
  }));

  const getComboMultiplier = useCallback(() => comboMultiplier(comboRef.current), []);

  const durationMs = durationSeconds * 1000;
  const deadlineAtMs = startedAt !== null ? startedAt + durationMs : null;

  const drawnVariant = useMemo(
    () =>
      ended
        ? null
        : drawAscentTask({
            runSeed,
            index: taskIndex,
            tier: ascent.tier,
            overdriveRungs: ascent.overdriveRungs,
            lastTemplateIds,
            templates: generatedTemplates,
            themes: DATASET_THEMES,
          }),
    [ended, runSeed, taskIndex, ascent.tier, ascent.overdriveRungs, lastTemplateIds],
  );

  // While the clock runs, the live draw is on screen; once it stops, the drill that was in play
  // freezes under the summary instead of being redrawn by the finishing task's state updates.
  const variant = ended ? frozenVariant : drawnVariant;

  const handleTaskFinished = useCallback(
    (finished: FinishedRun, outcome: TaskOutcome) => {
      if (variant === null) {
        return;
      }

      const stateBefore = ascent;
      const comparison = compareRoute(
        finished.submission.replayEvents,
        getRoutes(variant),
        getPlatform(),
      );
      const comboOutcome = comboOutcomeFrom({
        elapsedMs: finished.elapsedMs,
        targetSeconds: variant.scoring.targetSeconds,
        extraActions: comparison.confidence === "high" ? comparison.extraActions : null,
        corrections: typingCorrections(finished.submission.replayEvents),
      });
      const completed = outcome === "completed";

      // Recorded synchronously (a ref, not state) so it is already settled by the time the
      // bank-once effect reads it on the same render that flips `ended` true.
      replayEventsRef.current = [...replayEventsRef.current, ...finished.submission.replayEvents];

      setTaskLog((log) => [
        ...log,
        {
          title: variant.title,
          tier: stateBefore.tier,
          score: completed ? ascentTaskScore(finished.score.score, stateBefore) : 0,
          underTarget: comboOutcome.underTarget,
          completed,
        },
      ]);
      setAscent(advanceAscent(stateBefore, { completed, underTarget: comboOutcome.underTarget }));
      comboRef.current = advanceCombo(
        comboRef.current,
        completed ? comboOutcome : { underTarget: false, clean: false },
      );
      setComboStreak(comboRef.current.streak);
      setBestStreak((previous) => Math.max(previous, comboRef.current.streak));
      setLastTemplateIds((previous) => [...previous, variant.templateId].slice(-2));

      // The wall clock is checked here as well as the outcome tag, because setTimeout is a lower
      // bound: a completion can land after the true deadline but before the pending timer fires,
      // and it must end the climb rather than start a task the clock has no room for.
      const timeUp =
        outcome === "expired" || (deadlineAtMs !== null && Date.now() >= deadlineAtMs);

      if (timeUp) {
        setFrozenVariant(variant);
        setEnded(true);
      } else {
        setTaskIndex((index) => index + 1);
      }
    },
    [variant, ascent, deadlineAtMs],
  );

  const retry = useCallback(() => {
    comboRef.current = COMBO_RESET;
    setLastTemplateIds([]);

    setAscent(ASCENT_START);
    setComboStreak(0);
    setBestStreak(0);
    setTaskIndex(0);
    setTaskLog([]);
    setEnded(false);
    setFrozenVariant(null);
    replayEventsRef.current = [];
    bankedRef.current = false;
    setBankedOutcome(null);
    setAttempt((current) => current + 1);
    // Retry always draws a fresh climb, like a fresh Monkeytype test.
    setRunSeed(createSessionSeed());
    clock.restart();
  }, [clock, createSessionSeed]);

  // A finished climb froze at the buzzer, so the countdown shows zero rather than overshoot.
  const frozenElapsedMs = ended ? durationMs : null;
  const totalScore = taskLog.reduce((sum, row) => sum + row.score, 0);

  // Banks the climb exactly once, on the false→true edge of `ended`. `handleTaskFinished` batches
  // every state update for the finishing task — `taskLog`, `ascent`, `frozenVariant`, this flip —
  // into the same render (React 19 batches state updates regardless of where they are set from),
  // so by the time this effect runs, `ascent`/`totalScore` already hold the run's true, settled
  // final state rather than a stale mid-climb render.
  useEffect(() => {
    if (!ended || bankedRef.current) {
      return;
    }

    bankedRef.current = true;

    const result: AscentResult = {
      durationSeconds,
      totalScore,
      tasksCompleted: ascent.tasksCompleted,
      peakTier: ascent.peakTier,
      overdriveRungs: ascent.overdriveRungs,
      wpm: typingWpm(replayEventsRef.current, durationMs),
      keystrokeAccuracy: keystrokeAccuracy(replayEventsRef.current),
      finishedAt: new Date().toISOString(),
    };

    const submission = submitAscentRecord(ascentRecordFromResult(result));

    recordHistory?.(runRecordForAscent({ result, isNewRecord: submission.isNewRecord }));

    setBankedOutcome({
      result,
      previousBest: submission.previousBest,
      isNewRecord: submission.isNewRecord,
    });
  }, [ended, durationSeconds, durationMs, totalScore, ascent, submitAscentRecord, recordHistory]);

  return (
    <div data-testid="ascent-frame" className="flex flex-col items-center gap-4">
      <div
        data-testid="prompt-rail"
        className="flex min-h-14 w-full items-end justify-between gap-8"
      >
        <div className="flex flex-col gap-2">
          <TierMeter
            tier={ascent.tier}
            heat={ascent.heat}
            heatToPromote={ASCENT_CONFIG.heatToPromote}
            overdriveRungs={ascent.overdriveRungs}
          />
          {variant !== null && <ChallengePrompt challenge={variant} />}
        </div>

        <TimerDisplay
          startedAt={startedAt}
          frozenElapsedMs={frozenElapsedMs}
          countdownFromMs={durationMs}
        />
      </div>

      <div className="relative flex w-full flex-col items-center">
        {/*
          Keyed by attempt and task, so each task mounts a fresh run and retry starts the whole
          climb over from a clean grid.
        */}
        {variant !== null && (
          <AscentTask
            key={`${attempt}:${taskIndex}`}
            variant={variant}
            records={records}
            getComboMultiplier={getComboMultiplier}
            comboStreak={comboStreak}
            deadlineAtMs={deadlineAtMs}
            frozen={ended}
            reducedMotion={settings.accessibility.reducedMotion}
            showCombo={settings.feedback.combo}
            showShortcut={settings.feedback.shortcutFlash}
            gridDensity={gridPresentation.density}
            gridlineStrength={gridPresentation.gridlineStrength}
            largeTargets={gridPresentation.largeTargets}
            onFinished={handleTaskFinished}
          />
        )}

        {ended && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-canvas/70 backdrop-blur-[2px]">
            {bankedOutcome !== null && (
              <AscentResultCard
                result={bankedOutcome.result}
                previousBest={bankedOutcome.previousBest}
                isNewRecord={bankedOutcome.isNewRecord}
                bestStreak={bestStreak}
                onRetry={retry}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";

import type { Challenge, ChallengeMode } from "@/domain/challenges/challengeTypes";
import { gridReducer } from "@/domain/grid/gridReducer";
import type { GridAction, GridState } from "@/domain/grid/gridTypes";
import { isPersonalRecordEligible } from "@/domain/records/personalRecords";
import type { PersonalRecord } from "@/domain/records/recordTypes";
import type { RunEvent, RunState, RunStatus } from "@/domain/runs/runTypes";
import { scoreRun } from "@/domain/scoring/scoreRun";
import type { ScoreResult } from "@/domain/scoring/scoringTypes";
import { validateChallenge } from "@/domain/validation/validateChallenge";
import type { ValidationResult } from "@/domain/validation/validatorTypes";
import type { LocalPersonalRecords } from "@/hooks/useLocalPersonalRecords";

export type FinishedRun = {
  validation: ValidationResult;
  score: ScoreResult;
  elapsedMs: number;
  previousBest: PersonalRecord | undefined;
  isNewRecord: boolean;
};

export type GameRun = {
  grid: GridState;
  status: RunStatus;
  /** Epoch milliseconds. Null on the server, before the clock exists. */
  startedAt: number | null;
  result: FinishedRun | null;
  dispatch: (action: GridAction) => void;
  retry: () => void;
};

/**
 * The wall clock is an external system, so the run reads it through `useSyncExternalStore`.
 *
 * The clock starts when the grid appears, not on the first click. Were it to start on the first
 * action, a correct first click would always land at roughly zero elapsed time, pinning the speed
 * multiplier at its cap on every run and flattening the score into a constant.
 *
 * The server snapshot is null because `Date.now()` on the server and in the browser would disagree
 * and break hydration. The first read in the browser is what starts the run.
 */
function createRunClock() {
  const listeners = new Set<() => void>();

  let startedAt: number | null = null;

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    getSnapshot(): number | null {
      startedAt ??= Date.now();

      return startedAt;
    },

    getServerSnapshot(): number | null {
      return null;
    },

    /** The start time the scorer measures against. Identical to what the timer displays. */
    startedAt(): number {
      startedAt ??= Date.now();

      return startedAt;
    },

    restart(): void {
      startedAt = Date.now();
      listeners.forEach((listener) => listener());
    },
  };
}

/**
 * One run of one challenge. Callers that can switch challenges should key this component by
 * challenge id, so a new challenge gets a fresh run rather than inheriting this one's state.
 */
export function useGameRun(
  challenge: Challenge,
  mode: ChallengeMode,
  records: LocalPersonalRecords,
): GameRun {
  const [clock] = useState(createRunClock);
  const [grid, setGrid] = useState<GridState>(challenge.initialGrid);
  const [result, setResult] = useState<FinishedRun | null>(null);

  const gridRef = useRef<GridState>(challenge.initialGrid);
  const resultRef = useRef<FinishedRun | null>(null);
  const eventsRef = useRef<RunEvent[]>([]);

  const startedAt = useSyncExternalStore(
    clock.subscribe,
    clock.getSnapshot,
    clock.getServerSnapshot,
  );

  const { submit, getBest } = records;

  const status: RunStatus = result !== null ? "complete" : startedAt === null ? "idle" : "running";

  const retry = useCallback(() => {
    gridRef.current = challenge.initialGrid;
    resultRef.current = null;
    eventsRef.current = [];

    setGrid(challenge.initialGrid);
    setResult(null);
    clock.restart();
  }, [challenge, clock]);

  const dispatch = useCallback(
    (action: GridAction) => {
      if (resultRef.current !== null) {
        return;
      }

      const now = Date.now();
      const runStartedAt = clock.startedAt();

      const nextGrid = gridReducer(gridRef.current, action);

      // The reducer hands back the same object for an action that changes nothing, such as a click
      // outside the grid. That is not a move, so it should not reach the event log.
      if (nextGrid === gridRef.current) {
        return;
      }

      gridRef.current = nextGrid;
      setGrid(nextGrid);
      eventsRef.current = [...eventsRef.current, { atMs: now - runStartedAt, action }];

      const run: RunState = {
        challengeId: challenge.id,
        challengeVersion: challenge.version,
        seed: challenge.seed,
        mode,
        status: "running",
        startedAt: runStartedAt,
        finishedAt: null,
        elapsedMs: now - runStartedAt,
        events: eventsRef.current,
      };

      const validation = validateChallenge({ challenge, grid: nextGrid, run });

      if (!validation.isComplete) {
        return;
      }

      const elapsedMs = now - runStartedAt;
      const score = scoreRun({
        elapsedMs,
        correctness: validation.correctness,
        completionPercent: validation.completionPercent,
        accuracy: validation.accuracy,
        basePoints: challenge.scoring.basePoints,
        targetSeconds: challenge.scoring.targetSeconds,
      });

      let previousBest = getBest(challenge.id, mode);
      let isNewRecord = false;

      if (isPersonalRecordEligible(challenge, validation)) {
        const submission = submit({
          challengeId: challenge.id,
          mode,
          bestScore: score.score,
          bestElapsedMs: elapsedMs,
          bestCorrectness: validation.correctness,
          achievedAt: new Date(now).toISOString(),
          seed: challenge.seed,
        });

        previousBest = submission.previousBest;
        isNewRecord = submission.isNewRecord;
      }

      const finished: FinishedRun = { validation, score, elapsedMs, previousBest, isNewRecord };

      resultRef.current = finished;
      setResult(finished);
    },
    [challenge, mode, submit, getBest, clock],
  );

  return { grid, status, startedAt, result, dispatch, retry };
}

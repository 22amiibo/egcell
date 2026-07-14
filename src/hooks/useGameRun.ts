"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";

import type { Challenge, ChallengeMode } from "@/domain/challenges/challengeTypes";
import type { ActionMeta } from "@/domain/commands/commandTypes";
import { gridReducer } from "@/domain/grid/gridReducer";
import type { GridAction, GridState } from "@/domain/grid/gridTypes";
import { isPersonalRecordEligible } from "@/domain/records/personalRecords";
import type { PersonalRecord } from "@/domain/records/recordTypes";
import { getRunEligibility } from "@/domain/runs/runEligibility";
import { RUN_RECORD_VERSION, type RunAssist } from "@/domain/runs/runRecord";
import { buildRunResult, type RunResult } from "@/domain/runs/runResult";
import type { RunEvent, RunState, RunStatus } from "@/domain/runs/runTypes";
import { scoreRun } from "@/domain/scoring/scoreRun";
import type { ScoreResult } from "@/domain/scoring/scoringTypes";
import { validateChallenge } from "@/domain/validation/validateChallenge";
import {
  NOTHING_DONE_YET,
  type ValidationResult,
} from "@/domain/validation/validatorTypes";
import { createRunClock } from "@/hooks/runClock";
import type { LocalPersonalRecords } from "@/hooks/useLocalPersonalRecords";

export type FinishedRun = {
  validation: ValidationResult;
  score: ScoreResult;
  elapsedMs: number;
  previousBest: PersonalRecord | undefined;
  isNewRecord: boolean;
  /** Whether this run saw the answer. The record reads it from here rather than re-deriving it. */
  assist: RunAssist;
  /**
   * The leaderboard-shaped summary of this run. Built for every completed run and sent nowhere.
   * Having the UI read it keeps the shape honest: it cannot rot into a type nothing produces.
   */
  submission: RunResult;
};

export type GameRun = {
  grid: GridState;
  status: RunStatus;
  /** Epoch milliseconds. Null on the server, before the clock exists. */
  startedAt: number | null;
  result: FinishedRun | null;
  events: RunEvent[];
  validation: ValidationResult;
  dispatch: (action: GridAction, meta: ActionMeta) => void;
  retry: () => void;
  /**
   * Ends the run right now and grades whatever the grid looks like, complete or not. Sessions use
   * it for skipping a task and for the moment the session clock expires; the validation inside the
   * returned result says how much partial credit the state was worth.
   */
  finishNow: () => FinishedRun;
};

export type GameRunOptions = {
  /**
   * Single-challenge play banks per-challenge personal records. A task inside a sprint or timed
   * session must not: the session banks one record for the whole session instead.
   */
  recordPersonalBest?: boolean;
  /**
   * Whether this run has seen the fastest path. Monotonic within an attempt (`useAssist`), and read
   * only by the eligibility policy — a `"revealed"` run still plays, still grades, still scores, and
   * simply never banks a record (§6.2).
   */
  assist?: RunAssist;
  /** Fires once when the run completes through play. Not fired by `finishNow`, whose caller already holds the result. */
  onFinished?: (finished: FinishedRun) => void;
};

/**
 * One run of one challenge. Callers that can switch challenges should key this component by
 * challenge id, so a new challenge gets a fresh run rather than inheriting this one's state.
 */
export function useGameRun(
  challenge: Challenge,
  mode: ChallengeMode,
  records: LocalPersonalRecords,
  options: GameRunOptions = {},
): GameRun {
  const { recordPersonalBest = true, assist = "none", onFinished } = options;

  const [clock] = useState(createRunClock);
  const [grid, setGrid] = useState<GridState>(challenge.initialGrid);
  const [result, setResult] = useState<FinishedRun | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [validation, setValidation] = useState<ValidationResult>(NOTHING_DONE_YET);

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
    setEvents([]);
    setValidation(NOTHING_DONE_YET);
    clock.restart();
  }, [challenge, clock]);

  const buildFinished = useCallback(
    (validation: ValidationResult, now: number, runStartedAt: number): FinishedRun => {
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

      // The policy decides what a run counts for; `isPersonalRecordEligible` is the correctness
      // floor the challenge itself sets. The policy composes it rather than duplicating it (§5.6).
      // Note what is *not* consulted: the mode. A Practice run banks a Practice best exactly as a
      // Speed run banks a Speed one — assistance, not mode identity, unranks a run (§1a.1).
      // Assistance is an *input to the policy*, never a second gate standing beside it. A run that
      // took help is unranked because `getRunEligibility` says so — the same function, reading the
      // same field, that the log and the profile and the leaderboard read (§5.6). An inline
      // `if (assisted) skip` here would be a second home for the rule, and the two would eventually
      // disagree about what a record is.
      const eligibility = getRunEligibility({
        schemaVersion: RUN_RECORD_VERSION,
        assist,
        outcome: validation.isComplete ? "completed" : "failed",
        integrity: "ok",
      });

      if (
        recordPersonalBest &&
        eligibility.countsForPersonalBest &&
        isPersonalRecordEligible(challenge, validation)
      ) {
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

      const submission = buildRunResult({
        challengeId: challenge.id,
        challengeVersion: challenge.version,
        seed: challenge.seed,
        mode,
        score: score.score,
        correctness: validation.correctness,
        completionPercent: validation.completionPercent,
        accuracy: validation.accuracy,
        startedAtMs: runStartedAt,
        finishedAtMs: now,
        events: eventsRef.current,
      });

      return { validation, score, elapsedMs, previousBest, isNewRecord, assist, submission };
    },
    [challenge, mode, submit, getBest, recordPersonalBest, assist],
  );

  const dispatch = useCallback(
    (action: GridAction, meta: ActionMeta) => {
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
      eventsRef.current = [
        ...eventsRef.current,
        {
          atMs: now - runStartedAt,
          action,
          inputMethod: meta.inputMethod,
          command: meta.command,
          via: meta.via,
          chord: meta.chord,
          controlId: meta.controlId,
        },
      ];
      setEvents(eventsRef.current);

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
      setValidation(validation);

      if (!validation.isComplete) {
        return;
      }

      const finished = buildFinished(validation, now, runStartedAt);

      resultRef.current = finished;
      setResult(finished);
      onFinished?.(finished);
    },
    [challenge, mode, clock, buildFinished, onFinished],
  );

  const finishNow = useCallback((): FinishedRun => {
    if (resultRef.current !== null) {
      return resultRef.current;
    }

    const now = Date.now();
    const runStartedAt = clock.startedAt();

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

    const validation = validateChallenge({ challenge, grid: gridRef.current, run });
    setValidation(validation);
    const finished = buildFinished(validation, now, runStartedAt);

    resultRef.current = finished;
    setResult(finished);

    return finished;
  }, [challenge, mode, clock, buildFinished]);

  return { grid, status, startedAt, result, events, validation, dispatch, retry, finishNow };
}

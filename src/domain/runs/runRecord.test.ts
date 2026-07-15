import { describe, expect, it } from "vitest";

import { challenges } from "@/data/challenges";
import type { AscentResult } from "@/domain/ascent/ascentResult";
import type { Challenge, ChallengeMode } from "@/domain/challenges/challengeTypes";
import {
  isRunRecord,
  runRecordForAscent,
  runRecordForChallenge,
  runRecordForSession,
  stampRunRecord,
  type ChallengeRunInput,
  type NewRunRecord,
  type RunRecord,
} from "@/domain/runs/runRecord";
import type { SessionResult } from "@/domain/sessions/sessionTypes";

const challenge: Challenge = challenges[0];

function challengeInput(overrides: Partial<ChallengeRunInput> = {}): ChallengeRunInput {
  return {
    challenge,
    mode: "main-speed" as ChallengeMode,
    score: 1000,
    elapsedMs: 5000,
    correctness: 1,
    accuracy: 1,
    isComplete: true,
    isNewRecord: false,
    eventDigest: null,
    ...overrides,
  };
}

function sessionResult(overrides: Partial<SessionResult> = {}): SessionResult {
  return {
    mode: "sprint-5",
    totalScore: 4000,
    totalElapsedMs: 20_000,
    tasksCompleted: 5,
    taskCount: 5,
    completionPercent: 1,
    accuracy: 0.95,
    finishedAt: "2026-07-14T00:00:00.000Z",
    tasks: [],
    ...overrides,
  };
}

function ascentResult(overrides: Partial<AscentResult> = {}): AscentResult {
  return {
    durationSeconds: 90,
    totalScore: 12_400,
    tasksCompleted: 18,
    peakTier: 4,
    overdriveRungs: 2,
    wpm: 62,
    keystrokeAccuracy: 0.97,
    finishedAt: "2026-07-14T00:00:00.000Z",
    ...overrides,
  };
}

/** A real, fully-stamped record — built from the challenge builder rather than hand-maintained. */
function fullRecord(overrides: Partial<RunRecord> = {}): RunRecord {
  const entry: NewRunRecord = runRecordForChallenge(challengeInput());

  return stampRunRecord({ ...entry, ...overrides }, Date.parse("2026-07-14T00:00:00.000Z"), "t-1");
}

describe("isRunRecord: peakTier, wpm, keystrokeAccuracy", () => {
  it("accepts a record that carries them as numbers", () => {
    const candidate = fullRecord({ peakTier: 3, wpm: 55, keystrokeAccuracy: 0.9 });

    expect(isRunRecord(candidate)).toBe(true);
  });

  it("accepts a record that carries them as null", () => {
    const candidate = fullRecord({ peakTier: null, wpm: null, keystrokeAccuracy: null });

    expect(isRunRecord(candidate)).toBe(true);
  });

  it("accepts a legacy row that lacks the keys entirely — undefined is not a reason to drop it", () => {
    const candidate: Partial<RunRecord> = { ...fullRecord() };

    delete candidate.peakTier;
    delete candidate.wpm;
    delete candidate.keystrokeAccuracy;

    expect(isRunRecord(candidate)).toBe(true);
  });

  it("rejects a record where one of the three is the wrong type", () => {
    expect(isRunRecord(fullRecord({ wpm: "fast" as unknown as number }))).toBe(false);
    expect(isRunRecord(fullRecord({ peakTier: "T4" as unknown as number }))).toBe(false);
    expect(isRunRecord(fullRecord({ keystrokeAccuracy: "high" as unknown as number }))).toBe(false);
  });
});

describe("runRecordForChallenge: wpm and keystrokeAccuracy", () => {
  it("carries them through when the caller supplies them, and always nulls peakTier", () => {
    const result = runRecordForChallenge(challengeInput({ wpm: 58, keystrokeAccuracy: 0.92 }));

    expect(result.peakTier).toBeNull();
    expect(result.wpm).toBe(58);
    expect(result.keystrokeAccuracy).toBe(0.92);
  });

  it("defaults both to null when the caller omits them — a run that never typed", () => {
    const result = runRecordForChallenge(challengeInput());

    expect(result.peakTier).toBeNull();
    expect(result.wpm).toBeNull();
    expect(result.keystrokeAccuracy).toBeNull();
  });

  it("keeps an explicit zero distinct from a missing value", () => {
    const result = runRecordForChallenge(challengeInput({ wpm: 0, keystrokeAccuracy: 0 }));

    expect(result.wpm).toBe(0);
    expect(result.keystrokeAccuracy).toBe(0);
  });
});

describe("runRecordForSession: wpm, keystrokeAccuracy, peakTier", () => {
  it("always nulls all three — a session records no single run's typing or tier", () => {
    const result = runRecordForSession({
      mode: "sprint-5",
      result: sessionResult(),
      isNewRecord: false,
    });

    expect(result.peakTier).toBeNull();
    expect(result.wpm).toBeNull();
    expect(result.keystrokeAccuracy).toBeNull();
  });
});

describe("runRecordForAscent", () => {
  it("maps a finished climb onto a session-shaped record, plus the peak and typing stats", () => {
    const result = runRecordForAscent({ result: ascentResult(), isNewRecord: true });

    expect(result).toEqual({
      modeKey: "ascent",
      label: "Ascent 90s",
      challengeId: null,
      challengeVersion: null,
      templateId: null,
      family: null,
      difficulty: null,
      seed: null,
      outcome: "completed",
      completed: true,
      tasksCompleted: 18,
      taskCount: 18,
      score: 12_400,
      elapsedMs: 90_000,
      targetMs: null,
      correctness: 1,
      accuracy: 0.97,
      actions: null,
      keyboardActions: null,
      shortcutActions: null,
      optimalActions: null,
      routeEfficiency: null,
      keyboardShare: null,
      routeId: null,
      peakTier: 4,
      wpm: 62,
      keystrokeAccuracy: 0.97,
      assist: "none",
      integrity: "ok",
      isNewRecord: true,
      attempts: 0,
      eventDigest: null,
    });
  });

  it("falls back accuracy to 1 when the climb never typed, and leaves wpm/keystrokeAccuracy null", () => {
    const result = runRecordForAscent({
      result: ascentResult({ wpm: null, keystrokeAccuracy: null }),
      isNewRecord: false,
    });

    expect(result.accuracy).toBe(1);
    expect(result.wpm).toBeNull();
    expect(result.keystrokeAccuracy).toBeNull();
  });

  it("does not claim a route: the ladder has no comparison to make", () => {
    const result = runRecordForAscent({ result: ascentResult(), isNewRecord: false });

    expect(result.actions).toBeNull();
    expect(result.optimalActions).toBeNull();
    expect(result.routeEfficiency).toBeNull();
  });
});

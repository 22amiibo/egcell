import { describe, expect, it } from "vitest";

import { ascentRecordFromResult, type AscentResult } from "@/domain/ascent/ascentResult";

function result(overrides: Partial<AscentResult> = {}): AscentResult {
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

describe("ascentRecordFromResult", () => {
  it("maps a finished climb onto the record the book compares", () => {
    expect(ascentRecordFromResult(result())).toEqual({
      durationSeconds: 90,
      bestScore: 12_400,
      peakTierAtBest: 4,
      bestTasksCompleted: 18,
      bestPeakTier: 4,
      achievedAt: "2026-07-14T00:00:00.000Z",
    });
  });

  it("drops overdriveRungs, wpm, and keystrokeAccuracy — the book has no columns for them", () => {
    const record = ascentRecordFromResult(result());

    expect(record).not.toHaveProperty("overdriveRungs");
    expect(record).not.toHaveProperty("wpm");
    expect(record).not.toHaveProperty("keystrokeAccuracy");
  });

  it("seeds both peak-tier fields from this run's own peak — they only diverge once the book merges a later run", () => {
    const record = ascentRecordFromResult(result({ peakTier: 5 }));

    expect(record.peakTierAtBest).toBe(5);
    expect(record.bestPeakTier).toBe(5);
  });

  it("carries a climb that never typed through untouched — nothing here reads wpm or keystrokeAccuracy", () => {
    const record = ascentRecordFromResult(result({ wpm: null, keystrokeAccuracy: null }));

    expect(record.bestScore).toBe(12_400);
  });
});

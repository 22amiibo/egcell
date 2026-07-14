import { describe, expect, it } from "vitest";

import { scoreRun } from "@/domain/scoring/scoreRun";
import type { ScoreInput } from "@/domain/scoring/scoringTypes";

function perfectRun(overrides: Partial<ScoreInput> = {}): ScoreInput {
  return {
    elapsedMs: 8_000,
    correctness: 1,
    completionPercent: 1,
    accuracy: 1,
    basePoints: 1000,
    targetSeconds: 8,
    ...overrides,
  };
}

describe("scoreRun", () => {
  it("pays exactly the base points for a perfect run at the target time", () => {
    const result = scoreRun(perfectRun());

    expect(result.speedMultiplier).toBe(1);
    expect(result.correctnessMultiplier).toBe(1);
    expect(result.accuracyMultiplier).toBe(1);
    expect(result.completionMultiplier).toBe(1);
    expect(result.score).toBe(1000);
  });

  it("scores a faster perfect run above a slower perfect run", () => {
    const fast = scoreRun(perfectRun({ elapsedMs: 4_000 }));
    const slow = scoreRun(perfectRun({ elapsedMs: 16_000 }));

    expect(fast.score).toBeGreaterThan(slow.score);
    expect(fast.score).toBe(2000);
    expect(slow.score).toBe(500);
  });

  it("caps the speed multiplier at 2 so a lucky click cannot run away with the board", () => {
    const result = scoreRun(perfectRun({ elapsedMs: 10 }));

    expect(result.speedMultiplier).toBe(2);
    expect(result.score).toBe(2000);
  });

  it("floors the speed multiplier at 0.2 so a slow run still scores something", () => {
    const result = scoreRun(perfectRun({ elapsedMs: 10 * 60 * 1000 }));

    expect(result.speedMultiplier).toBe(0.2);
    expect(result.score).toBe(200);
  });

  it("treats anything under half a second as half a second", () => {
    const instant = scoreRun(perfectRun({ elapsedMs: 0 }));
    const halfSecond = scoreRun(perfectRun({ elapsedMs: 500 }));

    expect(instant.score).toBe(halfSecond.score);
  });

  it("pays nothing when the run is not correct", () => {
    const result = scoreRun(perfectRun({ correctness: 0 }));

    expect(result.correctnessMultiplier).toBe(0);
    expect(result.score).toBe(0);
  });

  it("squares correctness, so half-right is far worse than half credit", () => {
    const result = scoreRun(perfectRun({ correctness: 0.5 }));

    expect(result.correctnessMultiplier).toBe(0.25);
    expect(result.score).toBe(250);
  });

  it("pays nothing when nothing was completed", () => {
    expect(scoreRun(perfectRun({ completionPercent: 0 })).score).toBe(0);
  });

  it("scales with completion percent for partial progress", () => {
    expect(scoreRun(perfectRun({ completionPercent: 0.5 })).score).toBe(500);
  });

  it("docks a quarter of the score at worst for poor accuracy", () => {
    const sloppy = scoreRun(perfectRun({ accuracy: 0 }));

    expect(sloppy.accuracyMultiplier).toBe(0.75);
    expect(sloppy.score).toBe(750);
  });

  it("never returns a fractional score", () => {
    const result = scoreRun(perfectRun({ elapsedMs: 3_333, accuracy: 0.37, correctness: 0.9 }));

    expect(Number.isInteger(result.score)).toBe(true);
  });

  it("never returns a negative score", () => {
    const result = scoreRun(
      perfectRun({ correctness: 0, completionPercent: 0, accuracy: 0, elapsedMs: 999_999 }),
    );

    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("multiplies by the combo multiplier, clamped to [1, 1.5]", () => {
    const base = {
      elapsedMs: 5000,
      correctness: 1,
      completionPercent: 1,
      accuracy: 1,
      basePoints: 1000,
      targetSeconds: 5,
    };

    const plain = scoreRun(base);
    const combod = scoreRun({ ...base, comboMultiplier: 1.5 });
    const overclamped = scoreRun({ ...base, comboMultiplier: 9 });
    const underclamped = scoreRun({ ...base, comboMultiplier: 0 });

    expect(combod.score).toBe(Math.round(plain.score * 1.5));
    expect(combod.comboMultiplier).toBe(1.5);
    expect(overclamped.score).toBe(combod.score);
    expect(underclamped.score).toBe(plain.score);
    expect(plain.comboMultiplier).toBe(1);
  });
});

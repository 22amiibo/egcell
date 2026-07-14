import { describe, expect, it } from "vitest";

import {
  getRunEligibility,
  type RunEligibility,
  type RunEligibilityInput,
} from "@/domain/runs/runEligibility";

/** A normal, completed, unassisted run written by this version. Every rule bends it a different way. */
function run(overrides: Partial<RunEligibilityInput> = {}): RunEligibilityInput {
  return {
    schemaVersion: 2,
    assist: "none",
    outcome: "completed",
    integrity: "ok",
    ...overrides,
  };
}

const ALL_TRUE: RunEligibility = {
  countsForPersonalBest: true,
  countsForPerformanceStats: true,
  countsForLeaderboard: true,
  countsForRecentRuns: true,
  countsForPracticeActivity: true,
};

const ALL_FALSE: RunEligibility = {
  countsForPersonalBest: false,
  countsForPerformanceStats: false,
  countsForLeaderboard: false,
  countsForRecentRuns: false,
  countsForPracticeActivity: false,
};

const UNRANKED_BUT_SHOWN: RunEligibility = {
  countsForPersonalBest: false,
  countsForPerformanceStats: false,
  countsForLeaderboard: false,
  countsForRecentRuns: true,
  countsForPracticeActivity: true,
};

describe("getRunEligibility", () => {
  it("counts a normal completed run for everything", () => {
    expect(getRunEligibility(run())).toEqual(ALL_TRUE);
  });

  it("counts nothing at all for a suspect run, which is still stored for audit", () => {
    expect(getRunEligibility(run({ integrity: "suspect" }))).toEqual(ALL_FALSE);
  });

  it("unranks an assisted run but keeps it in Recent Runs and in practice activity", () => {
    expect(getRunEligibility(run({ assist: "revealed" }))).toEqual(UNRANKED_BUT_SHOWN);
  });

  it("unranks a failed or expired run, which still appears in Recent Runs", () => {
    for (const outcome of ["failed", "expired"] as const) {
      expect(getRunEligibility(run({ outcome }))).toEqual(UNRANKED_BUT_SHOWN);
    }
  });

  it("keeps a migrated legacy run in the stats but never lets it re-derive a personal best", () => {
    // The PB books are authoritative and are never re-derived from a 50-row window (§9.4).
    expect(getRunEligibility(run({ schemaVersion: 1 }))).toEqual({
      countsForPersonalBest: false,
      countsForPerformanceStats: true,
      countsForLeaderboard: false,
      countsForRecentRuns: true,
      countsForPracticeActivity: true,
    });
  });

  it("applies the rules in order: suspect beats assisted beats outcome beats legacy", () => {
    expect(
      getRunEligibility(
        run({ integrity: "suspect", assist: "revealed", outcome: "failed", schemaVersion: 1 }),
      ),
    ).toEqual(ALL_FALSE);

    // Assisted and failed disagree with legacy about the stats. The earlier rule wins.
    expect(
      getRunEligibility(run({ assist: "revealed", outcome: "failed", schemaVersion: 1 })),
    ).toEqual(UNRANKED_BUT_SHOWN);
  });
});

/**
 * The load-bearing property of this whole plan (§1a.1): eligibility is governed by the run's own
 * state, never by which mode it was played in. A Practice run and a Speed run in the same state are
 * graded identically — which is why Practice keeps an ordinary, record-eligible PB book.
 */
describe("mode is not an input", () => {
  it("ranks an unassisted, completed Practice run exactly like a Speed one", () => {
    // There is deliberately no mode to pass: `RunEligibilityInput` cannot express one.
    expect(getRunEligibility(run()).countsForPersonalBest).toBe(true);
  });

  it("unranks an assisted Practice run — assistance, not mode, is what does it", () => {
    expect(getRunEligibility(run({ assist: "revealed" })).countsForPersonalBest).toBe(false);
  });
});

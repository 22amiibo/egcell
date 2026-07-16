import { describe, expect, it } from "vitest";

import { SESSION_MODES } from "@/domain/sessions/sessionTypes";
import type { RunRecord } from "@/domain/runs/runRecord";
import {
  categoryIdForMode,
  METRICS,
  PERFORMANCE_CATEGORIES,
  performanceCategory,
} from "@/domain/stats/categories";

function runRecord(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    id: "run-1",
    schemaVersion: 2,
    at: new Date(1_760_000_000_000).toISOString(),
    atMs: 1_760_000_000_000,
    modeKey: "main-speed",
    categoryId: "speed",
    label: "Select the Revenue column",
    challengeId: "selection.revenue-column",
    challengeVersion: "v1",
    templateId: null,
    family: "selection",
    difficulty: 2,
    seed: "seed",
    outcome: "completed",
    completed: true,
    tasksCompleted: 1,
    taskCount: 1,
    score: 1000,
    elapsedMs: 8000,
    targetMs: 8000,
    correctness: 1,
    accuracy: 1,
    actions: 5,
    keyboardActions: 5,
    shortcutActions: 5,
    optimalActions: 5,
    routeEfficiency: 1,
    keyboardShare: 1,
    routeId: "route-a",
    peakTier: null,
    wpm: null,
    keystrokeAccuracy: null,
    peakComboStreak: null,
    comboBreakCount: null,
    comboOpportunityCount: null,
    assist: "none",
    integrity: "ok",
    isNewRecord: false,
    attempts: 0,
    eventDigest: null,
    ...overrides,
  };
}

describe("PERFORMANCE_CATEGORIES", () => {
  it("gives every category a non-empty set of mode keys", () => {
    for (const category of PERFORMANCE_CATEGORIES) {
      expect(category.modeKeys.length).toBeGreaterThan(0);
    }
  });

  it("keeps the mode keys disjoint, so a run belongs to one category or to none — never two", () => {
    const seen = new Set<string>();

    for (const category of PERFORMANCE_CATEGORIES) {
      for (const modeKey of category.modeKeys) {
        expect(seen.has(modeKey)).toBe(false);
        seen.add(modeKey);
      }
    }
  });

  it("gives every category at least one metric, the first being its default", () => {
    for (const category of PERFORMANCE_CATEGORIES) {
      expect(category.metrics.length).toBeGreaterThan(0);
    }
  });

  it("demands a pure keyboard route for Hotkey, and for nothing else", () => {
    const pure = PERFORMANCE_CATEGORIES.filter(
      (category) => category.requires?.keyboardPure === true,
    );

    expect(pure.map((category) => category.id)).toEqual(["hotkey"]);
  });

  it("claims every session mode, so adding one cannot leave it off the graph unnoticed", () => {
    for (const mode of SESSION_MODES) {
      expect(categoryIdForMode(mode)).toBe(mode);
    }
  });
});

describe("categoryIdForMode", () => {
  it("maps the playable modes to their categories", () => {
    expect(categoryIdForMode("main-speed")).toBe("speed");
    expect(categoryIdForMode("practice")).toBe("practice");
    expect(categoryIdForMode("hotkey")).toBe("hotkey");
    expect(categoryIdForMode("sprint-10")).toBe("sprint-10");
    expect(categoryIdForMode("ascent")).toBe("ascent");
  });

  it("returns null for a mode no category claims, rather than guessing one", () => {
    // A hand-edited blob, or a mode a later release removed. The run stays in the log and in
    // Recent Runs; it is excluded from every chart (§9.2). Excluded, never guessed.
    expect(categoryIdForMode("some-removed-mode")).toBeNull();
    expect(categoryIdForMode("")).toBeNull();
  });
});

describe("performanceCategory", () => {
  it("resolves an id to its category", () => {
    expect(performanceCategory("speed").label).toBe("Speed");
  });
});

describe("METRICS.peakTier", () => {
  it("is null for a non-Ascent run, so the series drops it rather than plotting a zero", () => {
    const nonAscentRun = runRecord({ modeKey: "main-speed", categoryId: "speed", peakTier: null });

    expect(METRICS.peakTier.value(nonAscentRun)).toBeNull();
  });

  it("returns the peak tier reached for an Ascent run", () => {
    const ascentRun = runRecord({ modeKey: "ascent", categoryId: "ascent", peakTier: 4 });

    expect(METRICS.peakTier.value(ascentRun)).toBe(4);
  });

  it("formats the tier as T<n>", () => {
    expect(METRICS.peakTier.format(4)).toBe("T4");
  });
});

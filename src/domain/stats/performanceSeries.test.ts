import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { RunLog } from "@/domain/runs/runLog";
import type { RunRecord } from "@/domain/runs/runRecord";
import { PERFORMANCE_CATEGORIES } from "@/domain/stats/categories";
import { buildSeries, rollingAverage } from "@/domain/stats/performanceSeries";

const DAY = 86_400_000;

function run(index: number, overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    id: `run-${index}`,
    schemaVersion: 2,
    at: new Date(1_760_000_000_000 + index * DAY).toISOString(),
    atMs: 1_760_000_000_000 + index * DAY,
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
    assist: "none",
    integrity: "ok",
    isNewRecord: false,
    attempts: 0,
    eventDigest: null,
    ...overrides,
  };
}

function logOf(...runs: RunRecord[]): RunLog {
  return {
    version: 2,
    priorTotals: { runs: 0, tasksCompleted: 0 },
    priorByMode: {},
    rollups: [],
    runs,
  };
}

describe("rollingAverage", () => {
  it("is trailing, so the line never knows the future", () => {
    // A centred window would let a run the player has not had yet lift the line under a run they
    // already have: the shape they read as "I was improving here" would be made partly of tomorrow.
    expect(rollingAverage([10, 20, 30], 2)).toEqual([10, 15, 25]);
  });
});

describe("buildSeries", () => {
  it("plots the eligible runs in order, and marks each personal best as it happens", () => {
    const series = buildSeries(
      logOf(run(0, { score: 900 }), run(1, { score: 1200 }), run(2, { score: 1000 })),
      "speed",
      "score",
    );

    expect(series.points.map((point) => point.value)).toEqual([900, 1200, 1000]);
    expect(series.points.map((point) => point.isRecord)).toEqual([true, true, false]);
    expect(series.runCount).toBe(3);
    expect(series.hasEnough).toBe(true);
  });

  it("keeps an assisted run off the chart — decided by the policy, not by the chart", () => {
    const series = buildSeries(
      logOf(run(0), run(1, { assist: "revealed" }), run(2)),
      "speed",
      "score",
    );

    expect(series.runCount).toBe(2);
  });

  it("keeps a pointer-tainted run off the Hotkey chart, and a Hotkey run off the Speed chart", () => {
    // The categories are disjoint, and Hotkey demands purity on top of eligibility. A Hotkey run
    // that reached for the mouse is still a run and still in Recent Runs — and not on this chart.
    const log = logOf(
      run(0, { modeKey: "hotkey", categoryId: "hotkey", keyboardShare: 1 }),
      run(1, { modeKey: "hotkey", categoryId: "hotkey", keyboardShare: 0.5 }),
      run(2, { modeKey: "main-speed", categoryId: "speed" }),
    );

    expect(buildSeries(log, "hotkey", "score").runCount).toBe(1);
    expect(buildSeries(log, "speed", "score").runCount).toBe(1);
  });

  it("drops a run that cannot answer the metric rather than plotting it as a zero", () => {
    // A zero would draw a point, and the player would read a catastrophic run they never had.
    const series = buildSeries(
      logOf(run(0), run(1, { keyboardShare: null }), run(2)),
      "speed",
      "keyboardShare",
    );

    expect(series.points).toHaveLength(2);
  });

  it("does not invert anything itself, but says which way is better", () => {
    expect(buildSeries(logOf(run(0)), "speed", "paceIndex").lowerIsBetter).toBe(true);
    expect(buildSeries(logOf(run(0)), "speed", "score").lowerIsBetter).toBe(false);
  });

  it("says when there is not enough to draw a trend, instead of drawing one anyway", () => {
    const series = buildSeries(logOf(run(0), run(1)), "speed", "score");

    expect(series.hasEnough).toBe(false);
    expect(series.runCount).toBe(2);
  });

  it("folds a long series by day, so four hundred runs read as a trend and not a smear", () => {
    const category = PERFORMANCE_CATEGORIES.find((candidate) => candidate.id === "speed")!;
    const many = Array.from({ length: category.aggregateAbove + 10 }, (_, index) =>
      // Two runs a day, so the fold has something to fold.
      run(index, { atMs: 1_760_000_000_000 + Math.floor(index / 2) * DAY, score: 1000 + index }),
    );

    const series = buildSeries(logOf(...many), "speed", "score");

    expect(series.bucketed).toBe(true);
    expect(series.runCount).toBe(many.length);
    expect(series.points.length).toBeLessThan(many.length);
    expect(series.points.every((point) => point.runs >= 1)).toBe(true);
  });
});

describe("the registry is the only place a mode string lives", () => {
  it("no profile component names a mode", () => {
    // §9.1. A component that hardcodes "sprint-5" has to be edited every time a mode is added — and
    // it is the one that gets forgotten. The categories registry is the single list; the components
    // render from it. This test is what keeps that true after everyone has forgotten it was a rule.
    const directory = join(process.cwd(), "src/components/profile");
    const modeKeys = PERFORMANCE_CATEGORIES.flatMap((category) => category.modeKeys);

    for (const file of readdirSync(directory).filter((name) => name.endsWith(".tsx"))) {
      if (file.endsWith(".test.tsx")) {
        continue;
      }

      const source = readFileSync(join(directory, file), "utf8");

      for (const modeKey of modeKeys) {
        expect(source, `${file} names the mode "${modeKey}"`).not.toContain(`"${modeKey}"`);
      }
    }
  });
});

import { describe, expect, it } from "vitest";

import {
  mixedFilterEastCurrencyChallenge,
  mixedSortAndBoldChallenge,
} from "@/data/challenges";
import type { Challenge } from "@/domain/challenges/challengeTypes";
import { gridReducer } from "@/domain/grid/gridReducer";
import type { GridAction, GridState } from "@/domain/grid/gridTypes";
import type { RunState } from "@/domain/runs/runTypes";
import { validateChallenge } from "@/domain/validation/validateChallenge";
import {
  HEADER_ROW,
  LAST_DATA_ROW,
  LAST_USED_COL,
  REGION_COL,
  REVENUE_COL,
  FIRST_DATA_ROW,
} from "@/test/fixtures/revenueGrid";

function runFor(challenge: Challenge): RunState {
  return {
    challengeId: challenge.id,
    challengeVersion: challenge.version,
    seed: challenge.seed,
    mode: "main-speed",
    status: "running",
    startedAt: 0,
    finishedAt: null,
    elapsedMs: 0,
    events: [],
  };
}

function play(challenge: Challenge, ...actions: GridAction[]) {
  const grid = actions.reduce<GridState>(gridReducer, challenge.initialGrid);

  return validateChallenge({ challenge, grid, run: runFor(challenge) });
}

const SORT: GridAction = { kind: "sort-column", col: REVENUE_COL, direction: "desc" };
const BOLD_HEADER: GridAction = {
  kind: "set-format",
  range: { start: { row: HEADER_ROW, col: 0 }, end: { row: HEADER_ROW, col: LAST_USED_COL } },
  format: { bold: true },
};
const FILTER_EAST: GridAction = {
  kind: "filter-column",
  col: REGION_COL,
  op: "equals",
  value: "East",
};
const CURRENCY_REVENUE: GridAction = {
  kind: "set-format",
  range: {
    start: { row: FIRST_DATA_ROW, col: REVENUE_COL },
    end: { row: LAST_DATA_ROW, col: REVENUE_COL },
  },
  format: { numberFormat: "currency" },
};

describe("composite validation", () => {
  it("reports each labeled subgoal independently", () => {
    const labeled: Challenge = {
      ...mixedSortAndBoldChallenge,
      validation: {
        kind: "composite",
        parts:
          mixedSortAndBoldChallenge.validation.kind === "composite"
            ? mixedSortAndBoldChallenge.validation.parts
            : [],
        partLabels: ["Sort Revenue", "Bold the headers"],
      },
    };

    const sortOnly = play(labeled, SORT);

    expect(sortOnly.subgoals).toEqual([
      { label: "Sort Revenue", isComplete: true, completionPercent: 1 },
      { label: "Bold the headers", isComplete: false, completionPercent: 0 },
    ]);
    expect(sortOnly.completionPercent).toBeCloseTo(0.5);
  });

  it("keeps the subgoal breakdown when every part passes", () => {
    const labeled: Challenge = {
      ...mixedSortAndBoldChallenge,
      validation: {
        kind: "composite",
        parts:
          mixedSortAndBoldChallenge.validation.kind === "composite"
            ? mixedSortAndBoldChallenge.validation.parts
            : [],
        partLabels: ["Sort Revenue", "Bold the headers"],
      },
    };

    const result = play(labeled, BOLD_HEADER, SORT);

    expect(result.isComplete).toBe(true);
    expect(result.subgoals).toEqual([
      { label: "Sort Revenue", isComplete: true, completionPercent: 1 },
      { label: "Bold the headers", isComplete: true, completionPercent: 1 },
    ]);
  });

  it("does not complete on half the work, but shows the progress", () => {
    const sortOnly = play(mixedSortAndBoldChallenge, SORT);

    expect(sortOnly.isComplete).toBe(false);
    expect(sortOnly.completionPercent).toBeCloseTo(0.5);

    const boldOnly = play(mixedSortAndBoldChallenge, BOLD_HEADER);

    expect(boldOnly.isComplete).toBe(false);
    expect(boldOnly.completionPercent).toBeCloseTo(0.5);
  });

  it("completes when every part passes, in either order", () => {
    expect(play(mixedSortAndBoldChallenge, SORT, BOLD_HEADER).isComplete).toBe(true);
    expect(play(mixedSortAndBoldChallenge, BOLD_HEADER, SORT).isComplete).toBe(true);
  });

  it("grades the filter-and-currency challenge in either order too", () => {
    expect(play(mixedFilterEastCurrencyChallenge, FILTER_EAST, CURRENCY_REVENUE).isComplete).toBe(
      true,
    );
    expect(play(mixedFilterEastCurrencyChallenge, CURRENCY_REVENUE, FILTER_EAST).isComplete).toBe(
      true,
    );
  });

  it("formats hidden rows as part of the whole column, so filter-first still completes", () => {
    // Filtering hides four rows; the currency format still has to reach them, and does, because
    // set-format works on the range, not on what is visible.
    const result = play(mixedFilterEastCurrencyChallenge, FILTER_EAST, CURRENCY_REVENUE);

    expect(result.isComplete).toBe(true);
    expect(result.correctness).toBe(1);
  });

  it("rejects a composite with no parts as a definition bug", () => {
    const broken: Challenge = {
      ...mixedSortAndBoldChallenge,
      validation: { kind: "composite", parts: [] },
    };

    const result = play(broken, SORT);

    expect(result.isComplete).toBe(false);
    expect(result.messages[0]?.text).toContain("bug");
  });
});

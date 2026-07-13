import { describe, expect, it } from "vitest";

import {
  filterEastRegionChallenge,
  formattingBoldHeaderChallenge,
  formattingCurrencyRevenueChallenge,
  navigationLastRevenueCellChallenge,
  sortRevenueHighToLowChallenge,
} from "@/data/challenges";
import type { Challenge } from "@/domain/challenges/challengeTypes";
import { gridReducer } from "@/domain/grid/gridReducer";
import type { GridAction, GridState } from "@/domain/grid/gridTypes";
import type { RunState } from "@/domain/runs/runTypes";
import { validateChallenge } from "@/domain/validation/validateChallenge";
import { REGION_COL, REP_COL, REVENUE_COL } from "@/test/fixtures/revenueGrid";

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

/** Drives the real reducer, so these grade the path a player actually takes. */
function play(challenge: Challenge, ...actions: GridAction[]) {
  const grid = actions.reduce<GridState>(gridReducer, challenge.initialGrid);

  return validateChallenge({ challenge, grid, run: runFor(challenge) });
}

describe("navigation", () => {
  const challenge = navigationLastRevenueCellChallenge;

  it("completes when the active cell lands on the target", () => {
    const result = play(challenge, { kind: "select-cell", cell: { row: 6, col: REVENUE_COL } });

    expect(result.isComplete).toBe(true);
    expect(result.correctness).toBe(1);
  });

  it("does not complete on the wrong cell", () => {
    const result = play(challenge, { kind: "select-cell", cell: { row: 5, col: REVENUE_COL } });

    expect(result.isComplete).toBe(false);
  });

  it("does not complete before the player has moved", () => {
    const result = play(challenge);

    expect(result.isComplete).toBe(false);
    expect(result.messages).toContainEqual({ kind: "info", text: "Nothing is selected yet." });
  });
});

describe("formatting", () => {
  const bold = formattingBoldHeaderChallenge;
  const currency = formattingCurrencyRevenueChallenge;

  it("completes when the whole header row is bolded", () => {
    const result = play(
      bold,
      { kind: "select-row", row: 0 },
      {
        kind: "set-format",
        range: { start: { row: 0, col: 0 }, end: { row: 0, col: 7 } },
        format: { bold: true },
      },
    );

    expect(result.isComplete).toBe(true);
  });

  it("gives partial credit, and does not complete, when only part of the row is bolded", () => {
    const result = play(bold, {
      kind: "set-format",
      range: { start: { row: 0, col: 0 }, end: { row: 0, col: 1 } },
      format: { bold: true },
    });

    expect(result.isComplete).toBe(false);
    expect(result.correctness).toBeGreaterThan(0);
    expect(result.correctness).toBeLessThan(1);
    expect(result.messages).toContainEqual({
      kind: "error",
      text: "Only part of the range is formatted.",
    });
  });

  it("completes when Revenue is set to currency", () => {
    const result = play(
      currency,
      { kind: "select-column", col: REVENUE_COL, usedRangeOnly: true },
      {
        kind: "set-format",
        range: { start: { row: 0, col: REVENUE_COL }, end: { row: 11, col: REVENUE_COL } },
        format: { numberFormat: "currency" },
      },
    );

    expect(result.isComplete).toBe(true);
  });

  it("does not punish formatting the player was never asked for", () => {
    // The challenge wants currency. Bolding the column on top of that should still count.
    const result = play(
      currency,
      {
        kind: "set-format",
        range: { start: { row: 0, col: REVENUE_COL }, end: { row: 11, col: REVENUE_COL } },
        format: { numberFormat: "currency" },
      },
      {
        kind: "set-format",
        range: { start: { row: 0, col: REVENUE_COL }, end: { row: 11, col: REVENUE_COL } },
        format: { bold: true },
      },
    );

    expect(result.isComplete).toBe(true);
  });

  it("does not complete when the wrong format is applied", () => {
    const result = play(currency, {
      kind: "set-format",
      range: { start: { row: 0, col: REVENUE_COL }, end: { row: 11, col: REVENUE_COL } },
      format: { numberFormat: "percent" },
    });

    expect(result.isComplete).toBe(false);
  });
});

describe("sort", () => {
  const challenge = sortRevenueHighToLowChallenge;

  it("completes when Revenue runs high to low", () => {
    const result = play(challenge, { kind: "sort-column", col: REVENUE_COL, direction: "desc" });

    expect(result.isComplete).toBe(true);
  });

  it("does not complete when the sort runs the wrong way", () => {
    const result = play(challenge, { kind: "sort-column", col: REVENUE_COL, direction: "asc" });

    expect(result.isComplete).toBe(false);
    expect(result.messages).toContainEqual({
      kind: "error",
      text: "The rows are not in the order the challenge asked for.",
    });
  });

  it("does not complete when the wrong column is sorted", () => {
    const result = play(challenge, { kind: "sort-column", col: REP_COL, direction: "desc" });

    expect(result.isComplete).toBe(false);
  });

  it("does not complete before anything has been sorted", () => {
    expect(play(challenge).isComplete).toBe(false);
  });

  it("lets a player sort the wrong way and then fix it", () => {
    const result = play(
      challenge,
      { kind: "sort-column", col: REVENUE_COL, direction: "asc" },
      { kind: "sort-column", col: REVENUE_COL, direction: "desc" },
    );

    expect(result.isComplete).toBe(true);
  });
});

describe("filter", () => {
  const challenge = filterEastRegionChallenge;

  it("completes when exactly the East rows are showing", () => {
    const result = play(challenge, {
      kind: "filter-column",
      col: REGION_COL,
      op: "equals",
      value: "East",
    });

    expect(result.isComplete).toBe(true);
  });

  it("does not complete when the wrong region is showing", () => {
    const result = play(challenge, {
      kind: "filter-column",
      col: REGION_COL,
      op: "equals",
      value: "West",
    });

    expect(result.isComplete).toBe(false);
    expect(result.messages).toContainEqual({ kind: "error", text: "The wrong rows are showing." });
  });

  it("does not complete while every row is still showing", () => {
    expect(play(challenge).isComplete).toBe(false);
  });

  it("lets a player clear a wrong filter and try again", () => {
    const result = play(
      challenge,
      { kind: "filter-column", col: REGION_COL, op: "equals", value: "West" },
      { kind: "clear-filters" },
      { kind: "filter-column", col: REGION_COL, op: "equals", value: "East" },
    );

    expect(result.isComplete).toBe(true);
  });
});

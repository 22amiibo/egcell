import { describe, expect, it } from "vitest";

import { selectionRevenueColumnChallenge } from "@/data/challenges/selectionRevenueColumn";
import type { Challenge } from "@/domain/challenges/challengeTypes";
import { gridReducer } from "@/domain/grid/gridReducer";
import type { GridAction, GridState } from "@/domain/grid/gridTypes";
import type { RunState } from "@/domain/runs/runTypes";
import { validateChallenge } from "@/domain/validation/validateChallenge";
import { selectionToRange } from "@/domain/validation/validateSelection";
import { createRevenueGrid } from "@/test/fixtures/revenueGrid";

const challenge: Challenge = selectionRevenueColumnChallenge;

function runFor(challengeUnderTest: Challenge): RunState {
  return {
    challengeId: challengeUnderTest.id,
    challengeVersion: challengeUnderTest.version,
    seed: challengeUnderTest.seed,
    mode: "main-speed",
    status: "running",
    startedAt: 0,
    finishedAt: null,
    elapsedMs: 0,
    events: [],
  };
}

function validateAfter(...actions: GridAction[]) {
  const grid = actions.reduce<GridState>(gridReducer, createRevenueGrid());

  return validateChallenge({ challenge, grid, run: runFor(challenge) });
}

describe("validateChallenge on a selection challenge", () => {
  it("completes when the Revenue column is selected within the used range", () => {
    const result = validateAfter({ kind: "select-column", col: 2, usedRangeOnly: true });

    expect(result.isComplete).toBe(true);
    expect(result.correctness).toBe(1);
    expect(result.completionPercent).toBe(1);
    expect(result.accuracy).toBe(1);
    expect(result.messages).toContainEqual({
      kind: "success",
      text: "Selection matches the target.",
    });
  });

  it("completes when the whole Revenue column is selected, not only the used range", () => {
    const result = validateAfter({ kind: "select-column", col: 2, usedRangeOnly: false });

    expect(result.isComplete).toBe(true);
    expect(result.correctness).toBe(1);
  });

  it("completes when the exact Revenue range is dragged out", () => {
    const result = validateAfter({
      kind: "select-range",
      range: { start: { row: 0, col: 2 }, end: { row: 6, col: 2 } },
    });

    expect(result.isComplete).toBe(true);
    expect(result.correctness).toBe(1);
  });

  it("completes when the exact Revenue range is dragged bottom-up", () => {
    const result = validateAfter({
      kind: "select-range",
      range: { start: { row: 6, col: 2 }, end: { row: 0, col: 2 } },
    });

    expect(result.isComplete).toBe(true);
  });

  it("does not complete when a different column is selected", () => {
    const result = validateAfter({ kind: "select-column", col: 3, usedRangeOnly: true });

    expect(result.isComplete).toBe(false);
    expect(result.correctness).toBe(0);
    expect(result.completionPercent).toBe(0);
    expect(result.messages).toContainEqual({
      kind: "error",
      text: "Selection does not match the target.",
    });
  });

  it("does not complete when the header cell is left out of the range", () => {
    const result = validateAfter({
      kind: "select-range",
      range: { start: { row: 1, col: 2 }, end: { row: 6, col: 2 } },
    });

    expect(result.isComplete).toBe(false);
    expect(result.correctness).toBe(0);
  });

  it("does not complete when only a single Revenue cell is selected", () => {
    const result = validateAfter({ kind: "select-cell", cell: { row: 3, col: 2 } });

    expect(result.isComplete).toBe(false);
  });

  it("does not complete when nothing is selected", () => {
    const result = validateChallenge({
      challenge,
      grid: createRevenueGrid(),
      run: runFor(challenge),
    });

    expect(result.isComplete).toBe(false);
    expect(result.correctness).toBe(0);
    expect(result.messages).toContainEqual({ kind: "info", text: "Nothing is selected yet." });
  });

  it("lets a player recover from a wrong selection", () => {
    const result = validateAfter(
      { kind: "select-column", col: 3, usedRangeOnly: true },
      { kind: "select-cell", cell: { row: 4, col: 0 } },
      { kind: "select-column", col: 2, usedRangeOnly: true },
    );

    expect(result.isComplete).toBe(true);
    expect(result.correctness).toBe(1);
  });

  it("reads the validation spec rather than the challenge id", () => {
    const relabelled: Challenge = { ...challenge, id: "some.other.challenge", version: "v9" };
    const grid = gridReducer(createRevenueGrid(), {
      kind: "select-column",
      col: 2,
      usedRangeOnly: true,
    });

    const result = validateChallenge({ challenge: relabelled, grid, run: runFor(relabelled) });

    expect(result.isComplete).toBe(true);
  });
});

describe("selectionToRange", () => {
  const spec = challenge.validation;

  it("returns null when nothing is selected", () => {
    expect(selectionToRange(createRevenueGrid(), { kind: "none" }, spec)).toBeNull();
  });

  it("turns a cell selection into a one-cell range", () => {
    expect(
      selectionToRange(createRevenueGrid(), { kind: "cell", cell: { row: 3, col: 2 } }, spec),
    ).toEqual({
      start: { row: 3, col: 2 },
      end: { row: 3, col: 2 },
    });
  });

  it("clips a row selection to the used range", () => {
    expect(selectionToRange(createRevenueGrid(), { kind: "row", row: 1 }, spec)).toEqual({
      start: { row: 1, col: 0 },
      end: { row: 1, col: 4 },
    });
  });

  it("clips a column selection to the used range when the spec asks for it", () => {
    expect(
      selectionToRange(createRevenueGrid(), { kind: "column", col: 2, usedRangeOnly: false }, spec),
    ).toEqual({
      start: { row: 0, col: 2 },
      end: { row: 6, col: 2 },
    });
  });

  it("spans the whole column when the spec does not require the used range", () => {
    const openSpec = { ...spec, requireEntireColumnWithinUsedRange: false };

    expect(
      selectionToRange(
        createRevenueGrid(),
        { kind: "column", col: 2, usedRangeOnly: false },
        openSpec,
      ),
    ).toEqual({
      start: { row: 0, col: 2 },
      end: { row: 11, col: 2 },
    });
  });
});

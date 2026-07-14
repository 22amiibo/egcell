import { describe, expect, it } from "vitest";

import {
  filterEastRegionChallenge,
  formattingBoldFirstDataRowChallenge,
  formattingBoldHeaderChallenge,
  formattingBoldRegionColumnChallenge,
  formattingCurrencyRevenueChallenge,
  formattingUnboldHeaderChallenge,
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

/**
 * The route solver found this hole: "Make the Region names bold" was solvable by selecting the whole
 * table and pressing Ctrl+B — two actions, *fewer* than doing it properly, and it graded as a pass.
 * With scoring keyed to action count, bolding the sheet was the winning play.
 *
 * The rule that closed it is a line, and a line has two sides. Both are pinned here: format past the
 * range's own column or row and the run fails; stay inside it — which is exactly what Ctrl+Space and
 * Shift+Space do — and it still passes. Only one of those halves is a bug fix. The other is every
 * player who was already doing it the fast, correct way.
 */
describe("formatting spill", () => {
  const region = formattingBoldRegionColumnChallenge;
  const header = formattingBoldHeaderChallenge;

  const WHOLE_SHEET = { start: { row: 0, col: 0 }, end: { row: 11, col: 7 } };
  const WHOLE_TABLE = { start: { row: 0, col: 0 }, end: { row: 6, col: 4 } };

  it("refuses the two-action exploit: bolding the whole table to bold one column", () => {
    const result = play(region, { kind: "set-format", range: WHOLE_TABLE, format: { bold: true } });

    expect(result.isComplete).toBe(false);
    expect(result.messages).toContainEqual({
      kind: "error",
      text: "That formatted more of the sheet than the challenge asked for.",
    });
  });

  it("refuses Ctrl+A across the whole sheet", () => {
    const result = play(region, { kind: "set-format", range: WHOLE_SHEET, format: { bold: true } });

    expect(result.isComplete).toBe(false);
  });

  it("still passes Ctrl+Space: the target column, its own header and blanks included", () => {
    // The spill tolerance exists for exactly this route. Column A holds the Region names (rows 1-6),
    // but Ctrl+Space takes A1 and the empty cells below the table too. That is not a player reaching
    // for more of the sheet — it is a player selecting the column they were asked to format.
    const result = play(region, {
      kind: "set-format",
      range: { start: { row: 0, col: REGION_COL }, end: { row: 11, col: REGION_COL } },
      format: { bold: true },
    });

    expect(result.isComplete).toBe(true);
    expect(result.correctness).toBe(1);
  });

  it("refuses Ctrl+A on a row challenge too, so neither axis is a way back in", () => {
    // The tolerance follows the range's own axis. A row range forgives its row; if it also forgave
    // every column the row crosses, Ctrl+A would walk straight back in through the other door.
    const result = play(header, { kind: "set-format", range: WHOLE_SHEET, format: { bold: true } });

    expect(result.isComplete).toBe(false);
  });

  it("does not fail a player for formatting the grid arrived with", () => {
    // This grid ships a bold header. The challenge is the row *below* it, so row 0 is outside the
    // tolerated band — and a player who bolds exactly what was asked must not be failed for bold
    // they never applied. Only formatting the player added counts against them.
    const result = play(formattingBoldFirstDataRowChallenge, {
      kind: "set-format",
      range: { start: { row: 1, col: 0 }, end: { row: 1, col: 4 } },
      format: { bold: true },
    });

    expect(result.isComplete).toBe(true);
  });

  it("still passes Shift+Space on the unbold challenge, where the grid row is wider than the table", () => {
    const result = play(formattingUnboldHeaderChallenge, {
      kind: "set-format",
      range: { start: { row: 0, col: 0 }, end: { row: 0, col: 7 } },
      format: { bold: false },
    });

    expect(result.isComplete).toBe(true);
  });

  // No shipped challenge targets a square range today, so this is the primitive being held to its
  // rule rather than a live route being defended. The tolerance forgives the axis a player must
  // sweep to select the target; a one-cell target has no such axis, and a rule of "the longer side
  // wins" would have handed it *both* — a plus shape through the sheet, nineteen cells forgiven for
  // a one-cell ask. The next person to write a single-cell formatting challenge should find this
  // decided, not discover it.
  const oneCell: Challenge = {
    ...region,
    validation: {
      kind: "formatting",
      range: { start: { row: 1, col: REGION_COL }, end: { row: 1, col: REGION_COL } },
      requiredFormat: { bold: true },
    },
  };

  it("gives a one-cell target no axis to forgive", () => {
    const result = play(oneCell, {
      kind: "set-format",
      range: { start: { row: 0, col: REGION_COL }, end: { row: 11, col: REGION_COL } },
      format: { bold: true },
    });

    expect(result.isComplete).toBe(false);
  });

  it("passes a one-cell target when exactly that cell is formatted", () => {
    const result = play(oneCell, {
      kind: "set-format",
      range: { start: { row: 1, col: REGION_COL }, end: { row: 1, col: REGION_COL } },
      format: { bold: true },
    });

    expect(result.isComplete).toBe(true);
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

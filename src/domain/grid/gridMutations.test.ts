import { describe, expect, it } from "vitest";

import { gridReducer } from "@/domain/grid/gridReducer";
import type { GridState } from "@/domain/grid/gridTypes";
import { getCell, visibleDataRows } from "@/domain/grid/selectors";
import {
  FIRST_DATA_ROW,
  LAST_DATA_ROW,
  REGION_COL,
  REP_COL,
  REVENUE_COL,
  createRevenueGrid,
} from "@/test/fixtures/revenueGrid";

function revenueAt(grid: GridState, row: number) {
  const value = getCell(grid, { row, col: REVENUE_COL })?.value;

  return value?.kind === "number" ? value.value : null;
}

function repAt(grid: GridState, row: number) {
  const value = getCell(grid, { row, col: REP_COL })?.value;

  return value?.kind === "text" ? value.value : null;
}

function revenueColumn(grid: GridState) {
  return visibleDataRows(grid).map((row) => revenueAt(grid, row));
}

describe("set-format", () => {
  it("merges into the format a cell already carries rather than replacing it", () => {
    const grid = createRevenueGrid({ boldHeaders: false });

    const next = gridReducer(grid, {
      kind: "set-format",
      range: {
        start: { row: FIRST_DATA_ROW, col: REVENUE_COL },
        end: { row: FIRST_DATA_ROW, col: REVENUE_COL },
      },
      format: { bold: true },
    });

    const cell = getCell(next, { row: FIRST_DATA_ROW, col: REVENUE_COL });

    expect(cell?.format.bold).toBe(true);
    // The currency format the grid shipped with must survive being bolded.
    expect(cell?.format.numberFormat).toBe("currency");
  });

  it("formats every cell in the range", () => {
    const grid = createRevenueGrid({ boldHeaders: false });

    const next = gridReducer(grid, {
      kind: "set-format",
      range: { start: { row: 0, col: 0 }, end: { row: 0, col: 4 } },
      format: { bold: true },
    });

    for (let col = 0; col <= 4; col += 1) {
      expect(getCell(next, { row: 0, col })?.format.bold).toBe(true);
    }
  });

  it("formats a blank cell by creating it", () => {
    const next = gridReducer(createRevenueGrid(), {
      kind: "set-format",
      range: { start: { row: 9, col: 7 }, end: { row: 9, col: 7 } },
      format: { bold: true },
    });

    expect(getCell(next, { row: 9, col: 7 })).toEqual({
      address: { row: 9, col: 7 },
      value: { kind: "blank" },
      format: { bold: true },
    });
  });

  it("does not mutate the grid it was given", () => {
    const grid = createRevenueGrid({ boldHeaders: false });
    const before = structuredClone(grid);

    gridReducer(grid, {
      kind: "set-format",
      range: { start: { row: 0, col: 0 }, end: { row: 0, col: 4 } },
      format: { bold: true },
    });

    expect(grid).toEqual(before);
  });
});

describe("sort-column", () => {
  it("orders the data rows low to high", () => {
    const next = gridReducer(createRevenueGrid(), {
      kind: "sort-column",
      col: REVENUE_COL,
      direction: "asc",
    });

    expect(revenueColumn(next)).toEqual([72100, 88300, 94250, 128400, 143750, 156900]);
  });

  it("orders the data rows high to low", () => {
    const next = gridReducer(createRevenueGrid(), {
      kind: "sort-column",
      col: REVENUE_COL,
      direction: "desc",
    });

    expect(revenueColumn(next)).toEqual([156900, 143750, 128400, 94250, 88300, 72100]);
  });

  it("moves the whole row, not just the sorted column", () => {
    const next = gridReducer(createRevenueGrid(), {
      kind: "sort-column",
      col: REVENUE_COL,
      direction: "desc",
    });

    // Chidi holds the top revenue. If only the numbers moved, the reps would still sit in their
    // original order and the table would be quietly, catastrophically wrong.
    expect(revenueAt(next, FIRST_DATA_ROW)).toBe(156900);
    expect(repAt(next, FIRST_DATA_ROW)).toBe("Chidi");
  });

  it("leaves the header row alone", () => {
    const next = gridReducer(createRevenueGrid(), {
      kind: "sort-column",
      col: REVENUE_COL,
      direction: "asc",
    });

    expect(getCell(next, { row: 0, col: REVENUE_COL })?.value).toEqual({
      kind: "text",
      value: "Revenue",
    });
  });

  it("sorts text lexicographically", () => {
    const next = gridReducer(createRevenueGrid(), {
      kind: "sort-column",
      col: REP_COL,
      direction: "asc",
    });

    expect(visibleDataRows(next).map((row) => repAt(next, row))).toEqual([
      "Alice",
      "Bruno",
      "Chidi",
      "Dara",
      "Eli",
      "Farah",
    ]);
  });

  it("records what it sorted by", () => {
    const next = gridReducer(createRevenueGrid(), {
      kind: "sort-column",
      col: REVENUE_COL,
      direction: "desc",
    });

    expect(next.sortState).toEqual({ col: REVENUE_COL, direction: "desc" });
  });

  it("does not mutate the grid it was given", () => {
    const grid = createRevenueGrid();
    const before = structuredClone(grid);

    gridReducer(grid, { kind: "sort-column", col: REVENUE_COL, direction: "desc" });

    expect(grid).toEqual(before);
  });
});

describe("filter-column", () => {
  it("hides the rows that do not match", () => {
    const next = gridReducer(createRevenueGrid(), {
      kind: "filter-column",
      col: REGION_COL,
      op: "equals",
      value: "East",
    });

    const regions = visibleDataRows(next).map(
      (row) => getCell(next, { row, col: REGION_COL })?.value,
    );

    expect(regions).toEqual([
      { kind: "text", value: "East" },
      { kind: "text", value: "East" },
    ]);
  });

  it("never hides the header", () => {
    const next = gridReducer(createRevenueGrid(), {
      kind: "filter-column",
      col: REGION_COL,
      op: "equals",
      value: "East",
    });

    expect(next.hiddenRows).not.toContain(0);
  });

  it("replaces an earlier filter on the same column rather than stacking on top of it", () => {
    const east = gridReducer(createRevenueGrid(), {
      kind: "filter-column",
      col: REGION_COL,
      op: "equals",
      value: "East",
    });

    const west = gridReducer(east, {
      kind: "filter-column",
      col: REGION_COL,
      op: "equals",
      value: "West",
    });

    expect(west.filters).toHaveLength(1);
    expect(visibleDataRows(west)).toHaveLength(2);
  });

  it("filters numbers by threshold", () => {
    const next = gridReducer(createRevenueGrid(), {
      kind: "filter-column",
      col: REVENUE_COL,
      op: "greater-than",
      value: 100000,
    });

    expect(revenueColumn(next)).toEqual([128400, 156900, 143750]);
  });

  it("survives a later sort, keeping the same rows visible", () => {
    const filtered = gridReducer(createRevenueGrid(), {
      kind: "filter-column",
      col: REGION_COL,
      op: "equals",
      value: "East",
    });

    const sorted = gridReducer(filtered, {
      kind: "sort-column",
      col: REVENUE_COL,
      direction: "desc",
    });

    // Sorting moves values between rows, so the hidden-row list has to be recomputed or the wrong
    // rows would vanish.
    const regions = visibleDataRows(sorted).map(
      (row) => getCell(sorted, { row, col: REGION_COL })?.value,
    );

    expect(regions).toEqual([
      { kind: "text", value: "East" },
      { kind: "text", value: "East" },
    ]);
    expect(revenueColumn(sorted)).toEqual([143750, 128400]);
  });
});

describe("clear-filters", () => {
  it("brings every row back", () => {
    const filtered = gridReducer(createRevenueGrid(), {
      kind: "filter-column",
      col: REGION_COL,
      op: "equals",
      value: "East",
    });

    const cleared = gridReducer(filtered, { kind: "clear-filters" });

    expect(cleared.filters).toEqual([]);
    expect(cleared.hiddenRows).toEqual([]);
    expect(visibleDataRows(cleared)).toHaveLength(LAST_DATA_ROW - FIRST_DATA_ROW + 1);
  });

  it("changes nothing when there is no filter to clear", () => {
    const grid = createRevenueGrid();

    expect(gridReducer(grid, { kind: "clear-filters" })).toBe(grid);
  });
});

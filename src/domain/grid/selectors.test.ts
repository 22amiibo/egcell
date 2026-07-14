import { describe, expect, it } from "vitest";

import { gridReducer } from "@/domain/grid/gridReducer";
import {
  columnRangeWithinUsedRange,
  getCell,
  isCellSelected,
  renderedRows,
  rowRangeWithinUsedRange,
  selectionBounds,
  visibleDataRows,
} from "@/domain/grid/selectors";
import { createRevenueGrid } from "@/test/fixtures/revenueGrid";

describe("getCell", () => {
  it("reads the Revenue header cell", () => {
    const grid = createRevenueGrid();

    expect(getCell(grid, { row: 0, col: 2 })?.value).toEqual({ kind: "text", value: "Revenue" });
  });

  it("reads a Revenue data cell as a number", () => {
    const grid = createRevenueGrid();

    expect(getCell(grid, { row: 1, col: 2 })?.value.kind).toBe("number");
  });

  it("returns undefined for an address with no cell", () => {
    const grid = createRevenueGrid();

    expect(getCell(grid, { row: 99, col: 99 })).toBeUndefined();
  });
});

describe("columnRangeWithinUsedRange", () => {
  it("clips a column to the used range rows", () => {
    const grid = createRevenueGrid();

    expect(columnRangeWithinUsedRange(grid, 2)).toEqual({
      start: { row: 0, col: 2 },
      end: { row: 6, col: 2 },
    });
  });

  it("returns null for a column outside the used range", () => {
    const grid = createRevenueGrid();

    expect(columnRangeWithinUsedRange(grid, 7)).toBeNull();
  });
});

describe("rowRangeWithinUsedRange", () => {
  it("clips a row to the used range columns", () => {
    const grid = createRevenueGrid();

    expect(rowRangeWithinUsedRange(grid, 1)).toEqual({
      start: { row: 1, col: 0 },
      end: { row: 1, col: 4 },
    });
  });

  it("returns null for a row outside the used range", () => {
    const grid = createRevenueGrid();

    expect(rowRangeWithinUsedRange(grid, 9)).toBeNull();
  });
});

describe("selectionBounds", () => {
  it("is null when nothing is selected", () => {
    expect(selectionBounds(createRevenueGrid())).toBeNull();
  });

  it("paints the whole column, past the data, when a column is selected", () => {
    const grid = gridReducer(createRevenueGrid(), {
      kind: "select-column",
      col: 2,
      usedRangeOnly: true,
    });

    expect(selectionBounds(grid)).toEqual({
      start: { row: 0, col: 2 },
      end: { row: 11, col: 2 },
    });
  });

  it("paints the whole row when a row is selected", () => {
    const grid = gridReducer(createRevenueGrid(), { kind: "select-row", row: 3 });

    expect(selectionBounds(grid)).toEqual({
      start: { row: 3, col: 0 },
      end: { row: 3, col: 7 },
    });
  });

  it("normalizes an inverted range", () => {
    const grid = gridReducer(createRevenueGrid(), {
      kind: "select-range",
      range: { start: { row: 4, col: 3 }, end: { row: 2, col: 1 } },
    });

    expect(selectionBounds(grid)).toEqual({
      start: { row: 2, col: 1 },
      end: { row: 4, col: 3 },
    });
  });
});

describe("isCellSelected", () => {
  it("covers every cell of a selected column, including below the data", () => {
    const grid = gridReducer(createRevenueGrid(), {
      kind: "select-column",
      col: 2,
      usedRangeOnly: true,
    });

    expect(isCellSelected(grid, { row: 0, col: 2 })).toBe(true);
    expect(isCellSelected(grid, { row: 11, col: 2 })).toBe(true);
    expect(isCellSelected(grid, { row: 3, col: 1 })).toBe(false);
  });

  it("is false everywhere when nothing is selected", () => {
    expect(isCellSelected(createRevenueGrid(), { row: 0, col: 0 })).toBe(false);
  });
});

describe("renderedRows, once a filter is on", () => {
  // The revenue grid is 12 rows on an 8-column sheet, but the table only occupies rows 0-6. Rows
  // 7-11 are the empty sheet below it — and they are what made a filtered-to-nothing grid look
  // broken: they are not data, so no filter ever hides them, and they sat there under the header
  // looking exactly like rows the filter had returned.
  it("draws the empty sheet below the table when no filter is on", () => {
    expect(renderedRows(createRevenueGrid())).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("stops at the end of the table once a filter is on", () => {
    const filtered = gridReducer(createRevenueGrid(), {
      kind: "filter-column",
      col: 0,
      op: "equals",
      value: "East",
    });

    expect(visibleDataRows(filtered).length).toBeGreaterThan(0);
    expect(renderedRows(filtered).every((row) => row <= 6)).toBe(true);
  });

  it("draws the header and nothing else when a filter matches no rows", () => {
    // The screenshot state: every data row hidden, and the blank tail rows left behind pretending to
    // be the result. The header survives — the player must still be able to reach the filter menu on
    // it — and there is nothing under it to misread.
    const empty = gridReducer(createRevenueGrid(), {
      kind: "filter-column",
      col: 0,
      op: "equals",
      value: "Atlantis",
    });

    expect(visibleDataRows(empty)).toEqual([]);
    expect(renderedRows(empty)).toEqual([0]);
  });

  it("brings the whole sheet back when the filter is cleared", () => {
    const empty = gridReducer(createRevenueGrid(), {
      kind: "filter-column",
      col: 0,
      op: "equals",
      value: "Atlantis",
    });
    const cleared = gridReducer(empty, { kind: "clear-filters" });

    expect(renderedRows(cleared)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });
});

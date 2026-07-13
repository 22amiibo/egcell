import { describe, expect, it } from "vitest";

import { gridReducer } from "@/domain/grid/gridReducer";
import { createRevenueGrid } from "@/test/fixtures/revenueGrid";

describe("gridReducer", () => {
  it("selects a cell and makes it active", () => {
    const next = gridReducer(createRevenueGrid(), {
      kind: "select-cell",
      cell: { row: 3, col: 2 },
    });

    expect(next.selection).toEqual({ kind: "cell", cell: { row: 3, col: 2 } });
    expect(next.activeCell).toEqual({ row: 3, col: 2 });
  });

  it("normalizes an inverted range selection", () => {
    const next = gridReducer(createRevenueGrid(), {
      kind: "select-range",
      range: { start: { row: 6, col: 2 }, end: { row: 0, col: 2 } },
    });

    expect(next.selection).toEqual({
      kind: "range",
      range: { start: { row: 0, col: 2 }, end: { row: 6, col: 2 } },
    });
  });

  it("puts the active cell at the top-left of a range selection", () => {
    const next = gridReducer(createRevenueGrid(), {
      kind: "select-range",
      range: { start: { row: 4, col: 3 }, end: { row: 1, col: 1 } },
    });

    expect(next.activeCell).toEqual({ row: 1, col: 1 });
  });

  it("selects a row and puts the active cell in its first column", () => {
    const next = gridReducer(createRevenueGrid(), { kind: "select-row", row: 2 });

    expect(next.selection).toEqual({ kind: "row", row: 2 });
    expect(next.activeCell).toEqual({ row: 2, col: 0 });
  });

  it("selects a column and puts the active cell in its first row", () => {
    const next = gridReducer(createRevenueGrid(), {
      kind: "select-column",
      col: 2,
      usedRangeOnly: true,
    });

    expect(next.selection).toEqual({ kind: "column", col: 2, usedRangeOnly: true });
    expect(next.activeCell).toEqual({ row: 0, col: 2 });
  });

  it("keeps the usedRangeOnly flag the action carried", () => {
    const next = gridReducer(createRevenueGrid(), {
      kind: "select-column",
      col: 2,
      usedRangeOnly: false,
    });

    expect(next.selection).toEqual({ kind: "column", col: 2, usedRangeOnly: false });
  });

  it("ignores a cell selection outside the grid", () => {
    const grid = createRevenueGrid();

    expect(gridReducer(grid, { kind: "select-cell", cell: { row: 99, col: 0 } })).toBe(grid);
    expect(gridReducer(grid, { kind: "select-cell", cell: { row: 0, col: -1 } })).toBe(grid);
  });

  it("ignores a column selection outside the grid", () => {
    const grid = createRevenueGrid();

    expect(gridReducer(grid, { kind: "select-column", col: 99, usedRangeOnly: true })).toBe(grid);
  });

  it("ignores a row selection outside the grid", () => {
    const grid = createRevenueGrid();

    expect(gridReducer(grid, { kind: "select-row", row: 99 })).toBe(grid);
  });

  it("returns a new object rather than mutating the previous state", () => {
    const grid = createRevenueGrid();
    const before = structuredClone(grid);

    const next = gridReducer(grid, { kind: "select-column", col: 2, usedRangeOnly: true });

    expect(next).not.toBe(grid);
    expect(grid).toEqual(before);
  });

  it("leaves cells, sort state, and filters untouched", () => {
    const grid = createRevenueGrid();

    const next = gridReducer(grid, { kind: "select-column", col: 2, usedRangeOnly: true });

    expect(next.cells).toBe(grid.cells);
    expect(next.sortState).toBeNull();
    expect(next.filters).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";

import { gridReducer } from "@/domain/grid/gridReducer";
import { cellKey } from "@/domain/grid/range";
import { createRevenueGrid, HEADER_ROW, LAST_DATA_ROW, REGION_COL } from "@/test/fixtures/revenueGrid";

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

describe("set-cell-value", () => {
  const grid = createRevenueGrid();

  it("writes the value, moves the active cell there, and selects it", () => {
    const next = gridReducer(grid, {
      kind: "set-cell-value",
      cell: { row: 3, col: 2 },
      value: { kind: "number", value: 42 },
    });

    expect(next.cells[cellKey({ row: 3, col: 2 })].value).toEqual({ kind: "number", value: 42 });
    expect(next.activeCell).toEqual({ row: 3, col: 2 });
    expect(next.selection).toEqual({ kind: "cell", cell: { row: 3, col: 2 } });
  });

  it("keeps the cell's existing format", () => {
    // The header row is bold by default (createRevenueGrid's boldHeaders option), so overwriting a
    // header's value is the fixture's existing way to seed a bold cell without a set-format action.
    const next = gridReducer(grid, {
      kind: "set-cell-value",
      cell: { row: HEADER_ROW, col: REGION_COL },
      value: { kind: "text", value: "Central" },
    });

    const cell = next.cells[cellKey({ row: HEADER_ROW, col: REGION_COL })];

    expect(cell.value).toEqual({ kind: "text", value: "Central" });
    expect(cell.format.bold).toBe(true);
  });

  it("returns the same object when the value is unchanged", () => {
    const action = {
      kind: "set-cell-value",
      cell: { row: 3, col: 2 },
      value: { kind: "number", value: 42 },
    } as const;
    const once = gridReducer(grid, action);

    expect(gridReducer(once, action)).toBe(once);
  });

  it("ignores a cell outside the grid", () => {
    expect(
      gridReducer(grid, {
        kind: "set-cell-value",
        cell: { row: grid.rowCount, col: 0 },
        value: { kind: "text", value: "x" },
      }),
    ).toBe(grid);
  });

  it("expands the used range to cover a write below it", () => {
    // One row below the fixture's usedRange.end.row (LAST_DATA_ROW): the write should grow the
    // range to reach it rather than leaving the new cell outside what the grid reports as used.
    const next = gridReducer(grid, {
      kind: "set-cell-value",
      cell: { row: LAST_DATA_ROW + 1, col: 0 },
      value: { kind: "text", value: "New" },
    });

    expect(next.usedRange.end.row).toBe(LAST_DATA_ROW + 1);
  });
});

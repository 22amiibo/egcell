import { describe, expect, it } from "vitest";

import { jumpActive, stepActive } from "@/domain/grid/keyboardNav";
import type { GridState } from "@/domain/grid/gridTypes";
import { cellKey } from "@/domain/grid/range";
import {
  LAST_DATA_ROW,
  LAST_USED_COL,
  REVENUE_COL,
  createRevenueGrid,
} from "@/test/fixtures/revenueGrid";

/** One column of data with a gap: rows 0-1 filled, row 2 blank, rows 3-4 filled, rows 5-7 blank. */
function gappedColumnGrid(): GridState {
  const cells: GridState["cells"] = {};

  for (const row of [0, 1, 3, 4]) {
    cells[cellKey({ row, col: 0 })] = {
      address: { row, col: 0 },
      value: { kind: "number", value: row },
      format: {},
    };
  }

  return {
    rowCount: 8,
    colCount: 1,
    usedRange: { start: { row: 0, col: 0 }, end: { row: 4, col: 0 } },
    headerRows: 0,
    columns: ["A"],
    rows: Array.from({ length: 8 }, (_, row) => row + 1),
    cells,
    activeCell: { row: 0, col: 0 },
    selection: { kind: "none" },
    hiddenRows: [],
    sortState: null,
    filters: [],
  };
}

describe("stepActive", () => {
  it("moves one cell in each direction", () => {
    const grid = createRevenueGrid();

    expect(stepActive(grid, { row: 2, col: 2 }, "down")).toEqual({ row: 3, col: 2 });
    expect(stepActive(grid, { row: 2, col: 2 }, "up")).toEqual({ row: 1, col: 2 });
    expect(stepActive(grid, { row: 2, col: 2 }, "left")).toEqual({ row: 2, col: 1 });
    expect(stepActive(grid, { row: 2, col: 2 }, "right")).toEqual({ row: 2, col: 3 });
  });

  it("clamps at the grid edges", () => {
    const grid = createRevenueGrid();

    expect(stepActive(grid, { row: 0, col: 0 }, "up")).toEqual({ row: 0, col: 0 });
    expect(stepActive(grid, { row: 0, col: 0 }, "left")).toEqual({ row: 0, col: 0 });
    expect(stepActive(grid, { row: grid.rowCount - 1, col: 0 }, "down")).toEqual({
      row: grid.rowCount - 1,
      col: 0,
    });
    expect(stepActive(grid, { row: 0, col: grid.colCount - 1 }, "right")).toEqual({
      row: 0,
      col: grid.colCount - 1,
    });
  });

  it("skips rows a filter has hidden", () => {
    const grid = { ...createRevenueGrid(), hiddenRows: [2, 3] };

    expect(stepActive(grid, { row: 1, col: 0 }, "down")).toEqual({ row: 4, col: 0 });
    expect(stepActive(grid, { row: 4, col: 0 }, "up")).toEqual({ row: 1, col: 0 });
  });

  it("recovers when the active cell's own row has been hidden", () => {
    const grid = { ...createRevenueGrid(), hiddenRows: [3] };

    expect(stepActive(grid, { row: 3, col: 1 }, "down")).toEqual({ row: 4, col: 1 });
    expect(stepActive(grid, { row: 3, col: 1 }, "up")).toEqual({ row: 2, col: 1 });
  });
});

describe("jumpActive", () => {
  it("rides a run of data to its last cell", () => {
    const grid = createRevenueGrid();

    // From the Revenue header, straight to the last Revenue figure.
    expect(jumpActive(grid, { row: 0, col: REVENUE_COL }, "down")).toEqual({
      row: LAST_DATA_ROW,
      col: REVENUE_COL,
    });

    // Across the header run: A1 holds data through E1.
    expect(jumpActive(grid, { row: 0, col: 0 }, "right")).toEqual({ row: 0, col: LAST_USED_COL });
  });

  it("goes to the grid edge when only blanks remain", () => {
    const grid = createRevenueGrid();

    expect(jumpActive(grid, { row: LAST_DATA_ROW, col: REVENUE_COL }, "down")).toEqual({
      row: grid.rowCount - 1,
      col: REVENUE_COL,
    });
    expect(jumpActive(grid, { row: 0, col: LAST_USED_COL }, "right")).toEqual({
      row: 0,
      col: grid.colCount - 1,
    });
  });

  it("comes back from the blank region to the nearest data cell", () => {
    const grid = createRevenueGrid();

    expect(jumpActive(grid, { row: grid.rowCount - 1, col: REVENUE_COL }, "up")).toEqual({
      row: LAST_DATA_ROW,
      col: REVENUE_COL,
    });
    expect(jumpActive(grid, { row: 0, col: grid.colCount - 1 }, "left")).toEqual({
      row: 0,
      col: LAST_USED_COL,
    });
  });

  it("stops at the end of a data run, then crosses the gap on the next jump", () => {
    const grid = gappedColumnGrid();

    const firstStop = jumpActive(grid, { row: 0, col: 0 }, "down");
    expect(firstStop).toEqual({ row: 1, col: 0 });

    const secondStop = jumpActive(grid, firstStop, "down");
    expect(secondStop).toEqual({ row: 3, col: 0 });

    const thirdStop = jumpActive(grid, secondStop, "down");
    expect(thirdStop).toEqual({ row: 4, col: 0 });

    const fourthStop = jumpActive(grid, thirdStop, "down");
    expect(fourthStop).toEqual({ row: 7, col: 0 });
  });

  it("stays put when already pressed against the edge", () => {
    const grid = createRevenueGrid();

    expect(jumpActive(grid, { row: 0, col: 0 }, "up")).toEqual({ row: 0, col: 0 });
    expect(jumpActive(grid, { row: 0, col: 0 }, "left")).toEqual({ row: 0, col: 0 });
  });

  it("jumps across the visible rows only, once a filter hides some", () => {
    const grid = { ...createRevenueGrid(), hiddenRows: [3, 4] };

    // Rows 3 and 4 are gone from the screen, so the visible Revenue data runs 1, 2, 5, 6.
    expect(jumpActive(grid, { row: 1, col: REVENUE_COL }, "down")).toEqual({
      row: LAST_DATA_ROW,
      col: REVENUE_COL,
    });
  });
});

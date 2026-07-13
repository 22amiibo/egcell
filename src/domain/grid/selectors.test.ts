import { describe, expect, it } from "vitest";

import {
  columnRangeWithinUsedRange,
  getCell,
  rowRangeWithinUsedRange,
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

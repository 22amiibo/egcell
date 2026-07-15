import { describe, expect, it } from "vitest";

import { evaluateFormula, formatA1, parseA1 } from "@/domain/grid/formulaEval";
import type { GridCell, GridState } from "@/domain/grid/gridTypes";
import { cellKey, columnLabel } from "@/domain/grid/range";

const ROW_COUNT = 10;
const COL_COUNT = 10;

/** A small grid fixture: numbers 10, 20, 30 in B2:B4, text in B5. */
function buildGrid(): GridState {
  const cells: Record<string, GridCell> = {};

  const addCell = (row: number, col: number, value: GridCell["value"]) => {
    cells[cellKey({ row, col })] = { address: { row, col }, value, format: {} };
  };

  addCell(1, 1, { kind: "number", value: 10 }); // B2
  addCell(2, 1, { kind: "number", value: 20 }); // B3
  addCell(3, 1, { kind: "number", value: 30 }); // B4
  addCell(4, 1, { kind: "text", value: "total" }); // B5

  return {
    rowCount: ROW_COUNT,
    colCount: COL_COUNT,
    usedRange: { start: { row: 0, col: 0 }, end: { row: 4, col: 1 } },
    headerRows: 0,
    columns: Array.from({ length: COL_COUNT }, (_, col) => columnLabel(col)),
    rows: Array.from({ length: ROW_COUNT }, (_, row) => row + 1),
    cells,
    activeCell: { row: 0, col: 0 },
    selection: { kind: "none" },
    hiddenRows: [],
    sortState: null,
    filters: [],
  };
}

const grid = buildGrid();

describe("A1 notation", () => {
  it("round-trips addresses", () => {
    expect(parseA1("A1")).toEqual({ row: 0, col: 0 });
    expect(parseA1("B7")).toEqual({ row: 6, col: 1 });
    expect(parseA1("AA3")).toEqual({ row: 2, col: 26 });
    expect(formatA1({ row: 6, col: 1 })).toBe("B7");
  });

  it("rejects junk", () => {
    expect(parseA1("7B")).toBeNull();
    expect(parseA1("")).toBeNull();
  });
});

describe("evaluateFormula", () => {
  it("sums a range, skipping text and blanks like Excel", () => {
    expect(evaluateFormula(grid, "=SUM(B2:B5)")).toEqual({ kind: "number", value: 60 });
  });

  it("averages, counts, mins, maxes", () => {
    expect(evaluateFormula(grid, "=AVERAGE(B2:B4)")).toEqual({ kind: "number", value: 20 });
    expect(evaluateFormula(grid, "=COUNT(B2:B5)")).toEqual({ kind: "number", value: 3 });
    expect(evaluateFormula(grid, "=MIN(B2:B4)")).toEqual({ kind: "number", value: 10 });
    expect(evaluateFormula(grid, "=MAX(B2:B4)")).toEqual({ kind: "number", value: 30 });
  });

  it("resolves a bare cell reference", () => {
    expect(evaluateFormula(grid, "=B3")).toEqual({ kind: "number", value: 20 });
  });

  it("is case- and whitespace-insensitive", () => {
    expect(evaluateFormula(grid, "= sum( b2 : b4 )")).toEqual({ kind: "number", value: 60 });
  });

  it("errors honestly", () => {
    expect(evaluateFormula(grid, "=NOPE(B2:B4)")).toEqual({ kind: "text", value: "#NAME?" });
    expect(evaluateFormula(grid, "=SUM(ZZ90:ZZ99)")).toEqual({ kind: "text", value: "#REF!" });
  });
});

import { describe, expect, it } from "vitest";

import { EDIT_IDLE, editInput, parseCellInput, startEdit } from "@/domain/grid/editing";
import { createRevenueGrid } from "@/test/fixtures/revenueGrid";
import type { GridCell, GridState } from "@/domain/grid/gridTypes";
import { cellKey, columnLabel } from "@/domain/grid/range";

const grid = createRevenueGrid();

/** A small grid fixture: numbers 10, 20, 30 in B2:B4, text in B5. */
function buildSimpleGrid(): GridState {
  const cells: Record<string, GridCell> = {};

  const addCell = (row: number, col: number, value: GridCell["value"]) => {
    cells[cellKey({ row, col })] = { address: { row, col }, value, format: {} };
  };

  addCell(1, 1, { kind: "number", value: 10 }); // B2
  addCell(2, 1, { kind: "number", value: 20 }); // B3
  addCell(3, 1, { kind: "number", value: 30 }); // B4
  addCell(4, 1, { kind: "text", value: "total" }); // B5

  const ROW_COUNT = 10;
  const COL_COUNT = 10;

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

const simpleGrid = buildSimpleGrid();

describe("edit state machine", () => {
  it("starts editing with an optional seed character", () => {
    const state1 = startEdit({ row: 1, col: 1 });
    expect(state1).toEqual({
      mode: "editing",
      cell: { row: 1, col: 1 },
      buffer: "",
      chars: 0,
      corrections: 0,
    });
    const state2 = startEdit({ row: 1, col: 1 }, "h");
    if (state2.mode === "editing") {
      expect(state2.chars).toBe(1);
    }
  });

  it("counts typed characters as the buffer grows", () => {
    let state = startEdit({ row: 0, col: 0 });
    state = editInput(state, "h");
    state = editInput(state, "he");

    expect(state).toMatchObject({ buffer: "he", chars: 2, corrections: 0 });
  });

  it("counts removed characters as corrections", () => {
    let state = startEdit({ row: 0, col: 0 }, "hw");
    state = editInput(state, "h");
    state = editInput(state, "he");

    expect(state).toMatchObject({ buffer: "he", chars: 3, corrections: 1 });
  });

  it("counts a paste as its length in characters", () => {
    const state = editInput(startEdit({ row: 0, col: 0 }), "hello world");

    expect(state).toMatchObject({ chars: 11, corrections: 0 });
  });

  it("editInput on idle is a no-op", () => {
    expect(editInput(EDIT_IDLE, "x")).toBe(EDIT_IDLE);
  });
});

describe("parseCellInput", () => {
  it("parses numbers", () => {
    expect(parseCellInput("42", grid)).toEqual({ kind: "number", value: 42 });
    expect(parseCellInput("-3.5", grid)).toEqual({ kind: "number", value: -3.5 });
  });

  it("keeps text as text", () => {
    expect(parseCellInput("West", grid)).toEqual({ kind: "text", value: "West" });
    expect(parseCellInput("3 units", grid)).toEqual({ kind: "text", value: "3 units" });
  });

  it("parses the empty buffer as blank", () => {
    expect(parseCellInput("  ", grid)).toEqual({ kind: "blank" });
  });

  it("parses a formula and computes it against the grid", () => {
    expect(parseCellInput("=SUM(B2:B4)", simpleGrid)).toEqual({
      kind: "formula",
      formula: "=SUM(B2:B4)",
      computed: { kind: "number", value: 60 },
    });
  });

  it("keeps a broken formula as a formula with an error value", () => {
    expect(parseCellInput("=NOPE(B2)", simpleGrid)).toEqual({
      kind: "formula",
      formula: "=NOPE(B2)",
      computed: { kind: "text", value: "#NAME?" },
    });
  });
});

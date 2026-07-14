import { describe, expect, it } from "vitest";

import { EDIT_IDLE, editInput, parseCellInput, startEdit } from "@/domain/grid/editing";
import { createRevenueGrid } from "@/test/fixtures/revenueGrid";

const grid = createRevenueGrid();

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
});

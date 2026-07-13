import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SpreadsheetGrid } from "@/components/grid/SpreadsheetGrid";
import type { ActionMeta, GridCommandId } from "@/domain/commands/commandTypes";
import type { GridAction, GridState } from "@/domain/grid/gridTypes";
import { createRevenueGrid } from "@/test/fixtures/revenueGrid";

function renderGrid(grid: GridState, allowedActions?: GridAction["kind"][]) {
  const onAction = vi.fn<(action: GridAction, meta: ActionMeta) => void>();

  render(<SpreadsheetGrid grid={grid} onAction={onAction} allowedActions={allowedActions} />);

  return { onAction, container: screen.getByRole("grid") };
}

/** Every keyboard-originated call carries this shape; only `command` and `chord` vary. */
function keyboardMeta(command: GridCommandId, chord: string): ActionMeta {
  return { command, inputMethod: "keyboard", via: "shortcut", chord, controlId: null };
}

describe("keyboard movement", () => {
  it("moves the active cell with a plain arrow", () => {
    const { onAction, container } = renderGrid(createRevenueGrid());

    fireEvent.keyDown(container, { key: "ArrowDown" });

    expect(onAction).toHaveBeenCalledWith(
      { kind: "select-cell", cell: { row: 1, col: 0 } },
      keyboardMeta("MOVE_DOWN", "ArrowDown"),
    );
  });

  it("keeps moving from where the last keystroke landed", () => {
    const { onAction, container } = renderGrid(createRevenueGrid());

    fireEvent.keyDown(container, { key: "ArrowDown" });
    fireEvent.keyDown(container, { key: "ArrowRight" });

    expect(onAction).toHaveBeenLastCalledWith(
      { kind: "select-cell", cell: { row: 1, col: 1 } },
      keyboardMeta("MOVE_RIGHT", "ArrowRight"),
    );
  });

  it("jumps to the edge of the data region with a modifier held", () => {
    const grid = { ...createRevenueGrid(), activeCell: { row: 0, col: 2 } };
    const { onAction, container } = renderGrid(grid);

    fireEvent.keyDown(container, { key: "ArrowDown", metaKey: true });

    expect(onAction).toHaveBeenCalledWith(
      { kind: "select-cell", cell: { row: 6, col: 2 } },
      keyboardMeta("JUMP_DOWN", "mod+ArrowDown"),
    );
  });

  it("accepts Ctrl as the jump modifier too", () => {
    const grid = { ...createRevenueGrid(), activeCell: { row: 0, col: 2 } };
    const { onAction, container } = renderGrid(grid);

    fireEvent.keyDown(container, { key: "ArrowDown", ctrlKey: true });

    expect(onAction).toHaveBeenCalledWith(
      { kind: "select-cell", cell: { row: 6, col: 2 } },
      keyboardMeta("JUMP_DOWN", "mod+ArrowDown"),
    );
  });
});

describe("keyboard selection", () => {
  it("extends a range with Shift+Arrow, anchored where the selection began", () => {
    const { onAction, container } = renderGrid(createRevenueGrid());

    fireEvent.keyDown(container, { key: "ArrowDown", shiftKey: true });
    fireEvent.keyDown(container, { key: "ArrowRight", shiftKey: true });

    expect(onAction).toHaveBeenNthCalledWith(
      1,
      {
        kind: "select-range",
        range: { start: { row: 0, col: 0 }, end: { row: 1, col: 0 } },
      },
      keyboardMeta("EXTEND_DOWN", "shift+ArrowDown"),
    );
    expect(onAction).toHaveBeenNthCalledWith(
      2,
      {
        kind: "select-range",
        range: { start: { row: 0, col: 0 }, end: { row: 1, col: 1 } },
      },
      keyboardMeta("EXTEND_RIGHT", "shift+ArrowRight"),
    );
  });

  it("extends to the edge of the data region with modifier and Shift together", () => {
    const grid = { ...createRevenueGrid(), activeCell: { row: 0, col: 2 } };
    const { onAction, container } = renderGrid(grid);

    fireEvent.keyDown(container, { key: "ArrowDown", metaKey: true, shiftKey: true });

    expect(onAction).toHaveBeenCalledWith(
      {
        kind: "select-range",
        range: { start: { row: 0, col: 2 }, end: { row: 6, col: 2 } },
      },
      // The exact case this whole command layer exists for: this single Ctrl/Cmd+Shift+Down must
      // stay distinguishable from twelve plain Shift+Downs, which reach the same final selection.
      keyboardMeta("EXTEND_JUMP_DOWN", "mod+shift+ArrowDown"),
    );
  });

  it("selects the active column with Ctrl+Space", () => {
    const grid = { ...createRevenueGrid(), activeCell: { row: 3, col: 2 } };
    const { onAction, container } = renderGrid(grid);

    fireEvent.keyDown(container, { key: " ", code: "Space", ctrlKey: true });

    expect(onAction).toHaveBeenCalledWith(
      { kind: "select-column", col: 2, usedRangeOnly: true },
      keyboardMeta("SELECT_COLUMN", "ctrl+ "),
    );
  });

  it("selects the active row with Shift+Space", () => {
    const grid = { ...createRevenueGrid(), activeCell: { row: 3, col: 2 } };
    const { onAction, container } = renderGrid(grid);

    fireEvent.keyDown(container, { key: " ", code: "Space", shiftKey: true });

    expect(onAction).toHaveBeenCalledWith(
      { kind: "select-row", row: 3 },
      keyboardMeta("SELECT_ROW", "shift+ "),
    );
  });

  it("selects the whole used range with the modifier and A", () => {
    const { onAction, container } = renderGrid(createRevenueGrid());

    fireEvent.keyDown(container, { key: "a", metaKey: true });

    expect(onAction).toHaveBeenCalledWith(
      {
        kind: "select-range",
        range: { start: { row: 0, col: 0 }, end: { row: 6, col: 4 } },
      },
      keyboardMeta("SELECT_TABLE", "mod+a"),
    );
  });
});

describe("formatting shortcuts", () => {
  it("bolds the selection with the modifier and B", () => {
    const grid: GridState = {
      ...createRevenueGrid({ boldHeaders: false }),
      selection: { kind: "range", range: { start: { row: 0, col: 0 }, end: { row: 0, col: 4 } } },
    };
    const { onAction, container } = renderGrid(grid, ["select-cell", "set-format"]);

    fireEvent.keyDown(container, { key: "b", metaKey: true });

    expect(onAction).toHaveBeenCalledWith(
      {
        kind: "set-format",
        range: { start: { row: 0, col: 0 }, end: { row: 0, col: 4 } },
        format: { bold: true },
      },
      keyboardMeta("TOGGLE_BOLD", "mod+b"),
    );
  });

  it("unbolds a selection that is already fully bold", () => {
    const grid: GridState = {
      ...createRevenueGrid(),
      selection: { kind: "range", range: { start: { row: 0, col: 0 }, end: { row: 0, col: 4 } } },
    };
    const { onAction, container } = renderGrid(grid, ["set-format"]);

    fireEvent.keyDown(container, { key: "b", ctrlKey: true });

    expect(onAction).toHaveBeenCalledWith(
      {
        kind: "set-format",
        range: { start: { row: 0, col: 0 }, end: { row: 0, col: 4 } },
        format: { bold: false },
      },
      keyboardMeta("TOGGLE_BOLD", "mod+b"),
    );
  });

  it("applies currency with Ctrl+Shift+4", () => {
    const grid: GridState = {
      ...createRevenueGrid({ revenueFormat: "general" }),
      selection: { kind: "range", range: { start: { row: 1, col: 2 }, end: { row: 6, col: 2 } } },
    };
    const { onAction, container } = renderGrid(grid, ["set-format"]);

    fireEvent.keyDown(container, { key: "$", ctrlKey: true, shiftKey: true });

    expect(onAction).toHaveBeenCalledWith(
      {
        kind: "set-format",
        range: { start: { row: 1, col: 2 }, end: { row: 6, col: 2 } },
        format: { numberFormat: "currency" },
      },
      keyboardMeta("FORMAT_CURRENCY", "mod+shift+$"),
    );
  });

  it("ignores formatting shortcuts when the challenge does not allow set-format", () => {
    const grid: GridState = {
      ...createRevenueGrid(),
      selection: { kind: "range", range: { start: { row: 0, col: 0 }, end: { row: 0, col: 4 } } },
    };
    const { onAction, container } = renderGrid(grid, ["select-cell"]);

    fireEvent.keyDown(container, { key: "b", metaKey: true });

    expect(onAction).not.toHaveBeenCalled();

    // Movement is never gated: it is how the player gets around.
    fireEvent.keyDown(container, { key: "ArrowDown" });

    expect(onAction).toHaveBeenCalledWith(
      { kind: "select-cell", cell: { row: 1, col: 0 } },
      keyboardMeta("MOVE_DOWN", "ArrowDown"),
    );
  });
});

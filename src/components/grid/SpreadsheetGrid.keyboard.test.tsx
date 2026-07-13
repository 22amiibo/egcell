import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SpreadsheetGrid } from "@/components/grid/SpreadsheetGrid";
import type { GridAction, GridState } from "@/domain/grid/gridTypes";
import type { RunInputMethod } from "@/domain/runs/runTypes";
import { createRevenueGrid } from "@/test/fixtures/revenueGrid";

function renderGrid(grid: GridState, allowedActions?: GridAction["kind"][]) {
  const onAction = vi.fn<(action: GridAction, inputMethod?: RunInputMethod) => void>();

  render(<SpreadsheetGrid grid={grid} onAction={onAction} allowedActions={allowedActions} />);

  return { onAction, container: screen.getByRole("grid") };
}

describe("keyboard movement", () => {
  it("moves the active cell with a plain arrow", () => {
    const { onAction, container } = renderGrid(createRevenueGrid());

    fireEvent.keyDown(container, { key: "ArrowDown" });

    expect(onAction).toHaveBeenCalledWith(
      { kind: "select-cell", cell: { row: 1, col: 0 } },
      "keyboard",
    );
  });

  it("keeps moving from where the last keystroke landed", () => {
    const { onAction, container } = renderGrid(createRevenueGrid());

    fireEvent.keyDown(container, { key: "ArrowDown" });
    fireEvent.keyDown(container, { key: "ArrowRight" });

    expect(onAction).toHaveBeenLastCalledWith(
      { kind: "select-cell", cell: { row: 1, col: 1 } },
      "keyboard",
    );
  });

  it("jumps to the edge of the data region with a modifier held", () => {
    const grid = { ...createRevenueGrid(), activeCell: { row: 0, col: 2 } };
    const { onAction, container } = renderGrid(grid);

    fireEvent.keyDown(container, { key: "ArrowDown", metaKey: true });

    expect(onAction).toHaveBeenCalledWith(
      { kind: "select-cell", cell: { row: 6, col: 2 } },
      "keyboard",
    );
  });

  it("accepts Ctrl as the jump modifier too", () => {
    const grid = { ...createRevenueGrid(), activeCell: { row: 0, col: 2 } };
    const { onAction, container } = renderGrid(grid);

    fireEvent.keyDown(container, { key: "ArrowDown", ctrlKey: true });

    expect(onAction).toHaveBeenCalledWith(
      { kind: "select-cell", cell: { row: 6, col: 2 } },
      "keyboard",
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
      "keyboard",
    );
    expect(onAction).toHaveBeenNthCalledWith(
      2,
      {
        kind: "select-range",
        range: { start: { row: 0, col: 0 }, end: { row: 1, col: 1 } },
      },
      "keyboard",
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
      "keyboard",
    );
  });

  it("selects the active column with Ctrl+Space", () => {
    const grid = { ...createRevenueGrid(), activeCell: { row: 3, col: 2 } };
    const { onAction, container } = renderGrid(grid);

    fireEvent.keyDown(container, { key: " ", code: "Space", ctrlKey: true });

    expect(onAction).toHaveBeenCalledWith(
      { kind: "select-column", col: 2, usedRangeOnly: true },
      "keyboard",
    );
  });

  it("selects the active row with Shift+Space", () => {
    const grid = { ...createRevenueGrid(), activeCell: { row: 3, col: 2 } };
    const { onAction, container } = renderGrid(grid);

    fireEvent.keyDown(container, { key: " ", code: "Space", shiftKey: true });

    expect(onAction).toHaveBeenCalledWith({ kind: "select-row", row: 3 }, "keyboard");
  });

  it("selects the whole used range with the modifier and A", () => {
    const { onAction, container } = renderGrid(createRevenueGrid());

    fireEvent.keyDown(container, { key: "a", metaKey: true });

    expect(onAction).toHaveBeenCalledWith(
      {
        kind: "select-range",
        range: { start: { row: 0, col: 0 }, end: { row: 6, col: 4 } },
      },
      "keyboard",
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
      "keyboard",
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
      "keyboard",
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
      "keyboard",
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
      "keyboard",
    );
  });
});

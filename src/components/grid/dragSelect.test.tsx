import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SpreadsheetGrid } from "@/components/grid/SpreadsheetGrid";
import type { ActionMeta, GridCommandId } from "@/domain/commands/commandTypes";
import { gridReducer } from "@/domain/grid/gridReducer";
import { createRevenueGrid } from "@/test/fixtures/revenueGrid";

const cell = (name: string) => screen.getByRole("button", { name });

/** Every grid-pointer call carries this shape; only `command` varies. */
function pointerMeta(command: GridCommandId): ActionMeta {
  return { command, inputMethod: "pointer", via: "grid", chord: null, controlId: null };
}

describe("drag to select a range", () => {
  it("selects the range the pointer was dragged across", async () => {
    const onAction = vi.fn();
    render(<SpreadsheetGrid grid={createRevenueGrid()} onAction={onAction} />);

    await userEvent.pointer([
      { keys: "[MouseLeft>]", target: cell("A1") },
      { target: cell("C3") },
    ]);

    expect(onAction).toHaveBeenCalledWith(
      {
        kind: "select-range",
        range: { start: { row: 0, col: 0 }, end: { row: 2, col: 2 } },
      },
      pointerMeta("DRAG_SELECT_RANGE"),
    );
  });

  it("does not collapse the dragged range back to one cell on the click that follows", async () => {
    const onAction = vi.fn();
    render(<SpreadsheetGrid grid={createRevenueGrid()} onAction={onAction} />);

    await userEvent.pointer([
      { keys: "[MouseLeft>]", target: cell("A1") },
      { target: cell("C3") },
      { keys: "[/MouseLeft]", target: cell("C3") },
    ]);

    // A click always fires after a drag's pointerup. If it were let through it would overwrite the
    // range with a single cell, and the player's drag would be lost.
    expect(onAction).not.toHaveBeenCalledWith(
      {
        kind: "select-cell",
        cell: { row: 2, col: 2 },
      },
      pointerMeta("CLICK_CELL"),
    );
  });

  it("still selects a single cell on a plain click", async () => {
    const onAction = vi.fn();
    render(<SpreadsheetGrid grid={createRevenueGrid()} onAction={onAction} />);

    await userEvent.click(cell("B2"));

    expect(onAction).toHaveBeenCalledWith(
      { kind: "select-cell", cell: { row: 1, col: 1 } },
      pointerMeta("CLICK_CELL"),
    );
  });

  it("does not paint a selection when the pointer merely hovers with the button up", async () => {
    const onAction = vi.fn();
    render(<SpreadsheetGrid grid={createRevenueGrid()} onAction={onAction} />);

    await userEvent.hover(cell("A1"));
    await userEvent.hover(cell("C3"));

    expect(onAction).not.toHaveBeenCalled();
  });
});

describe("a filtered grid", () => {
  it("stops rendering the rows a filter hid", () => {
    const grid = gridReducer(createRevenueGrid(), {
      kind: "filter-column",
      col: 0,
      op: "equals",
      value: "East",
    });

    render(<SpreadsheetGrid grid={grid} onAction={vi.fn()} />);

    // Alice and Eli are the two East reps, on data rows 1 and 5.
    expect(screen.getByRole("button", { name: "B2" })).toHaveTextContent("Alice");
    expect(screen.getByRole("button", { name: "B6" })).toHaveTextContent("Eli");

    // Bruno's row is filtered out, so its cells are not in the document at all.
    expect(screen.queryByRole("button", { name: "B3" })).not.toBeInTheDocument();
  });
});

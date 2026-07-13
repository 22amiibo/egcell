import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SpreadsheetGrid } from "@/components/grid/SpreadsheetGrid";
import { gridReducer } from "@/domain/grid/gridReducer";
import { createRevenueGrid } from "@/test/fixtures/revenueGrid";

describe("SpreadsheetGrid", () => {
  it("dispatches a used-range column selection when a column header is clicked", async () => {
    const onAction = vi.fn();
    render(<SpreadsheetGrid grid={createRevenueGrid()} onAction={onAction} />);

    await userEvent.click(screen.getByRole("button", { name: "Select column C" }));

    expect(onAction).toHaveBeenCalledWith(
      { kind: "select-column", col: 2, usedRangeOnly: true },
      "pointer",
    );
  });

  it("dispatches a cell selection when a cell is clicked", async () => {
    const onAction = vi.fn();
    render(<SpreadsheetGrid grid={createRevenueGrid()} onAction={onAction} />);

    await userEvent.click(screen.getByRole("button", { name: "C4" }));

    expect(onAction).toHaveBeenCalledWith(
      { kind: "select-cell", cell: { row: 3, col: 2 } },
      "pointer",
    );
  });

  it("dispatches a row selection when a row header is clicked", async () => {
    const onAction = vi.fn();
    render(<SpreadsheetGrid grid={createRevenueGrid()} onAction={onAction} />);

    await userEvent.click(screen.getByRole("button", { name: "Select row 2" }));

    expect(onAction).toHaveBeenCalledWith({ kind: "select-row", row: 1 }, "pointer");
  });

  it("renders the Revenue column as formatted currency", () => {
    render(<SpreadsheetGrid grid={createRevenueGrid()} onAction={vi.fn()} />);

    expect(screen.getByRole("button", { name: "C2" })).toHaveTextContent("$128,400");
  });

  it("marks every cell of a selected column as selected", () => {
    const grid = gridReducer(createRevenueGrid(), {
      kind: "select-column",
      col: 2,
      usedRangeOnly: true,
    });

    render(<SpreadsheetGrid grid={grid} onAction={vi.fn()} />);

    expect(screen.getByRole("button", { name: "C1" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "C7" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "D1" })).toHaveAttribute("aria-pressed", "false");
  });
});

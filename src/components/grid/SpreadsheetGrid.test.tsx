import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SpreadsheetGrid } from "@/components/grid/SpreadsheetGrid";
import type { ActionMeta, GridCommandId } from "@/domain/commands/commandTypes";
import { gridReducer } from "@/domain/grid/gridReducer";
import { createRevenueGrid } from "@/test/fixtures/revenueGrid";

/** Every grid-pointer call carries this shape; only `command` varies. */
function pointerMeta(command: GridCommandId): ActionMeta {
  return { command, inputMethod: "pointer", via: "grid", chord: null, controlId: null };
}

describe("SpreadsheetGrid, when a filter matches nothing", () => {
  /** Every data row hidden — the state in the bug report. */
  function filteredToNothing() {
    return gridReducer(createRevenueGrid(), {
      kind: "filter-column",
      col: 0,
      op: "equals",
      value: "Atlantis",
    });
  }

  it("says nothing matched, instead of offering the empty sheet as the result", () => {
    render(<SpreadsheetGrid grid={filteredToNothing()} onAction={vi.fn()} />);

    expect(screen.getByTestId("no-matching-rows")).toHaveTextContent("No matching rows");

    // The reported symptom: row 1, then blank rows 8-12, looking exactly like five rows the filter
    // had handed back. Row 8 is the first row below the table; it is off the screen now.
    expect(screen.queryByRole("button", { name: "A8" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Select row 8" })).not.toBeInTheDocument();
  });

  it("keeps the headers, so the filter can still be reached and cleared", () => {
    render(<SpreadsheetGrid grid={filteredToNothing()} onAction={vi.fn()} />);

    // The column header is the filter's own control surface. Lose it and the player is stuck with a
    // filter they cannot undo. It survives, and so does every other column header.
    expect(screen.getByRole("button", { name: "A1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select column A" })).toBeInTheDocument();
  });

  it("puts the rows back when the filter is cleared", () => {
    const cleared = gridReducer(filteredToNothing(), { kind: "clear-filters" });

    render(<SpreadsheetGrid grid={cleared} onAction={vi.fn()} />);

    expect(screen.queryByTestId("no-matching-rows")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "A2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "A8" })).toBeInTheDocument();
  });

  it("shows no empty-state row while the filter still matches something", () => {
    const matching = gridReducer(createRevenueGrid(), {
      kind: "filter-column",
      col: 0,
      op: "equals",
      value: "East",
    });

    render(<SpreadsheetGrid grid={matching} onAction={vi.fn()} />);

    expect(screen.queryByTestId("no-matching-rows")).not.toBeInTheDocument();
  });
});

describe("SpreadsheetGrid", () => {
  it("applies compact density and gridline strength to the grid", () => {
    render(
      <SpreadsheetGrid
        grid={createRevenueGrid()}
        density="compact"
        gridlineStrength="strong"
        onAction={vi.fn()}
      />,
    );

    expect(screen.getByTestId("spreadsheet-grid")).toHaveAttribute("data-density", "compact");
    expect(screen.getByTestId("spreadsheet-grid")).toHaveAttribute(
      "data-gridline-strength",
      "strong",
    );
    expect(screen.getByRole("button", { name: "A1" })).toHaveStyle({
      width: "96px",
      height: "26px",
    });
  });

  it("keeps compact grids large enough when large targets are enabled", () => {
    render(
      <SpreadsheetGrid
        grid={createRevenueGrid()}
        density="compact"
        largeTargets
        onAction={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "A1" })).toHaveStyle({
      width: "116px",
      height: "40px",
    });
  });

  it("keeps its initial geometry for the full mounted run", () => {
    const { rerender } = render(
      <SpreadsheetGrid
        grid={createRevenueGrid()}
        density="compact"
        onAction={vi.fn()}
      />,
    );

    rerender(
      <SpreadsheetGrid
        grid={createRevenueGrid()}
        density="large"
        largeTargets
        onAction={vi.fn()}
      />,
    );

    expect(screen.getByTestId("spreadsheet-grid")).toHaveAttribute("data-density", "compact");
    expect(screen.getByRole("button", { name: "A1" })).toHaveStyle({
      width: "96px",
      height: "26px",
    });
  });

  it("dispatches a used-range column selection when a column header is clicked", async () => {
    const onAction = vi.fn();
    render(<SpreadsheetGrid grid={createRevenueGrid()} onAction={onAction} />);

    await userEvent.click(screen.getByRole("button", { name: "Select column C" }));

    expect(onAction).toHaveBeenCalledWith(
      { kind: "select-column", col: 2, usedRangeOnly: true },
      pointerMeta("CLICK_COLUMN_HEADER"),
    );
  });

  it("dispatches a cell selection when a cell is clicked", async () => {
    const onAction = vi.fn();
    render(<SpreadsheetGrid grid={createRevenueGrid()} onAction={onAction} />);

    await userEvent.click(screen.getByRole("button", { name: "C4" }));

    expect(onAction).toHaveBeenCalledWith(
      { kind: "select-cell", cell: { row: 3, col: 2 } },
      pointerMeta("CLICK_CELL"),
    );
  });

  it("dispatches a row selection when a row header is clicked", async () => {
    const onAction = vi.fn();
    render(<SpreadsheetGrid grid={createRevenueGrid()} onAction={onAction} />);

    await userEvent.click(screen.getByRole("button", { name: "Select row 2" }));

    expect(onAction).toHaveBeenCalledWith(
      { kind: "select-row", row: 1 },
      pointerMeta("CLICK_ROW_HEADER"),
    );
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

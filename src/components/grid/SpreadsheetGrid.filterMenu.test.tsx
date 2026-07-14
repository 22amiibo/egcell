import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SpreadsheetGrid } from "@/components/grid/SpreadsheetGrid";
import type { ActionMeta, GridCommandId } from "@/domain/commands/commandTypes";
import type { GridAction, GridState } from "@/domain/grid/gridTypes";
import { FIRST_DATA_ROW, STATUS_COL, createRevenueGrid } from "@/test/fixtures/revenueGrid";

function renderGrid(grid: GridState, allowedActions?: GridAction["kind"][]) {
  const onAction = vi.fn<(action: GridAction, meta: ActionMeta) => void>();

  render(<SpreadsheetGrid grid={grid} onAction={onAction} allowedActions={allowedActions} />);

  return { onAction, container: screen.getByRole("grid") };
}

function menuMeta(command: GridCommandId): ActionMeta {
  return { command, inputMethod: "keyboard", via: "menu", chord: null, controlId: null };
}

const ALL_FILTER_ACTIONS: GridAction["kind"][] = [
  "select-cell",
  "sort-column",
  "filter-column",
  "clear-filters",
];

describe("FilterMenu (Alt+↓)", () => {
  it("opens on Alt+↓ without dispatching MOVE_DOWN", () => {
    const grid: GridState = {
      ...createRevenueGrid(),
      activeCell: { row: FIRST_DATA_ROW, col: STATUS_COL },
    };
    const { onAction, container } = renderGrid(grid, ALL_FILTER_ACTIONS);

    fireEvent.keyDown(container, { key: "ArrowDown", altKey: true });

    expect(onAction).not.toHaveBeenCalled();
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("does not open when the challenge allows none of sort/filter/clear", () => {
    const grid: GridState = {
      ...createRevenueGrid(),
      activeCell: { row: FIRST_DATA_ROW, col: STATUS_COL },
    };
    const { onAction, container } = renderGrid(grid, ["select-cell"]);

    fireEvent.keyDown(container, { key: "ArrowDown", altKey: true });

    expect(onAction).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("applies the highlighted option (SORT_ASC, first by default) on Enter, tagged via: menu", () => {
    const grid: GridState = {
      ...createRevenueGrid(),
      activeCell: { row: FIRST_DATA_ROW, col: STATUS_COL },
    };
    const { onAction, container } = renderGrid(grid, ALL_FILTER_ACTIONS);

    fireEvent.keyDown(container, { key: "ArrowDown", altKey: true });
    fireEvent.keyDown(container, { key: "Enter" });

    expect(onAction).toHaveBeenCalledWith(
      { kind: "sort-column", col: STATUS_COL, direction: "asc" },
      menuMeta("SORT_ASC"),
    );
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("navigates with arrows to FILTER_TO_VALUE and applies it", () => {
    const grid: GridState = {
      ...createRevenueGrid(),
      activeCell: { row: FIRST_DATA_ROW, col: STATUS_COL },
    };
    const { onAction, container } = renderGrid(grid, ALL_FILTER_ACTIONS);

    fireEvent.keyDown(container, { key: "ArrowDown", altKey: true });

    // Options for a text cell with no filters yet: SORT_ASC, SORT_DESC, FILTER_TO_VALUE.
    expect(screen.getAllByRole("option")).toHaveLength(3);

    fireEvent.keyDown(container, { key: "ArrowDown" });
    fireEvent.keyDown(container, { key: "ArrowDown" });
    fireEvent.keyDown(container, { key: "Enter" });

    expect(onAction).toHaveBeenCalledWith(
      { kind: "filter-column", col: STATUS_COL, op: "equals", value: "Complete" },
      menuMeta("FILTER_TO_VALUE"),
    );
  });

  it("offers CLEAR_FILTERS once filters exist, and applies it", () => {
    const grid: GridState = {
      ...createRevenueGrid(),
      activeCell: { row: FIRST_DATA_ROW, col: STATUS_COL },
      filters: [{ col: STATUS_COL, op: "equals", value: "Complete" }],
    };
    const { onAction, container } = renderGrid(grid, ALL_FILTER_ACTIONS);

    fireEvent.keyDown(container, { key: "ArrowDown", altKey: true });

    // SORT_ASC, SORT_DESC, FILTER_TO_VALUE, CLEAR_FILTERS.
    expect(screen.getAllByRole("option")).toHaveLength(4);

    fireEvent.keyDown(container, { key: "ArrowDown" });
    fireEvent.keyDown(container, { key: "ArrowDown" });
    fireEvent.keyDown(container, { key: "ArrowDown" });
    fireEvent.keyDown(container, { key: "Enter" });

    expect(onAction).toHaveBeenCalledWith({ kind: "clear-filters" }, menuMeta("CLEAR_FILTERS"));
  });

  it("closes on Escape without dispatching anything", () => {
    const grid: GridState = {
      ...createRevenueGrid(),
      activeCell: { row: FIRST_DATA_ROW, col: STATUS_COL },
    };
    const { onAction, container } = renderGrid(grid, ALL_FILTER_ACTIONS);

    fireEvent.keyDown(container, { key: "ArrowDown", altKey: true });
    fireEvent.keyDown(container, { key: "Escape" });

    expect(onAction).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("does not let arrow-up move past the first option", () => {
    const grid: GridState = {
      ...createRevenueGrid(),
      activeCell: { row: FIRST_DATA_ROW, col: STATUS_COL },
    };
    const { onAction, container } = renderGrid(grid, ALL_FILTER_ACTIONS);

    fireEvent.keyDown(container, { key: "ArrowDown", altKey: true });
    fireEvent.keyDown(container, { key: "ArrowUp" });
    fireEvent.keyDown(container, { key: "Enter" });

    expect(onAction).toHaveBeenCalledWith(
      { kind: "sort-column", col: STATUS_COL, direction: "asc" },
      menuMeta("SORT_ASC"),
    );
  });
});

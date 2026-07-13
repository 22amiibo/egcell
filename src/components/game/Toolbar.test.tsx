import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Toolbar } from "@/components/game/Toolbar";
import type { Challenge } from "@/domain/challenges/challengeTypes";
import type { GridState } from "@/domain/grid/gridTypes";
import {
  FIRST_DATA_ROW,
  HEADER_ROW,
  REVENUE_COL,
  STATUS_COL,
  createRevenueGrid,
} from "@/test/fixtures/revenueGrid";

const BLANK_COL = 6;

const filterChallenge: Challenge = {
  id: "test.filter",
  version: "v1",
  slug: "filter-status",
  title: "Filter to one value",
  prompt: "Show only the rows where Status is Pending.",
  family: "sort-filter",
  difficulty: 2,
  seed: "test",
  timingPolicy: { kind: "single-challenge", targetSeconds: 9 },
  initialGrid: createRevenueGrid(),
  allowedActions: ["select-cell", "filter-column", "clear-filters"],
  validation: {
    kind: "sort-filter",
    requiredVisible: { col: STATUS_COL, op: "equals", value: "Pending" },
  },
  scoring: { basePoints: 1300, targetSeconds: 9, minimumCorrectnessForPr: 1 },
  practiceNotes: [],
};

function renderToolbar(activeCell: { row: number; col: number }) {
  const onAction = vi.fn();
  const grid: GridState = { ...createRevenueGrid(), activeCell };

  render(<Toolbar challenge={filterChallenge} grid={grid} onAction={onAction} />);

  return { onAction };
}

const filterButton = () => screen.getByRole("button", { name: "Filter to the selected value" });
const filterAboveButton = () =>
  screen.getByRole("button", { name: "Filter above the selected value" });

describe("Toolbar filters", () => {
  it("refuses to anchor a filter on a header cell, which would hide every data row", () => {
    renderToolbar({ row: HEADER_ROW, col: STATUS_COL });

    expect(filterButton()).toBeDisabled();
    expect(filterAboveButton()).toBeDisabled();
    expect(screen.getByTestId("filter-hint")).toHaveTextContent(/click a cell below the header/i);
  });

  it("filters to the value held by the selected data cell", () => {
    const { onAction } = renderToolbar({ row: FIRST_DATA_ROW, col: STATUS_COL });

    expect(screen.queryByTestId("filter-hint")).not.toBeInTheDocument();
    filterButton().click();

    expect(onAction).toHaveBeenCalledWith({
      kind: "filter-column",
      col: STATUS_COL,
      op: "equals",
      value: "Complete",
    });
  });

  it("offers the greater-than filter only on a number cell", () => {
    const { onAction } = renderToolbar({ row: FIRST_DATA_ROW, col: REVENUE_COL });

    filterAboveButton().click();

    expect(onAction).toHaveBeenCalledWith({
      kind: "filter-column",
      col: REVENUE_COL,
      op: "greater-than",
      value: 128400,
    });
  });

  it("tells the player to pick a value when the selected cell is blank", () => {
    renderToolbar({ row: FIRST_DATA_ROW, col: BLANK_COL });

    expect(filterButton()).toBeDisabled();
    expect(screen.getByTestId("filter-hint")).toHaveTextContent(/blank/i);
  });
});

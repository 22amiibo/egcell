import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FilterMenu, filterMenuOptions } from "@/components/grid/FilterMenu";
import type { GridState } from "@/domain/grid/gridTypes";
import { FIRST_DATA_ROW, REVENUE_COL, STATUS_COL, createRevenueGrid } from "@/test/fixtures/revenueGrid";

const allowAll = () => true;
const allowNone = () => false;

describe("filterMenuOptions", () => {
  it("offers sort and filter-to-value for a text data cell, no filter-above and no clear", () => {
    const grid: GridState = {
      ...createRevenueGrid(),
      activeCell: { row: FIRST_DATA_ROW, col: STATUS_COL },
    };

    const options = filterMenuOptions(grid, allowAll);

    expect(options.map((option) => option.command)).toEqual([
      "SORT_ASC",
      "SORT_DESC",
      "FILTER_TO_VALUE",
    ]);
    expect(options.find((option) => option.command === "FILTER_TO_VALUE")?.label).toBe(
      'Filter to "Complete"',
    );
  });

  it("also offers filter-above for a numeric data cell", () => {
    const grid: GridState = {
      ...createRevenueGrid(),
      activeCell: { row: FIRST_DATA_ROW, col: REVENUE_COL },
    };

    const options = filterMenuOptions(grid, allowAll);

    expect(options.map((option) => option.command)).toEqual([
      "SORT_ASC",
      "SORT_DESC",
      "FILTER_TO_VALUE",
      "FILTER_ABOVE_VALUE",
    ]);
    expect(options.find((option) => option.command === "FILTER_ABOVE_VALUE")?.label).toBe(
      "Filter above 128400",
    );
  });

  it("adds CLEAR_FILTERS only once filters exist", () => {
    const grid: GridState = {
      ...createRevenueGrid(),
      activeCell: { row: FIRST_DATA_ROW, col: STATUS_COL },
      filters: [{ col: STATUS_COL, op: "equals", value: "Complete" }],
    };

    expect(filterMenuOptions(grid, allowAll).map((option) => option.command)).toContain(
      "CLEAR_FILTERS",
    );
  });

  it("drops filter options for a blank or header active cell", () => {
    const headerGrid: GridState = { ...createRevenueGrid(), activeCell: { row: 0, col: STATUS_COL } };
    const blankGrid: GridState = { ...createRevenueGrid(), activeCell: { row: FIRST_DATA_ROW, col: 6 } };

    for (const grid of [headerGrid, blankGrid]) {
      const options = filterMenuOptions(grid, allowAll).map((option) => option.command);

      expect(options).not.toContain("FILTER_TO_VALUE");
      expect(options).not.toContain("FILTER_ABOVE_VALUE");
    }
  });

  it("returns nothing when the challenge allows none of sort/filter/clear", () => {
    const grid: GridState = {
      ...createRevenueGrid(),
      activeCell: { row: FIRST_DATA_ROW, col: STATUS_COL },
      filters: [{ col: STATUS_COL, op: "equals", value: "Complete" }],
    };

    expect(filterMenuOptions(grid, allowNone)).toEqual([]);
  });
});

describe("FilterMenu (presentational)", () => {
  it("renders every option and marks only the highlighted one selected", () => {
    render(
      <FilterMenu
        options={[
          { command: "SORT_ASC", label: "Sort A to Z" },
          { command: "SORT_DESC", label: "Sort Z to A" },
        ]}
        highlightedIndex={1}
      />,
    );

    const options = screen.getAllByRole("option");

    expect(options).toHaveLength(2);
    expect(options[0]).toHaveAttribute("aria-selected", "false");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
  });
});

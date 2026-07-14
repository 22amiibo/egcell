import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ColumnHeader } from "@/components/grid/ColumnHeader";
import { getGridMetrics } from "@/components/grid/gridMetrics";

const metrics = getGridMetrics("comfortable", false);

describe("ColumnHeader", () => {
  it("still selects the column on the main button, unaffected by the caret", () => {
    const onSelect = vi.fn();

    render(
      <ColumnHeader
        col={2}
        label="C"
        isSelected={false}
        onSelect={onSelect}
        metrics={metrics}
        gridlineClass="border-line"
        showFilterCaret={false}
        onOpenFilterMenu={vi.fn()}
      />,
    );

    screen.getByRole("button", { name: "Select column C" }).click();

    expect(onSelect).toHaveBeenCalledWith(2);
    expect(screen.queryByRole("button", { name: "Sort and filter" })).not.toBeInTheDocument();
  });

  it("renders the filter caret only when showFilterCaret is true, and opens the menu on click", () => {
    const onOpenFilterMenu = vi.fn();

    render(
      <ColumnHeader
        col={2}
        label="C"
        isSelected
        onSelect={vi.fn()}
        metrics={metrics}
        gridlineClass="border-line"
        showFilterCaret
        onOpenFilterMenu={onOpenFilterMenu}
      />,
    );

    screen.getByRole("button", { name: "Sort and filter" }).click();

    expect(onOpenFilterMenu).toHaveBeenCalledTimes(1);
    // The caret is a second, independent button — clicking it must not also reselect the column.
    expect(screen.getByRole("button", { name: "Select column C" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

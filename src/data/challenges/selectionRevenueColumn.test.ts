import { describe, expect, it } from "vitest";

import { selectionRevenueColumnChallenge } from "@/data/challenges/selectionRevenueColumn";
import { normalizeRange } from "@/domain/grid/range";
import { columnRangeWithinUsedRange, getCell } from "@/domain/grid/selectors";

describe("selectionRevenueColumnChallenge", () => {
  it("carries the identity fields a run result needs", () => {
    expect(selectionRevenueColumnChallenge.id).toBe("selection.revenue-column");
    expect(selectionRevenueColumnChallenge.version).toBe("v1");
    expect(selectionRevenueColumnChallenge.slug).toBe("select-revenue-column");
    expect(selectionRevenueColumnChallenge.seed).toBe("revenue-column-v1");
    expect(selectionRevenueColumnChallenge.prompt).toBe("Select the Revenue column.");
    expect(selectionRevenueColumnChallenge.family).toBe("selection");
  });

  it("scores against an 8 second target and only banks a personal record on a correct run", () => {
    expect(selectionRevenueColumnChallenge.scoring).toEqual({
      basePoints: 1000,
      targetSeconds: 8,
      minimumCorrectnessForPr: 1,
    });
    expect(selectionRevenueColumnChallenge.timingPolicy).toEqual({
      kind: "single-challenge",
      targetSeconds: 8,
    });
  });

  it("targets the Revenue column header", () => {
    const { initialGrid, validation } = selectionRevenueColumnChallenge;
    const headerAddress = normalizeRange(validation.requiredRange).start;

    expect(getCell(initialGrid, headerAddress)?.value).toEqual({
      kind: "text",
      value: "Revenue",
    });
  });

  it("requires the whole Revenue column inside the used range", () => {
    const { initialGrid, validation } = selectionRevenueColumnChallenge;

    expect(validation.kind).toBe("selection");
    expect(validation.requireEntireColumnWithinUsedRange).toBe(true);
    expect(validation.requiredRange).toEqual(columnRangeWithinUsedRange(initialGrid, 2));
  });

  it("only allows selection actions", () => {
    expect(selectionRevenueColumnChallenge.allowedActions).toEqual([
      "select-cell",
      "select-range",
      "select-column",
    ]);
  });

  it("keeps the fast route in practice notes instead of the prompt", () => {
    expect(selectionRevenueColumnChallenge.practiceNotes.length).toBeGreaterThan(0);
    expect(selectionRevenueColumnChallenge.prompt).not.toContain("header");
  });

  it("starts from an unselected, unsorted, unfiltered grid", () => {
    const { initialGrid } = selectionRevenueColumnChallenge;

    expect(initialGrid.selection).toEqual({ kind: "none" });
    expect(initialGrid.sortState).toBeNull();
    expect(initialGrid.filters).toEqual([]);
    expect(initialGrid.hiddenRows).toEqual([]);
  });
});

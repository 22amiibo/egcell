import type { GridSelection, GridState, RangeAddress } from "@/domain/grid/gridTypes";
import { normalizeRange, rangesEqual } from "@/domain/grid/range";
import { columnRangeWithinUsedRange, rowRangeWithinUsedRange } from "@/domain/grid/selectors";
import {
  NOTHING_DONE_YET,
  type ChallengeValidator,
  type SpecOfKind,
  failed,
  passed,
} from "@/domain/validation/validatorTypes";

function wholeColumn(grid: GridState, col: number): RangeAddress {
  return { start: { row: 0, col }, end: { row: grid.rowCount - 1, col } };
}

function wholeRow(grid: GridState, row: number): RangeAddress {
  return { start: { row, col: 0 }, end: { row, col: grid.colCount - 1 } };
}

/**
 * Flattens whatever the player has selected into a single range the validator can compare.
 *
 * A column selection is clipped to the used range when the spec asks for the column within the used
 * range. Clicking a column header and dragging that column's data mean the same thing to a player
 * working on a table, so the two must not validate differently.
 */
export function selectionToRange(
  grid: GridState,
  selection: GridSelection,
  spec: SpecOfKind<"selection">,
): RangeAddress | null {
  switch (selection.kind) {
    case "none":
      return null;

    case "cell":
      return { start: selection.cell, end: selection.cell };

    case "range":
      return normalizeRange(selection.range);

    case "row":
      return rowRangeWithinUsedRange(grid, selection.row) ?? wholeRow(grid, selection.row);

    case "column": {
      const clipToUsedRange = spec.requireEntireColumnWithinUsedRange || selection.usedRangeOnly;

      if (!clipToUsedRange) {
        return wholeColumn(grid, selection.col);
      }

      return columnRangeWithinUsedRange(grid, selection.col) ?? wholeColumn(grid, selection.col);
    }
  }
}

export const validateSelection: ChallengeValidator<"selection"> = ({ grid }, spec) => {
  const selected = selectionToRange(grid, grid.selection, spec);

  if (selected === null) {
    return NOTHING_DONE_YET;
  }

  if (!rangesEqual(selected, spec.requiredRange)) {
    return failed("Selection does not match the target.");
  }

  return passed("Selection matches the target.");
};

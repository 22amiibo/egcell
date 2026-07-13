import type { ValidationSpec } from "@/domain/challenges/challengeTypes";
import type { GridSelection, GridState, RangeAddress } from "@/domain/grid/gridTypes";
import { normalizeRange, rangesEqual } from "@/domain/grid/range";
import { columnRangeWithinUsedRange, rowRangeWithinUsedRange } from "@/domain/grid/selectors";
import type {
  ChallengeValidator,
  ValidationInput,
  ValidationResult,
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
 * A column selection is clipped to the used range when the spec asks for the column within the
 * used range. Clicking a column header and dragging that column's data mean the same thing to a
 * player working on a table, so the two must not validate differently.
 */
export function selectionToRange(
  grid: GridState,
  selection: GridSelection,
  spec: ValidationSpec,
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

function validate(input: ValidationInput): ValidationResult {
  const { challenge, grid } = input;
  const spec = challenge.validation;

  const selected = selectionToRange(grid, grid.selection, spec);

  if (selected === null) {
    return {
      isComplete: false,
      correctness: 0,
      completionPercent: 0,
      accuracy: 1,
      messages: [{ kind: "info", text: "Nothing is selected yet." }],
    };
  }

  if (!rangesEqual(selected, spec.requiredRange)) {
    return {
      isComplete: false,
      correctness: 0,
      completionPercent: 0,
      accuracy: 1,
      messages: [{ kind: "error", text: "Selection does not match the target." }],
    };
  }

  return {
    isComplete: true,
    correctness: 1,
    completionPercent: 1,
    accuracy: 1,
    messages: [{ kind: "success", text: "Selection matches the target." }],
  };
}

export const validateSelection = validate;

export const selectionValidator: ChallengeValidator = {
  kind: "selection",
  validate,
};

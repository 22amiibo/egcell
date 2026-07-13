import type { CellFormat } from "@/domain/grid/gridTypes";
import { normalizeRange } from "@/domain/grid/range";
import { getCell } from "@/domain/grid/selectors";
import {
  type ChallengeValidator,
  failed,
  partial,
  passed,
} from "@/domain/validation/validatorTypes";

/**
 * Only the keys the challenge asks about are compared. A challenge that wants currency does not care
 * whether the player also left the cell bold, so extra formatting is never punished.
 */
function hasRequiredFormat(actual: CellFormat, required: CellFormat): boolean {
  return (Object.keys(required) as Array<keyof CellFormat>).every(
    (key) => actual[key] === required[key],
  );
}

export const validateFormatting: ChallengeValidator<"formatting"> = ({ grid }, spec) => {
  const range = normalizeRange(spec.range);

  let matched = 0;
  let total = 0;

  for (let row = range.start.row; row <= range.end.row; row += 1) {
    for (let col = range.start.col; col <= range.end.col; col += 1) {
      total += 1;

      const cell = getCell(grid, { row, col });

      if (cell !== undefined && hasRequiredFormat(cell.format, spec.requiredFormat)) {
        matched += 1;
      }
    }
  }

  if (total === 0) {
    return failed("That range holds no cells.");
  }

  if (matched === total) {
    return passed("The range is formatted as asked.");
  }

  if (matched === 0) {
    return failed("The range is not formatted yet.");
  }

  return partial(matched / total, "Only part of the range is formatted.");
};

import type { CellFormat, GridState, RangeAddress } from "@/domain/grid/gridTypes";
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
 * whether the player also left the cell bold, so extra formatting on the same cell is not punished.
 */
function hasRequiredFormat(actual: CellFormat, required: CellFormat): boolean {
  return (Object.keys(required) as Array<keyof CellFormat>).every(
    (key) => actual[key] === required[key],
  );
}

/**
 * Did the player put the required format on cells the challenge never asked about?
 *
 * This exists because the route solver found the hole. "Make the Name values bold" was solvable by
 * selecting the whole table and pressing Ctrl+B — two actions, *fewer* than doing it properly, and
 * it graded as a pass, because this validator only ever looked at the cells inside the range. With
 * scoring keyed to action count, bolding the sheet was the winning play. It is not the task, and it
 * is certainly not a route to teach.
 *
 * The tolerance is deliberate and narrow: a spill is fine while it stays in a column or a row the
 * range already touches, and out of bounds otherwise. That line falls exactly between the two ways
 * of doing it — `Ctrl+Space` takes the target column and catches only that column's own header,
 * while `Ctrl+A` reaches across the whole sheet. Stay inside the column you were asked to format and
 * you are doing the task; leave it and you are doing something else.
 *
 * Only formatting the player *added* counts against them: a grid that arrives with a bold header
 * never fails anyone for a cell they never touched.
 */
function spilledOutside(
  grid: GridState,
  initial: GridState,
  spec: { range: RangeAddress; requiredFormat: CellFormat },
): boolean {
  const range = normalizeRange(spec.range);
  const height = range.end.row - range.start.row;
  const width = range.end.col - range.start.col;

  // The tolerance follows the range's own axis, and it has to: a column of data spans every data
  // row, so "shares a row with the range" would forgive every cell in the table — Ctrl+A would walk
  // straight back in through the other door. A column tolerates its column; a row tolerates its row.
  const tolerateColumn = height >= width;
  const tolerateRow = width >= height;

  for (let row = 0; row < grid.rowCount; row += 1) {
    for (let col = 0; col < grid.colCount; col += 1) {
      const inColumns = col >= range.start.col && col <= range.end.col;
      const inRows = row >= range.start.row && row <= range.end.row;

      if ((tolerateColumn && inColumns) || (tolerateRow && inRows)) {
        continue;
      }

      const cell = getCell(grid, { row, col });

      if (cell === undefined || !hasRequiredFormat(cell.format, spec.requiredFormat)) {
        continue;
      }

      const before = getCell(initial, { row, col });

      if (before === undefined || !hasRequiredFormat(before.format, spec.requiredFormat)) {
        return true;
      }
    }
  }

  return false;
}

export const validateFormatting: ChallengeValidator<"formatting"> = ({ challenge, grid }, spec) => {
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
    return spilledOutside(grid, challenge.initialGrid, spec)
      ? failed("That formatted more of the sheet than the challenge asked for.")
      : passed("The range is formatted as asked.");
  }

  if (matched === 0) {
    return failed("The range is not formatted yet.");
  }

  return partial(matched / total, "Only part of the range is formatted.");
};

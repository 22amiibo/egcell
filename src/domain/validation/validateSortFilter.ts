import { compareCellValues, matchesFilter } from "@/domain/grid/cellValues";
import type { GridState } from "@/domain/grid/gridTypes";
import { cellKey } from "@/domain/grid/range";
import { dataRowBounds, getCell, visibleDataRows } from "@/domain/grid/selectors";
import {
  type ChallengeValidator,
  type SpecOfKind,
  failed,
  passed,
} from "@/domain/validation/validatorTypes";

/**
 * Grades the table the player is looking at, not the buttons they pressed. Sorting from a toolbar,
 * from a header, or from any future keyboard route all land on the same visible order, so all of
 * them count.
 */
function isSortedBy(grid: GridState, spec: NonNullable<SpecOfKind<"sort-filter">["requiredSort"]>) {
  const rows = visibleDataRows(grid);
  const sign = spec.direction === "asc" ? 1 : -1;

  for (let index = 1; index < rows.length; index += 1) {
    const previous = getCell(grid, { row: rows[index - 1], col: spec.col })?.value;
    const current = getCell(grid, { row: rows[index], col: spec.col })?.value;

    if (compareCellValues(previous, current) * sign > 0) {
      return false;
    }
  }

  return true;
}

function showsExactly(
  grid: GridState,
  spec: NonNullable<SpecOfKind<"sort-filter">["requiredVisible"]>,
) {
  const { first, last } = dataRowBounds(grid);
  const hidden = new Set(grid.hiddenRows);

  for (let row = first; row <= last; row += 1) {
    const value = grid.cells[cellKey({ row, col: spec.col })]?.value;
    const shouldShow = matchesFilter(value, { col: spec.col, op: spec.op, value: spec.value });

    if (shouldShow === hidden.has(row)) {
      return false;
    }
  }

  return true;
}

export const validateSortFilter: ChallengeValidator<"sort-filter"> = ({ grid }, spec) => {
  if (spec.requiredSort !== undefined && !isSortedBy(grid, spec.requiredSort)) {
    return failed("The rows are not in the order the challenge asked for.");
  }

  if (spec.requiredVisible !== undefined && !showsExactly(grid, spec.requiredVisible)) {
    return failed("The wrong rows are showing.");
  }

  // An untouched table can already satisfy a sort by luck. Requiring at least one action stops a
  // challenge completing before the player has done anything.
  if (grid.sortState === null && grid.filters.length === 0) {
    return failed("Nothing has been sorted or filtered yet.");
  }

  return passed("The table matches the target.");
};

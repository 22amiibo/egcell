import type { CellAddress, GridCell, GridState, RangeAddress } from "@/domain/grid/gridTypes";
import { cellKey, normalizeRange } from "@/domain/grid/range";

export function getCell(grid: GridState, address: CellAddress): GridCell | undefined {
  return grid.cells[cellKey(address)];
}

/**
 * The range a column selection covers once it is clipped to the used range, which is how
 * an Excel column-header click reads to a player working on a table.
 * Returns null when the column falls outside the data.
 */
export function columnRangeWithinUsedRange(grid: GridState, col: number): RangeAddress | null {
  const used = normalizeRange(grid.usedRange);

  if (col < used.start.col || col > used.end.col) {
    return null;
  }

  return {
    start: { row: used.start.row, col },
    end: { row: used.end.row, col },
  };
}

/** The row equivalent of `columnRangeWithinUsedRange`. Returns null when the row falls outside the data. */
export function rowRangeWithinUsedRange(grid: GridState, row: number): RangeAddress | null {
  const used = normalizeRange(grid.usedRange);

  if (row < used.start.row || row > used.end.row) {
    return null;
  }

  return {
    start: { row, col: used.start.col },
    end: { row, col: used.end.col },
  };
}

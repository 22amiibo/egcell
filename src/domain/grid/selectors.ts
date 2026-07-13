import type { CellAddress, GridCell, GridState, RangeAddress } from "@/domain/grid/gridTypes";
import { cellKey, isAddressInRange, normalizeRange } from "@/domain/grid/range";

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

/**
 * The rectangle a selection paints on screen.
 *
 * A column selection paints the whole column and a row selection paints the whole row, which is
 * what Excel does and what the player expects to see. Validation clips a column to the used range
 * separately, so what is highlighted and what is graded can differ on purpose.
 */
export function selectionBounds(grid: GridState): RangeAddress | null {
  const selection = grid.selection;

  switch (selection.kind) {
    case "none":
      return null;

    case "cell":
      return { start: selection.cell, end: selection.cell };

    case "range":
      return normalizeRange(selection.range);

    case "row":
      return {
        start: { row: selection.row, col: 0 },
        end: { row: selection.row, col: grid.colCount - 1 },
      };

    case "column":
      return {
        start: { row: 0, col: selection.col },
        end: { row: grid.rowCount - 1, col: selection.col },
      };
  }
}

export function isCellSelected(grid: GridState, address: CellAddress): boolean {
  const bounds = selectionBounds(grid);

  return bounds !== null && isAddressInRange(address, bounds);
}

/** The rows that hold data: the used range minus its header rows. Sorting and filtering own these. */
export function dataRowBounds(grid: GridState): { first: number; last: number } {
  const used = normalizeRange(grid.usedRange);

  return { first: used.start.row + grid.headerRows, last: used.end.row };
}

/** Data rows a filter has not hidden, in the order they are currently displayed. */
export function visibleDataRows(grid: GridState): number[] {
  const { first, last } = dataRowBounds(grid);
  const hidden = new Set(grid.hiddenRows);
  const rows: number[] = [];

  for (let row = first; row <= last; row += 1) {
    if (!hidden.has(row)) {
      rows.push(row);
    }
  }

  return rows;
}

export function isRowHidden(grid: GridState, row: number): boolean {
  return grid.hiddenRows.includes(row);
}

/** Every row the grid actually draws, top to bottom. A filtered-out row is not drawn at all. */
export function renderedRows(grid: GridState): number[] {
  const hidden = new Set(grid.hiddenRows);
  const rows: number[] = [];

  for (let row = 0; row < grid.rowCount; row += 1) {
    if (!hidden.has(row)) {
      rows.push(row);
    }
  }

  return rows;
}

/**
 * Where a row sits on screen once earlier rows have been hidden, or null if it is hidden itself.
 * The selection overlay is positioned from this rather than from the row index, or it would drift
 * down the page by one row height for every row a filter removed above it.
 */
export function renderedRowIndex(grid: GridState, row: number): number | null {
  const index = renderedRows(grid).indexOf(row);

  return index === -1 ? null : index;
}

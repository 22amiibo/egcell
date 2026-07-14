import { compareCellValues, matchesFilter } from "@/domain/grid/cellValues";
import type {
  CellAddress,
  CellValue,
  FilterState,
  GridAction,
  GridCell,
  GridState,
} from "@/domain/grid/gridTypes";
import { cellKey, normalizeRange } from "@/domain/grid/range";
import { dataRowBounds, getCell } from "@/domain/grid/selectors";

function isCellInGrid(grid: GridState, cell: CellAddress): boolean {
  return cell.row >= 0 && cell.row < grid.rowCount && cell.col >= 0 && cell.col < grid.colCount;
}

function dataRows(grid: GridState): number[] {
  const { first, last } = dataRowBounds(grid);
  const rows: number[] = [];

  for (let row = first; row <= last; row += 1) {
    rows.push(row);
  }

  return rows;
}

/** Filters are recomputed from scratch whenever the data moves, because sorting changes row indexes. */
function hiddenRowsFor(grid: GridState, cells: GridState["cells"], filters: FilterState[]): number[] {
  if (filters.length === 0) {
    return [];
  }

  return dataRows(grid).filter((row) =>
    filters.some((filter) => !matchesFilter(cells[cellKey({ row, col: filter.col })]?.value, filter)),
  );
}

function sortCells(grid: GridState, col: number, direction: "asc" | "desc"): GridState["cells"] {
  const rows = dataRows(grid);
  const sign = direction === "asc" ? 1 : -1;

  const ordered = [...rows].sort((a, b) => {
    const comparison = compareCellValues(
      getCell(grid, { row: a, col })?.value,
      getCell(grid, { row: b, col })?.value,
    );

    // A blank always sinks, whichever way the sort runs, so the direction is not applied to it.
    if (comparison === 0) {
      return a - b;
    }

    const aIsBlank = getCell(grid, { row: a, col })?.value.kind === "blank";
    const bIsBlank = getCell(grid, { row: b, col })?.value.kind === "blank";

    if (aIsBlank || bIsBlank) {
      return comparison;
    }

    return comparison * sign;
  });

  const cells: GridState["cells"] = {};

  // Keep everything that is not a data row exactly where it is: headers, and anything below the table.
  for (const [key, cell] of Object.entries(grid.cells)) {
    if (!rows.includes(cell.address.row)) {
      cells[key] = cell;
    }
  }

  // A whole row moves together. Sorting one column while leaving the others behind would scramble
  // the table, which is the classic spreadsheet disaster this game should never teach.
  ordered.forEach((sourceRow, index) => {
    const targetRow = rows[index];

    for (let column = 0; column < grid.colCount; column += 1) {
      const source = getCell(grid, { row: sourceRow, col: column });

      if (source === undefined) {
        continue;
      }

      const address = { row: targetRow, col: column };
      const moved: GridCell = { ...source, address };

      cells[cellKey(address)] = moved;
    }
  });

  return cells;
}

/**
 * Pure. Returns the same object when an action changes nothing, such as a click outside the grid,
 * so a stray click cannot clear a selection the player already made.
 */
export function gridReducer(state: GridState, action: GridAction): GridState {
  switch (action.kind) {
    case "select-cell": {
      if (!isCellInGrid(state, action.cell)) {
        return state;
      }

      return {
        ...state,
        activeCell: action.cell,
        selection: { kind: "cell", cell: action.cell },
      };
    }

    case "select-range": {
      const range = normalizeRange(action.range);

      if (!isCellInGrid(state, range.start) || !isCellInGrid(state, range.end)) {
        return state;
      }

      return {
        ...state,
        activeCell: range.start,
        selection: { kind: "range", range },
      };
    }

    case "select-row": {
      if (action.row < 0 || action.row >= state.rowCount) {
        return state;
      }

      return {
        ...state,
        activeCell: { row: action.row, col: 0 },
        selection: { kind: "row", row: action.row },
      };
    }

    case "select-column": {
      if (action.col < 0 || action.col >= state.colCount) {
        return state;
      }

      return {
        ...state,
        activeCell: { row: 0, col: action.col },
        selection: { kind: "column", col: action.col, usedRangeOnly: action.usedRangeOnly },
      };
    }

    case "set-format": {
      const range = normalizeRange(action.range);

      if (!isCellInGrid(state, range.start) || !isCellInGrid(state, range.end)) {
        return state;
      }

      const cells = { ...state.cells };

      for (let row = range.start.row; row <= range.end.row; row += 1) {
        for (let col = range.start.col; col <= range.end.col; col += 1) {
          const address = { row, col };
          const key = cellKey(address);
          const existing = cells[key];

          cells[key] = existing
            ? { ...existing, format: { ...existing.format, ...action.format } }
            : { address, value: { kind: "blank" }, format: { ...action.format } };
        }
      }

      return { ...state, cells };
    }

    case "sort-column": {
      if (action.col < 0 || action.col >= state.colCount) {
        return state;
      }

      const cells = sortCells(state, action.col, action.direction);
      const sortState = { col: action.col, direction: action.direction };

      return {
        ...state,
        cells,
        sortState,
        hiddenRows: hiddenRowsFor(state, cells, state.filters),
      };
    }

    case "filter-column": {
      if (action.col < 0 || action.col >= state.colCount) {
        return state;
      }

      const filter: FilterState = { col: action.col, op: action.op, value: action.value };
      const filters = [...state.filters.filter((existing) => existing.col !== action.col), filter];

      return {
        ...state,
        filters,
        hiddenRows: hiddenRowsFor(state, state.cells, filters),
      };
    }

    case "clear-filters": {
      if (state.filters.length === 0) {
        return state;
      }

      return { ...state, filters: [], hiddenRows: [] };
    }

    case "set-cell-value": {
      const { cell, value } = action;

      if (cell.row < 0 || cell.row >= state.rowCount || cell.col < 0 || cell.col >= state.colCount) {
        return state;
      }

      const key = cellKey(cell);
      const existing = state.cells[key];
      const current: CellValue = existing?.value ?? { kind: "blank" };

      if (JSON.stringify(current) === JSON.stringify(value)) {
        return state;
      }

      return {
        ...state,
        cells: {
          ...state.cells,
          [key]: { address: cell, value, format: existing?.format ?? {} },
        },
        activeCell: cell,
        selection: { kind: "cell", cell },
        usedRange: {
          start: {
            row: Math.min(state.usedRange.start.row, cell.row),
            col: Math.min(state.usedRange.start.col, cell.col),
          },
          end: {
            row: Math.max(state.usedRange.end.row, cell.row),
            col: Math.max(state.usedRange.end.col, cell.col),
          },
        },
      };
    }
  }
}

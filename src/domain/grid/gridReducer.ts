import type { CellAddress, GridAction, GridState } from "@/domain/grid/gridTypes";
import { normalizeRange } from "@/domain/grid/range";

function isCellInGrid(grid: GridState, cell: CellAddress): boolean {
  return cell.row >= 0 && cell.row < grid.rowCount && cell.col >= 0 && cell.col < grid.colCount;
}

/**
 * Pure. Returns the same object when an action lands outside the grid, so a stray
 * click cannot clear a selection the player already made.
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
  }
}

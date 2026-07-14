import type { GridCommandId } from "@/domain/commands/commandTypes";
import { comparableValue } from "@/domain/grid/cellValues";
import type { CellAddress, GridAction, GridState } from "@/domain/grid/gridTypes";
import { jumpActive, stepActive } from "@/domain/grid/keyboardNav";
import { normalizeRange } from "@/domain/grid/range";
import { dataRowBounds, getCell, isRangeBold, selectionBounds } from "@/domain/grid/selectors";

export type CommandContext = {
  grid: GridState;
  /**
   * The cell arrow/select-column/select-row commands act from. `SpreadsheetGrid` tracks this in a
   * ref rather than reading `grid.activeCell`, because the reducer normalises a range's start/end
   * and loses which end the player is moving (`gridReducer.ts`'s `select-range` case) — the same
   * fact that makes the route unrecoverable from `GridAction` alone once dispatched. A caller with
   * no independent tracking (the toolbar) passes `grid.activeCell` for both `focus` and `anchor`.
   */
  focus: CellAddress;
  /** The fixed end of a selection in progress. Only read by `EXTEND_*` and `DRAG_SELECT_RANGE`. */
  anchor: CellAddress;
};

/**
 * A data row's own value, or null when the cell is blank or in the header — Toolbar's filter guard,
 * in one place. Exported so `FilterMenu` can compute the same enablement without a third copy.
 */
export function filterableValue(grid: GridState, cell: CellAddress): string | number | null {
  const { first, last } = dataRowBounds(grid);

  if (cell.row < first || cell.row > last) {
    return null;
  }

  return comparableValue(getCell(grid, cell)?.value);
}

/**
 * The single place a semantic command becomes a `GridAction`. Reused unchanged by the keyboard
 * handler, the toolbar, and the pointer paths today; the Phase 4 route solver reuses it too, so
 * none of them can drift from what the others accept the way the hand-authored route notes have.
 * Returns null when the command has nothing to act on (an empty selection, a blank filter cell) —
 * the same conditions that disable the equivalent toolbar button today.
 */
export function resolveCommand(
  command: GridCommandId,
  context: CommandContext,
): GridAction | null {
  const { grid, focus, anchor } = context;

  switch (command) {
    case "MOVE_UP":
      return { kind: "select-cell", cell: stepActive(grid, focus, "up") };
    case "MOVE_DOWN":
      return { kind: "select-cell", cell: stepActive(grid, focus, "down") };
    case "MOVE_LEFT":
      return { kind: "select-cell", cell: stepActive(grid, focus, "left") };
    case "MOVE_RIGHT":
      return { kind: "select-cell", cell: stepActive(grid, focus, "right") };

    case "JUMP_UP":
      return { kind: "select-cell", cell: jumpActive(grid, focus, "up") };
    case "JUMP_DOWN":
      return { kind: "select-cell", cell: jumpActive(grid, focus, "down") };
    case "JUMP_LEFT":
      return { kind: "select-cell", cell: jumpActive(grid, focus, "left") };
    case "JUMP_RIGHT":
      return { kind: "select-cell", cell: jumpActive(grid, focus, "right") };

    case "EXTEND_UP":
      return {
        kind: "select-range",
        range: { start: anchor, end: stepActive(grid, focus, "up") },
      };
    case "EXTEND_DOWN":
      return {
        kind: "select-range",
        range: { start: anchor, end: stepActive(grid, focus, "down") },
      };
    case "EXTEND_LEFT":
      return {
        kind: "select-range",
        range: { start: anchor, end: stepActive(grid, focus, "left") },
      };
    case "EXTEND_RIGHT":
      return {
        kind: "select-range",
        range: { start: anchor, end: stepActive(grid, focus, "right") },
      };

    case "EXTEND_JUMP_UP":
      return {
        kind: "select-range",
        range: { start: anchor, end: jumpActive(grid, focus, "up") },
      };
    case "EXTEND_JUMP_DOWN":
      return {
        kind: "select-range",
        range: { start: anchor, end: jumpActive(grid, focus, "down") },
      };
    case "EXTEND_JUMP_LEFT":
      return {
        kind: "select-range",
        range: { start: anchor, end: jumpActive(grid, focus, "left") },
      };
    case "EXTEND_JUMP_RIGHT":
      return {
        kind: "select-range",
        range: { start: anchor, end: jumpActive(grid, focus, "right") },
      };

    case "SELECT_COLUMN":
      return { kind: "select-column", col: focus.col, usedRangeOnly: true };
    case "SELECT_ROW":
      return { kind: "select-row", row: focus.row };
    case "SELECT_TABLE":
      return { kind: "select-range", range: normalizeRange(grid.usedRange) };

    case "TOGGLE_BOLD": {
      const bounds = selectionBounds(grid);

      return bounds === null
        ? null
        : { kind: "set-format", range: bounds, format: { bold: !isRangeBold(grid, bounds) } };
    }
    // Deliberately not a toggle: the toolbar's Bold button always sets bold on, even when the
    // selection is already fully bold (which is why formatting.unbold-header has no mouse-only
    // solve — only TOGGLE_BOLD, keyboard-only, can unbold). See GridCommandId's doc comment.
    case "APPLY_BOLD": {
      const bounds = selectionBounds(grid);

      return bounds === null ? null : { kind: "set-format", range: bounds, format: { bold: true } };
    }
    case "FORMAT_CURRENCY": {
      const bounds = selectionBounds(grid);

      return bounds === null
        ? null
        : { kind: "set-format", range: bounds, format: { numberFormat: "currency" } };
    }
    case "FORMAT_PERCENT": {
      const bounds = selectionBounds(grid);

      return bounds === null
        ? null
        : { kind: "set-format", range: bounds, format: { numberFormat: "percent" } };
    }
    case "FORMAT_DATE": {
      const bounds = selectionBounds(grid);

      return bounds === null
        ? null
        : { kind: "set-format", range: bounds, format: { numberFormat: "date" } };
    }

    case "SORT_ASC":
      return { kind: "sort-column", col: focus.col, direction: "asc" };
    case "SORT_DESC":
      return { kind: "sort-column", col: focus.col, direction: "desc" };

    case "FILTER_TO_VALUE": {
      const value = filterableValue(grid, focus);

      return value === null
        ? null
        : { kind: "filter-column", col: focus.col, op: "equals", value };
    }
    case "FILTER_ABOVE_VALUE": {
      const value = filterableValue(grid, focus);

      return typeof value !== "number"
        ? null
        : { kind: "filter-column", col: focus.col, op: "greater-than", value };
    }
    case "CLEAR_FILTERS":
      return { kind: "clear-filters" };

    // A toggle, not a shared chord on FILTER_TO_VALUE/CLEAR_FILTERS: mod+Shift+L clears when
    // filters exist, else filters to the active cell's value — the same shape as TOGGLE_BOLD
    // (§1a.10), one physical input, a state-dependent action, reproducible from this context alone.
    case "TOGGLE_FILTER": {
      if (grid.filters.length > 0) {
        return { kind: "clear-filters" };
      }

      const value = filterableValue(grid, focus);

      return value === null
        ? null
        : { kind: "filter-column", col: focus.col, op: "equals", value };
    }

    case "CLICK_CELL":
      return { kind: "select-cell", cell: focus };
    case "CLICK_COLUMN_HEADER":
      return { kind: "select-column", col: focus.col, usedRangeOnly: true };
    case "CLICK_ROW_HEADER":
      return { kind: "select-row", row: focus.row };
    case "DRAG_SELECT_RANGE":
      return { kind: "select-range", range: { start: anchor, end: focus } };

    case "OPEN_FILTER_MENU":
      return null;
  }
}

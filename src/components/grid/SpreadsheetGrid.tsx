"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react";

import { CellView } from "@/components/grid/CellView";
import { ColumnHeader } from "@/components/grid/ColumnHeader";
import { RowHeader } from "@/components/grid/RowHeader";
import { SelectionOverlay } from "@/components/grid/SelectionOverlay";
import { getGridMetrics } from "@/components/grid/gridMetrics";
import type { ActionMeta, GridCommandId } from "@/domain/commands/commandTypes";
import { matchChord } from "@/domain/commands/keymap";
import { resolveCommand } from "@/domain/commands/resolveCommand";
import type {
  CellAddress,
  GridAction,
  GridActionKind,
  GridState,
} from "@/domain/grid/gridTypes";
import type { GridDensity, Settings } from "@/domain/settings/themes";
import { cellKey } from "@/domain/grid/range";
import { isCellSelected, renderedRows } from "@/domain/grid/selectors";

/** Commands whose action the challenge can disable, the same way the toolbar gates its buttons. */
const SET_FORMAT_COMMANDS = new Set<GridCommandId>([
  "TOGGLE_BOLD",
  "FORMAT_CURRENCY",
  "FORMAT_PERCENT",
  "FORMAT_DATE",
]);

/**
 * Mirrors the ref assignments `handleKeyDown` and the pointer handlers made inline before the
 * command layer existed. `select-column`/`select-row` deliberately echo the caller's `base`
 * rather than deriving `{row: 0, col}`/`{row, col: 0}` from the action, because a keyboard
 * shortcut (Ctrl+Space from row 3) and a header click (always row 0) disagree on what the anchor
 * should become afterward, and only the caller knows which one this is.
 */
function updateRefsForAction(
  action: GridAction,
  base: CellAddress,
  anchorRef: RefObject<CellAddress | null>,
  focusRef: RefObject<CellAddress | null>,
): void {
  switch (action.kind) {
    case "select-cell":
      anchorRef.current = action.cell;
      focusRef.current = action.cell;
      return;
    case "select-range":
      anchorRef.current = action.range.start;
      focusRef.current = action.range.end;
      return;
    case "select-column":
    case "select-row":
      anchorRef.current = base;
      focusRef.current = base;
      return;
    default:
      return;
  }
}

type SpreadsheetGridProps = {
  grid: GridState;
  onAction: (action: GridAction, meta: ActionMeta) => void;
  /**
   * The actions the current challenge allows, used to gate formatting shortcuts the way the
   * toolbar gates its buttons. Omitted means everything is allowed, which keeps the grid usable
   * on its own in tests.
   */
  allowedActions?: GridActionKind[];
  /** Lets the parent refocus the grid, so retry puts the player straight back on the keys. */
  focusRef?: RefObject<HTMLDivElement | null>;
  density?: GridDensity;
  gridlineStrength?: Settings["grid"]["gridlineStrength"];
  largeTargets?: boolean;
};

const GRIDLINE_CLASSES: Record<Settings["grid"]["gridlineStrength"], string> = {
  soft: "border-line/60",
  standard: "border-line",
  strong: "border-line-strong",
};

export function SpreadsheetGrid({
  grid,
  onAction,
  allowedActions,
  focusRef,
  density = "comfortable",
  gridlineStrength = "standard",
  largeTargets = false,
}: SpreadsheetGridProps) {
  // A run is an aiming test. Snapshot presentation on mount so a settings update cannot move a
  // target under the pointer or selection outline while that run is active.
  const [presentation] = useState(() => ({
    density,
    gridlineStrength,
    metrics: getGridMetrics(density, largeTargets),
  }));
  const gridlineClass = GRIDLINE_CLASSES[presentation.gridlineStrength];
  const anchorRef = useRef<CellAddress | null>(null);
  const draggedRef = useRef(false);

  /**
   * The two ends of the keyboard selection. The reducer normalizes a range so its `start` is the
   * top-left cell, which loses which end the player is moving. These refs remember it: `keyAnchor`
   * is the fixed end and `keyFocus` is the end the arrows move.
   */
  const keyAnchorRef = useRef<CellAddress | null>(null);
  const keyFocusRef = useRef<CellAddress | null>(null);

  const internalRef = useRef<HTMLDivElement | null>(null);
  const containerRef = focusRef ?? internalRef;

  // The grid is the game, so it takes focus as soon as it exists. Keyboard-only play must not
  // require a click first.
  useEffect(() => {
    containerRef.current?.focus({ preventScroll: true });
  }, [containerRef]);

  // A drag can end anywhere, including outside the grid or outside the window. Without this, letting
  // go off-grid would leave the anchor set and the next hover would keep extending the old range.
  useEffect(() => {
    const endDrag = () => {
      anchorRef.current = null;
    };

    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);

    return () => {
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, []);

  const startDrag = useCallback((cell: CellAddress) => {
    anchorRef.current = cell;
    draggedRef.current = false;
  }, []);

  const extendDrag = useCallback(
    (cell: CellAddress, event: PointerEvent<HTMLButtonElement>) => {
      const anchor = anchorRef.current;

      // `buttons` is the authority on whether the primary button is still held. Hovering with the
      // mouse up also fires pointerenter, and that must not paint a selection.
      if (anchor === null || event.buttons !== 1) {
        return;
      }

      if (anchor.row === cell.row && anchor.col === cell.col) {
        return;
      }

      draggedRef.current = true;

      const action = resolveCommand("DRAG_SELECT_RANGE", { grid, focus: cell, anchor });

      if (action === null) {
        return;
      }

      updateRefsForAction(action, cell, keyAnchorRef, keyFocusRef);
      onAction(action, {
        command: "DRAG_SELECT_RANGE",
        inputMethod: "pointer",
        via: "grid",
        chord: null,
        controlId: null,
      });
    },
    [grid, onAction],
  );

  const selectCell = useCallback(
    (cell: CellAddress) => {
      // A click always follows a drag's pointerup. Letting it through would collapse the range the
      // player just dragged back down to a single cell.
      if (draggedRef.current) {
        draggedRef.current = false;

        return;
      }

      const action = resolveCommand("CLICK_CELL", { grid, focus: cell, anchor: cell });

      if (action === null) {
        return;
      }

      updateRefsForAction(action, cell, keyAnchorRef, keyFocusRef);
      onAction(action, {
        command: "CLICK_CELL",
        inputMethod: "pointer",
        via: "grid",
        chord: null,
        controlId: null,
      });
    },
    [grid, onAction],
  );

  // Clicking a column header means "this column's data", the same as it does in Excel.
  const selectColumn = useCallback(
    (col: number) => {
      const base = { row: 0, col };
      const action = resolveCommand("CLICK_COLUMN_HEADER", { grid, focus: base, anchor: base });

      if (action === null) {
        return;
      }

      updateRefsForAction(action, base, keyAnchorRef, keyFocusRef);
      onAction(action, {
        command: "CLICK_COLUMN_HEADER",
        inputMethod: "pointer",
        via: "grid",
        chord: null,
        controlId: null,
      });
    },
    [grid, onAction],
  );

  const selectRow = useCallback(
    (row: number) => {
      const base = { row, col: 0 };
      const action = resolveCommand("CLICK_ROW_HEADER", { grid, focus: base, anchor: base });

      if (action === null) {
        return;
      }

      updateRefsForAction(action, base, keyAnchorRef, keyFocusRef);
      onAction(action, {
        command: "CLICK_ROW_HEADER",
        inputMethod: "pointer",
        via: "grid",
        chord: null,
        controlId: null,
      });
    },
    [grid, onAction],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const allows = (kind: GridActionKind) =>
        allowedActions === undefined || allowedActions.includes(kind);

      const match = matchChord(event);

      if (match === null) {
        return;
      }

      const { command, chord } = match;

      // Movement is never gated: it is how the player gets around. Only the set-format commands
      // can be disallowed, exactly as the toolbar's own buttons are — and, as before, a disallowed
      // chord is not prevented at all, so the browser is free to do whatever it would otherwise.
      if (SET_FORMAT_COMMANDS.has(command) && !allows("set-format")) {
        return;
      }

      event.preventDefault();

      const focus = keyFocusRef.current ?? grid.activeCell;
      const anchor = keyAnchorRef.current ?? grid.activeCell;
      const action = resolveCommand(command, { grid, focus, anchor });

      if (action === null) {
        return;
      }

      updateRefsForAction(action, focus, keyAnchorRef, keyFocusRef);
      onAction(action, {
        command,
        inputMethod: "keyboard",
        via: "shortcut",
        chord,
        controlId: null,
      });
    },
    [grid, onAction, allowedActions],
  );

  const isColumnSelected = (col: number) =>
    grid.selection.kind === "column" && grid.selection.col === col;

  const isRowSelected = (row: number) => grid.selection.kind === "row" && grid.selection.row === row;

  return (
    <div
      role="grid"
      aria-label="Spreadsheet"
      data-testid="spreadsheet-grid"
      data-density={presentation.density}
      data-gridline-strength={presentation.gridlineStrength}
      tabIndex={0}
      ref={containerRef}
      onKeyDown={handleKeyDown}
      className={`relative w-max touch-none overflow-hidden rounded-md border-t border-l ${gridlineClass} bg-canvas select-none`}
    >
      <div role="row" className="flex">
        <div
          aria-hidden
          className={`border-r border-b ${gridlineClass} bg-surface-raised`}
          style={{
            width: presentation.metrics.rowHeaderWidth,
            height: presentation.metrics.columnHeaderHeight,
          }}
        />
        {grid.columns.map((label, col) => (
          <ColumnHeader
            key={label}
            col={col}
            label={label}
            isSelected={isColumnSelected(col)}
            onSelect={selectColumn}
            metrics={presentation.metrics}
            gridlineClass={gridlineClass}
          />
        ))}
      </div>

      {renderedRows(grid).map((row) => (
        <div
          role="row"
          key={grid.rows[row]}
          className="flex"
          style={{ height: presentation.metrics.rowHeight }}
        >
          <RowHeader
            row={row}
            label={grid.rows[row]}
            isSelected={isRowSelected(row)}
            onSelect={selectRow}
            metrics={presentation.metrics}
            gridlineClass={gridlineClass}
          />
          {grid.columns.map((_, col) => (
            <CellView
              key={cellKey({ row, col })}
              row={row}
              col={col}
              cell={grid.cells[cellKey({ row, col })]}
              isSelected={isCellSelected(grid, { row, col })}
              isActive={grid.activeCell.row === row && grid.activeCell.col === col}
              onSelect={selectCell}
              onDragStart={startDrag}
              onDragOver={extendDrag}
              metrics={presentation.metrics}
              gridlineClass={gridlineClass}
            />
          ))}
        </div>
      ))}

      <SelectionOverlay grid={grid} metrics={presentation.metrics} />
    </div>
  );
}

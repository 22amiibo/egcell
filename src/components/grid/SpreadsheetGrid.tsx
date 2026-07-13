"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react";

import { CellView } from "@/components/grid/CellView";
import { ColumnHeader } from "@/components/grid/ColumnHeader";
import { RowHeader } from "@/components/grid/RowHeader";
import { SelectionOverlay } from "@/components/grid/SelectionOverlay";
import { COLUMN_HEADER_HEIGHT, ROW_HEADER_WIDTH, ROW_HEIGHT } from "@/components/grid/gridMetrics";
import type {
  CellAddress,
  GridAction,
  GridActionKind,
  GridState,
} from "@/domain/grid/gridTypes";
import { jumpActive, stepActive, type MoveDirection } from "@/domain/grid/keyboardNav";
import { cellKey, normalizeRange } from "@/domain/grid/range";
import { isCellSelected, isRangeBold, renderedRows, selectionBounds } from "@/domain/grid/selectors";

type SpreadsheetGridProps = {
  grid: GridState;
  onAction: (action: GridAction) => void;
  /**
   * The actions the current challenge allows, used to gate formatting shortcuts the way the
   * toolbar gates its buttons. Omitted means everything is allowed, which keeps the grid usable
   * on its own in tests.
   */
  allowedActions?: GridActionKind[];
  /** Lets the parent refocus the grid, so retry puts the player straight back on the keys. */
  focusRef?: RefObject<HTMLDivElement | null>;
};

const ARROW_DIRECTIONS: Record<string, MoveDirection> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

export function SpreadsheetGrid({ grid, onAction, allowedActions, focusRef }: SpreadsheetGridProps) {
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
      keyAnchorRef.current = anchor;
      keyFocusRef.current = cell;
      onAction({ kind: "select-range", range: { start: anchor, end: cell } });
    },
    [onAction],
  );

  const selectCell = useCallback(
    (cell: CellAddress) => {
      // A click always follows a drag's pointerup. Letting it through would collapse the range the
      // player just dragged back down to a single cell.
      if (draggedRef.current) {
        draggedRef.current = false;

        return;
      }

      keyAnchorRef.current = cell;
      keyFocusRef.current = cell;
      onAction({ kind: "select-cell", cell });
    },
    [onAction],
  );

  // Clicking a column header means "this column's data", the same as it does in Excel.
  const selectColumn = useCallback(
    (col: number) => {
      keyAnchorRef.current = { row: 0, col };
      keyFocusRef.current = { row: 0, col };
      onAction({ kind: "select-column", col, usedRangeOnly: true });
    },
    [onAction],
  );

  const selectRow = useCallback(
    (row: number) => {
      keyAnchorRef.current = { row, col: 0 };
      keyFocusRef.current = { row, col: 0 };
      onAction({ kind: "select-row", row });
    },
    [onAction],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const allows = (kind: GridActionKind) =>
        allowedActions === undefined || allowedActions.includes(kind);

      // Cmd on Mac and Ctrl elsewhere. Both are accepted everywhere, the way web spreadsheets do
      // it, so nothing has to sniff the platform.
      const mod = event.metaKey || event.ctrlKey;
      const base = keyFocusRef.current ?? grid.activeCell;

      const direction = ARROW_DIRECTIONS[event.key];

      if (direction !== undefined) {
        event.preventDefault();

        const target = mod ? jumpActive(grid, base, direction) : stepActive(grid, base, direction);

        if (event.shiftKey) {
          const anchor = keyAnchorRef.current ?? grid.activeCell;

          keyAnchorRef.current = anchor;
          keyFocusRef.current = target;
          onAction({ kind: "select-range", range: { start: anchor, end: target } });
        } else {
          keyAnchorRef.current = target;
          keyFocusRef.current = target;
          onAction({ kind: "select-cell", cell: target });
        }

        return;
      }

      if (event.key === " " || event.code === "Space") {
        // Excel: Ctrl+Space selects the column, Shift+Space selects the row.
        if (event.ctrlKey && !event.shiftKey) {
          event.preventDefault();
          keyAnchorRef.current = base;
          keyFocusRef.current = base;
          onAction({ kind: "select-column", col: base.col, usedRangeOnly: true });
        } else if (event.shiftKey && !event.ctrlKey) {
          event.preventDefault();
          keyAnchorRef.current = base;
          keyFocusRef.current = base;
          onAction({ kind: "select-row", row: base.row });
        }

        return;
      }

      const key = event.key.toLowerCase();

      if (mod && key === "a") {
        // Select the whole table, Excel's Ctrl+A from inside a table.
        event.preventDefault();

        const used = normalizeRange(grid.usedRange);

        keyAnchorRef.current = used.start;
        keyFocusRef.current = used.end;
        onAction({ kind: "select-range", range: used });

        return;
      }

      if (mod && key === "b" && allows("set-format")) {
        event.preventDefault();

        const bounds = selectionBounds(grid);

        if (bounds !== null) {
          // A toggle, as in Excel: an already fully bold selection unbolds.
          onAction({ kind: "set-format", range: bounds, format: { bold: !isRangeBold(grid, bounds) } });
        }

        return;
      }

      // Excel: Ctrl+Shift+4 is currency, Ctrl+Shift+5 is percent. With Shift held, a US layout
      // reports "$" and "%", other layouts report the digit, so both spellings are accepted.
      if (mod && event.shiftKey && (event.key === "$" || event.key === "4") && allows("set-format")) {
        event.preventDefault();

        const bounds = selectionBounds(grid);

        if (bounds !== null) {
          onAction({ kind: "set-format", range: bounds, format: { numberFormat: "currency" } });
        }

        return;
      }

      if (mod && event.shiftKey && (event.key === "%" || event.key === "5") && allows("set-format")) {
        event.preventDefault();

        const bounds = selectionBounds(grid);

        if (bounds !== null) {
          onAction({ kind: "set-format", range: bounds, format: { numberFormat: "percent" } });
        }
      }
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
      tabIndex={0}
      ref={containerRef}
      onKeyDown={handleKeyDown}
      className="relative w-max touch-none overflow-hidden rounded-md border-t border-l border-line bg-canvas select-none"
    >
      <div role="row" className="flex">
        <div
          aria-hidden
          className="border-r border-b border-line bg-surface-raised"
          style={{ width: ROW_HEADER_WIDTH, height: COLUMN_HEADER_HEIGHT }}
        />
        {grid.columns.map((label, col) => (
          <ColumnHeader
            key={label}
            col={col}
            label={label}
            isSelected={isColumnSelected(col)}
            onSelect={selectColumn}
          />
        ))}
      </div>

      {renderedRows(grid).map((row) => (
        <div role="row" key={grid.rows[row]} className="flex" style={{ height: ROW_HEIGHT }}>
          <RowHeader
            row={row}
            label={grid.rows[row]}
            isSelected={isRowSelected(row)}
            onSelect={selectRow}
          />
          {grid.columns.map((_, col) => {
            const address = { row, col };

            return (
              <CellView
                key={cellKey(address)}
                address={address}
                cell={grid.cells[cellKey(address)]}
                isSelected={isCellSelected(grid, address)}
                isActive={grid.activeCell.row === row && grid.activeCell.col === col}
                onSelect={selectCell}
                onDragStart={startDrag}
                onDragOver={extendDrag}
              />
            );
          })}
        </div>
      ))}

      <SelectionOverlay grid={grid} />
    </div>
  );
}

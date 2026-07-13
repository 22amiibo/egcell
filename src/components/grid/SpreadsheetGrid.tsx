"use client";

import { useCallback, useEffect, useRef, type PointerEvent } from "react";

import { CellView } from "@/components/grid/CellView";
import { ColumnHeader } from "@/components/grid/ColumnHeader";
import { RowHeader } from "@/components/grid/RowHeader";
import { SelectionOverlay } from "@/components/grid/SelectionOverlay";
import { COLUMN_HEADER_HEIGHT, ROW_HEADER_WIDTH, ROW_HEIGHT } from "@/components/grid/gridMetrics";
import type { CellAddress, GridAction, GridState } from "@/domain/grid/gridTypes";
import { cellKey } from "@/domain/grid/range";
import { isCellSelected, renderedRows } from "@/domain/grid/selectors";

type SpreadsheetGridProps = {
  grid: GridState;
  onAction: (action: GridAction) => void;
};

export function SpreadsheetGrid({ grid, onAction }: SpreadsheetGridProps) {
  const anchorRef = useRef<CellAddress | null>(null);
  const draggedRef = useRef(false);

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

      onAction({ kind: "select-cell", cell });
    },
    [onAction],
  );

  // Clicking a column header means "this column's data", the same as it does in Excel.
  const selectColumn = useCallback(
    (col: number) => onAction({ kind: "select-column", col, usedRangeOnly: true }),
    [onAction],
  );

  const selectRow = useCallback((row: number) => onAction({ kind: "select-row", row }), [onAction]);

  const isColumnSelected = (col: number) =>
    grid.selection.kind === "column" && grid.selection.col === col;

  const isRowSelected = (row: number) => grid.selection.kind === "row" && grid.selection.row === row;

  return (
    <div
      role="grid"
      aria-label="Spreadsheet"
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

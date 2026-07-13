"use client";

import { useCallback } from "react";

import { CellView } from "@/components/grid/CellView";
import { ColumnHeader } from "@/components/grid/ColumnHeader";
import { RowHeader } from "@/components/grid/RowHeader";
import { SelectionOverlay } from "@/components/grid/SelectionOverlay";
import { COLUMN_HEADER_HEIGHT, ROW_HEADER_WIDTH, ROW_HEIGHT } from "@/components/grid/gridMetrics";
import type { CellAddress, GridAction, GridState } from "@/domain/grid/gridTypes";
import { cellKey } from "@/domain/grid/range";
import { isCellSelected } from "@/domain/grid/selectors";

type SpreadsheetGridProps = {
  grid: GridState;
  onAction: (action: GridAction) => void;
};

export function SpreadsheetGrid({ grid, onAction }: SpreadsheetGridProps) {
  const selectCell = useCallback(
    (cell: CellAddress) => onAction({ kind: "select-cell", cell }),
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
      className="relative w-max overflow-hidden rounded-md border-t border-l border-line bg-canvas select-none"
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

      {grid.rows.map((label, row) => (
        <div role="row" key={label} className="flex" style={{ height: ROW_HEIGHT }}>
          <RowHeader row={row} label={label} isSelected={isRowSelected(row)} onSelect={selectRow} />
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
              />
            );
          })}
        </div>
      ))}

      <SelectionOverlay grid={grid} />
    </div>
  );
}

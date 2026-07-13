"use client";

import { COL_WIDTH, ROW_HEIGHT, cellLeft, cellTop } from "@/components/grid/gridMetrics";
import type { GridState } from "@/domain/grid/gridTypes";
import { renderedRowIndex, renderedRows, selectionBounds } from "@/domain/grid/selectors";

/**
 * Draws one border around the whole selection, the way a spreadsheet does, rather than outlining
 * every cell. It is absolutely positioned and ignores pointer events, so it can neither change the
 * grid's layout nor swallow a click meant for a cell.
 *
 * It is positioned by where rows are drawn, not by their index, because a filter can hide rows
 * above the selection. Positioning by index would slide the box down the page by one row height for
 * every row that had been hidden.
 */
export function SelectionOverlay({ grid }: { grid: GridState }) {
  const bounds = selectionBounds(grid);

  if (bounds === null) {
    return null;
  }

  const visible = renderedRows(grid).filter(
    (row) => row >= bounds.start.row && row <= bounds.end.row,
  );

  // Everything the player selected has since been filtered away. There is nothing to outline.
  if (visible.length === 0) {
    return null;
  }

  const firstDrawnRow = renderedRowIndex(grid, visible[0]);
  const lastDrawnRow = renderedRowIndex(grid, visible[visible.length - 1]);

  if (firstDrawnRow === null || lastDrawnRow === null) {
    return null;
  }

  const left = cellLeft(bounds.start.col);
  const top = cellTop(firstDrawnRow);
  const width = (bounds.end.col - bounds.start.col + 1) * COL_WIDTH;
  const height = (lastDrawnRow - firstDrawnRow + 1) * ROW_HEIGHT;

  return (
    <div
      aria-hidden
      data-testid="selection-overlay"
      className="pointer-events-none absolute border-2 border-accent-strong"
      style={{ left, top, width, height }}
    />
  );
}

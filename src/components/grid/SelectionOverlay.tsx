"use client";

import { COL_WIDTH, ROW_HEIGHT, cellLeft, cellTop } from "@/components/grid/gridMetrics";
import type { GridState } from "@/domain/grid/gridTypes";
import { selectionBounds } from "@/domain/grid/selectors";

/**
 * Draws one border around the whole selection, the way a spreadsheet does, rather than outlining
 * every cell. It is absolutely positioned and ignores pointer events, so it can neither change the
 * grid's layout nor swallow a click meant for a cell.
 */
export function SelectionOverlay({ grid }: { grid: GridState }) {
  const bounds = selectionBounds(grid);

  if (bounds === null) {
    return null;
  }

  const left = cellLeft(bounds.start.col);
  const top = cellTop(bounds.start.row);
  const width = (bounds.end.col - bounds.start.col + 1) * COL_WIDTH;
  const height = (bounds.end.row - bounds.start.row + 1) * ROW_HEIGHT;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute border-2 border-accent-strong"
      style={{ left, top, width, height }}
    />
  );
}

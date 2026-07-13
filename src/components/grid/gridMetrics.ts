import type { GridDensity } from "@/domain/settings/themes";

/** One immutable set of pixel dimensions shared by cells, headers, and the selection overlay. */
export type GridMetrics = {
  colWidth: number;
  rowHeight: number;
  rowHeaderWidth: number;
  columnHeaderHeight: number;
};

const DENSITY_METRICS: Record<GridDensity, GridMetrics> = {
  compact: { colWidth: 96, rowHeight: 26, rowHeaderWidth: 40, columnHeaderHeight: 26 },
  comfortable: { colWidth: 104, rowHeight: 32, rowHeaderWidth: 44, columnHeaderHeight: 30 },
  large: { colWidth: 116, rowHeight: 40, rowHeaderWidth: 48, columnHeaderHeight: 36 },
};

/**
 * Large targets are an accessibility floor, not a fourth density. A compact layout can retain
 * its setting while still meeting the same target size as the large preset.
 */
export function getGridMetrics(density: GridDensity, largeTargets: boolean): GridMetrics {
  const metrics = DENSITY_METRICS[density];

  if (!largeTargets) {
    return metrics;
  }

  const floor = DENSITY_METRICS.large;

  return {
    colWidth: Math.max(metrics.colWidth, floor.colWidth),
    rowHeight: Math.max(metrics.rowHeight, floor.rowHeight),
    rowHeaderWidth: Math.max(metrics.rowHeaderWidth, floor.rowHeaderWidth),
    columnHeaderHeight: Math.max(metrics.columnHeaderHeight, floor.columnHeaderHeight),
  };
}

export function cellLeft(metrics: GridMetrics, col: number): number {
  return metrics.rowHeaderWidth + col * metrics.colWidth;
}

export function cellTop(metrics: GridMetrics, row: number): number {
  return metrics.columnHeaderHeight + row * metrics.rowHeight;
}

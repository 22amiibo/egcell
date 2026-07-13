"use client";

import { memo, type PointerEvent } from "react";

import type { GridMetrics } from "@/components/grid/gridMetrics";
import type { CellAddress, GridCell } from "@/domain/grid/gridTypes";
import { columnLabel } from "@/domain/grid/range";
import { formatCellValue, isNumericValue } from "@/lib/format";

type CellViewProps = {
  /**
   * Primitives on purpose. An `address` object would be a fresh reference on every parent render,
   * and the memo below compares props shallowly: with keyboard play dispatching on every
   * keystroke, that one object prop would re-render the whole grid per key.
   */
  row: number;
  col: number;
  cell: GridCell | undefined;
  isSelected: boolean;
  isActive: boolean;
  onSelect: (address: CellAddress) => void;
  onDragStart: (address: CellAddress) => void;
  onDragOver: (address: CellAddress, event: PointerEvent<HTMLButtonElement>) => void;
  metrics: GridMetrics;
  gridlineClass: string;
};

function CellViewComponent({
  row,
  col,
  cell,
  isSelected,
  isActive,
  onSelect,
  onDragStart,
  onDragOver,
  metrics,
  gridlineClass,
}: CellViewProps) {
  const value = cell?.value ?? { kind: "blank" as const };
  const format = cell?.format ?? {};
  const text = formatCellValue(value, format);

  return (
    <button
      type="button"
      aria-label={`${columnLabel(col)}${row + 1}`}
      aria-pressed={isSelected}
      onClick={() => onSelect({ row, col })}
      onPointerDown={() => onDragStart({ row, col })}
      onPointerEnter={(event) => onDragOver({ row, col }, event)}
      style={{ width: metrics.colWidth, height: metrics.rowHeight }}
      className={[
        "truncate border-r border-b px-2 text-[13px] tabular-nums",
        gridlineClass,
        isNumericValue(value) ? "text-right" : "text-left",
        format.bold ? "font-semibold text-ink" : "text-ink/90",
        format.numberFormat === "currency" ? "text-accent-strong/90" : "",
        isSelected ? "bg-accent/15" : "bg-surface hover:bg-surface-raised",
        isActive ? "ring-1 ring-accent-strong ring-inset" : "",
      ].join(" ")}
    >
      {text}
    </button>
  );
}

export const CellView = memo(CellViewComponent);

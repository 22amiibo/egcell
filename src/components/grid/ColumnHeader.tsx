"use client";

import { memo } from "react";

import type { GridMetrics } from "@/components/grid/gridMetrics";

type ColumnHeaderProps = {
  col: number;
  label: string;
  isSelected: boolean;
  onSelect: (col: number) => void;
  metrics: GridMetrics;
  gridlineClass: string;
};

function ColumnHeaderComponent({
  col,
  label,
  isSelected,
  onSelect,
  metrics,
  gridlineClass,
}: ColumnHeaderProps) {
  return (
    <button
      type="button"
      aria-label={`Select column ${label}`}
      aria-pressed={isSelected}
      onClick={() => onSelect(col)}
      style={{ width: metrics.colWidth, height: metrics.columnHeaderHeight }}
      className={[
        "border-r border-b text-[12px] font-medium",
        gridlineClass,
        isSelected
          ? "bg-accent/25 text-ink"
          : "bg-surface-raised text-muted hover:bg-line hover:text-ink",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

export const ColumnHeader = memo(ColumnHeaderComponent);

"use client";

import { memo } from "react";

import type { GridMetrics } from "@/components/grid/gridMetrics";

type RowHeaderProps = {
  row: number;
  label: number;
  isSelected: boolean;
  onSelect: (row: number) => void;
  metrics: GridMetrics;
  gridlineClass: string;
};

function RowHeaderComponent({
  row,
  label,
  isSelected,
  onSelect,
  metrics,
  gridlineClass,
}: RowHeaderProps) {
  return (
    <button
      type="button"
      aria-label={`Select row ${label}`}
      aria-pressed={isSelected}
      onClick={() => onSelect(row)}
      style={{ width: metrics.rowHeaderWidth, height: metrics.rowHeight }}
      className={[
        "border-r border-b text-[12px] font-medium tabular-nums",
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

export const RowHeader = memo(RowHeaderComponent);

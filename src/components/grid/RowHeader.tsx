"use client";

import { memo } from "react";

import { ROW_HEADER_WIDTH, ROW_HEIGHT } from "@/components/grid/gridMetrics";

type RowHeaderProps = {
  row: number;
  label: number;
  isSelected: boolean;
  onSelect: (row: number) => void;
};

function RowHeaderComponent({ row, label, isSelected, onSelect }: RowHeaderProps) {
  return (
    <button
      type="button"
      aria-label={`Select row ${label}`}
      aria-pressed={isSelected}
      onClick={() => onSelect(row)}
      style={{ width: ROW_HEADER_WIDTH, height: ROW_HEIGHT }}
      className={[
        "border-r border-b border-line text-[12px] font-medium tabular-nums",
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

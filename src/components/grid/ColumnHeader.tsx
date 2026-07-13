"use client";

import { memo } from "react";

import { COL_WIDTH, COLUMN_HEADER_HEIGHT } from "@/components/grid/gridMetrics";

type ColumnHeaderProps = {
  col: number;
  label: string;
  isSelected: boolean;
  onSelect: (col: number) => void;
};

function ColumnHeaderComponent({ col, label, isSelected, onSelect }: ColumnHeaderProps) {
  return (
    <button
      type="button"
      aria-label={`Select column ${label}`}
      aria-pressed={isSelected}
      onClick={() => onSelect(col)}
      style={{ width: COL_WIDTH, height: COLUMN_HEADER_HEIGHT }}
      className={[
        "border-r border-b border-line text-[12px] font-medium",
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

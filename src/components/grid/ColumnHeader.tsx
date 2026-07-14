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
  /**
   * Only the active column ever sets this — `FilterMenu` always acts on the active cell (plan
   * §1a.10), so a caret on another column would open a menu that doesn't operate on the column
   * it's attached to.
   */
  showFilterCaret: boolean;
  onOpenFilterMenu: () => void;
};

function ColumnHeaderComponent({
  col,
  label,
  isSelected,
  onSelect,
  metrics,
  gridlineClass,
  showFilterCaret,
  onOpenFilterMenu,
}: ColumnHeaderProps) {
  return (
    <div
      style={{ width: metrics.colWidth, height: metrics.columnHeaderHeight }}
      className={[
        "flex border-r border-b",
        gridlineClass,
        isSelected ? "bg-accent/25" : "bg-surface-raised",
      ].join(" ")}
    >
      <button
        type="button"
        aria-label={`Select column ${label}`}
        aria-pressed={isSelected}
        onClick={() => onSelect(col)}
        className={[
          "flex-1 text-[12px] font-medium",
          isSelected ? "text-ink" : "text-muted hover:bg-line hover:text-ink",
        ].join(" ")}
      >
        {label}
      </button>
      {showFilterCaret && (
        <button
          type="button"
          aria-label="Sort and filter"
          title="Sort and filter"
          onClick={onOpenFilterMenu}
          className="px-1 text-[10px] text-muted hover:bg-line hover:text-ink"
        >
          ▾
        </button>
      )}
    </div>
  );
}

export const ColumnHeader = memo(ColumnHeaderComponent);

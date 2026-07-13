"use client";

import { memo, type PointerEvent } from "react";

import { COL_WIDTH, ROW_HEIGHT } from "@/components/grid/gridMetrics";
import type { CellAddress, GridCell } from "@/domain/grid/gridTypes";
import { columnLabel } from "@/domain/grid/range";
import { formatCellValue, isNumericValue } from "@/lib/format";

type CellViewProps = {
  address: CellAddress;
  cell: GridCell | undefined;
  isSelected: boolean;
  isActive: boolean;
  onSelect: (address: CellAddress) => void;
  onDragStart: (address: CellAddress) => void;
  onDragOver: (address: CellAddress, event: PointerEvent<HTMLButtonElement>) => void;
};

function CellViewComponent({
  address,
  cell,
  isSelected,
  isActive,
  onSelect,
  onDragStart,
  onDragOver,
}: CellViewProps) {
  const value = cell?.value ?? { kind: "blank" as const };
  const format = cell?.format ?? {};
  const text = formatCellValue(value, format);

  return (
    <button
      type="button"
      aria-label={`${columnLabel(address.col)}${address.row + 1}`}
      aria-pressed={isSelected}
      onClick={() => onSelect(address)}
      onPointerDown={() => onDragStart(address)}
      onPointerEnter={(event) => onDragOver(address, event)}
      style={{ width: COL_WIDTH, height: ROW_HEIGHT }}
      className={[
        "truncate border-r border-b border-line px-2 text-[13px] tabular-nums",
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

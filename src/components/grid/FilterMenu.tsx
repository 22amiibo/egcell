"use client";

import type { CSSProperties } from "react";

import { FILTER_MENU_COMMANDS } from "@/domain/commands/commandRegistry";
import type { GridCommandId } from "@/domain/commands/commandTypes";
import { filterableValue } from "@/domain/commands/resolveCommand";
import type { GridActionKind, GridState } from "@/domain/grid/gridTypes";

export type FilterMenuOption = {
  command: GridCommandId;
  label: string;
};

/** Rendering order — Excel's own dropdown order (sort, then filter, then clear). */
const MENU_ORDER = [...FILTER_MENU_COMMANDS];

function formatFilterValue(value: string | number): string {
  return typeof value === "number" ? String(value) : `"${value}"`;
}

/**
 * The options `FilterMenu` would show for the given grid/permission state, computed without
 * rendering anything. `SpreadsheetGrid` needs this list itself, to know how many items exist for
 * arrow-key clamping and to decide whether `Alt+↓` should open the menu at all.
 *
 * Every option is scoped to `grid.activeCell`, exactly like the toolbar's own sort/filter buttons —
 * a header caret opens this same menu without retargeting it to a different column (§1a.10).
 */
export function filterMenuOptions(
  grid: GridState,
  allows: (kind: GridActionKind) => boolean,
): FilterMenuOption[] {
  const value = filterableValue(grid, grid.activeCell);
  const options: FilterMenuOption[] = [];

  for (const command of MENU_ORDER) {
    switch (command) {
      case "SORT_ASC":
        if (allows("sort-column")) {
          options.push({ command, label: "Sort A to Z" });
        }
        break;
      case "SORT_DESC":
        if (allows("sort-column")) {
          options.push({ command, label: "Sort Z to A" });
        }
        break;
      case "FILTER_TO_VALUE":
        if (allows("filter-column") && value !== null) {
          options.push({ command, label: `Filter to ${formatFilterValue(value)}` });
        }
        break;
      case "FILTER_ABOVE_VALUE":
        if (allows("filter-column") && typeof value === "number") {
          options.push({ command, label: `Filter above ${value}` });
        }
        break;
      case "CLEAR_FILTERS":
        if (allows("clear-filters") && grid.filters.length > 0) {
          options.push({ command, label: "Clear filters" });
        }
        break;
    }
  }

  return options;
}

type FilterMenuProps = {
  options: FilterMenuOption[];
  highlightedIndex: number;
  style?: CSSProperties;
};

/**
 * A pure listbox: no focus and no keydown handling of its own. `SpreadsheetGrid` owns the
 * open/highlight state and intercepts arrows/Enter/Escape in its existing `handleKeyDown`, so DOM
 * focus never leaves the grid while the menu is open (§1a.10) — this component only reflects props.
 */
export function FilterMenu({ options, highlightedIndex, style }: FilterMenuProps) {
  return (
    <div
      role="listbox"
      aria-label="Sort and filter"
      style={style}
      className="absolute z-30 min-w-40 rounded-md border border-line bg-surface-raised py-1 shadow-md"
    >
      {options.map((option, index) => (
        <div
          key={option.command}
          role="option"
          aria-selected={index === highlightedIndex}
          className={[
            "px-3 py-1 text-[12px]",
            index === highlightedIndex ? "bg-accent/25 text-ink" : "text-muted",
          ].join(" ")}
        >
          {option.label}
        </div>
      ))}
    </div>
  );
}

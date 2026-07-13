"use client";

import type { Challenge } from "@/domain/challenges/challengeTypes";
import { comparableValue } from "@/domain/grid/cellValues";
import type { GridAction, GridActionKind, GridState } from "@/domain/grid/gridTypes";
import { getCell, selectionBounds } from "@/domain/grid/selectors";

type ToolbarProps = {
  challenge: Challenge;
  grid: GridState;
  onAction: (action: GridAction) => void;
};

function ToolbarButton({
  label,
  title,
  onClick,
  disabled,
}: {
  label: string;
  title: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className="rounded border border-line bg-surface px-2.5 py-1 text-[12px] font-medium text-ink transition-colors hover:bg-surface-raised disabled:cursor-not-allowed disabled:text-muted/50 disabled:hover:bg-surface"
    >
      {label}
    </button>
  );
}

/**
 * Only the actions a challenge allows are offered. A selection challenge therefore renders no
 * toolbar at all, which keeps the surface honest: a control the challenge cannot use never appears.
 */
export function Toolbar({ challenge, grid, onAction }: ToolbarProps) {
  const allows = (kind: GridActionKind) => challenge.allowedActions.includes(kind);

  const canFormat = allows("set-format");
  const canSort = allows("sort-column");
  const canFilter = allows("filter-column");

  if (!canFormat && !canSort && !canFilter) {
    return null;
  }

  const bounds = selectionBounds(grid);
  const filterValue = comparableValue(getCell(grid, grid.activeCell)?.value);

  return (
    <div
      role="toolbar"
      aria-label="Spreadsheet tools"
      className="flex items-center gap-1.5 rounded-md border border-line bg-surface-raised px-2 py-1.5"
    >
      {canFormat && (
        <>
          <ToolbarButton
            label="B"
            title="Bold"
            disabled={bounds === null}
            onClick={() =>
              bounds && onAction({ kind: "set-format", range: bounds, format: { bold: true } })
            }
          />
          <ToolbarButton
            label="$"
            title="Format as currency"
            disabled={bounds === null}
            onClick={() =>
              bounds &&
              onAction({ kind: "set-format", range: bounds, format: { numberFormat: "currency" } })
            }
          />
          <ToolbarButton
            label="%"
            title="Format as percent"
            disabled={bounds === null}
            onClick={() =>
              bounds &&
              onAction({ kind: "set-format", range: bounds, format: { numberFormat: "percent" } })
            }
          />
        </>
      )}

      {canSort && (
        <>
          <ToolbarButton
            label="A to Z"
            title="Sort low to high"
            disabled={false}
            onClick={() =>
              onAction({ kind: "sort-column", col: grid.activeCell.col, direction: "asc" })
            }
          />
          <ToolbarButton
            label="Z to A"
            title="Sort high to low"
            disabled={false}
            onClick={() =>
              onAction({ kind: "sort-column", col: grid.activeCell.col, direction: "desc" })
            }
          />
        </>
      )}

      {canFilter && (
        <>
          <ToolbarButton
            label="Filter"
            title="Filter to the selected value"
            // Excel's "filter by selected cell's value". A blank cell has nothing to filter to.
            disabled={filterValue === null}
            onClick={() =>
              filterValue !== null &&
              onAction({
                kind: "filter-column",
                col: grid.activeCell.col,
                op: "equals",
                value: filterValue,
              })
            }
          />
          <ToolbarButton
            label="Filter >"
            title="Filter above the selected value"
            // A threshold only means something for a number.
            disabled={typeof filterValue !== "number"}
            onClick={() =>
              typeof filterValue === "number" &&
              onAction({
                kind: "filter-column",
                col: grid.activeCell.col,
                op: "greater-than",
                value: filterValue,
              })
            }
          />
          <ToolbarButton
            label="Clear"
            title="Clear filters"
            disabled={grid.filters.length === 0}
            onClick={() => onAction({ kind: "clear-filters" })}
          />
        </>
      )}
    </div>
  );
}

"use client";

import type { RefObject } from "react";

import type { Challenge } from "@/domain/challenges/challengeTypes";
import type { ActionMeta, GridCommandId } from "@/domain/commands/commandTypes";
import { resolveCommand } from "@/domain/commands/resolveCommand";
import { comparableValue } from "@/domain/grid/cellValues";
import type { GridAction, GridActionKind, GridState } from "@/domain/grid/gridTypes";
import { dataRowBounds, getCell, selectionBounds } from "@/domain/grid/selectors";

type ToolbarProps = {
  challenge: Challenge;
  grid: GridState;
  onAction: (action: GridAction, meta: ActionMeta) => void;
  /**
   * Native toolbar buttons steal DOM focus from the grid (§2.3 fact 3 of the plan) — a hybrid route
   * would otherwise go dead the moment a player touches the toolbar. Omitted in tests, where there
   * is no grid to refocus.
   */
  gridFocusRef?: RefObject<HTMLDivElement | null>;
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
export function Toolbar({ challenge, grid, onAction, gridFocusRef }: ToolbarProps) {
  const allows = (kind: GridActionKind) => challenge.allowedActions.includes(kind);

  const canFormat = allows("set-format");
  const canSort = allows("sort-column");
  const canFilter = allows("filter-column");

  if (!canFormat && !canSort && !canFilter) {
    return null;
  }

  const bounds = selectionBounds(grid);

  // A filter is anchored to the selected cell's value, the way Excel's "filter by selected cell's
  // value" is. A header cell is not data: filtering to "Status" hides every row, which reads as the
  // table being wiped rather than filtered. Only a data cell can anchor a filter.
  const { first, last } = dataRowBounds(grid);
  const anchor = grid.activeCell;
  const anchorIsData = anchor.row >= first && anchor.row <= last;
  const filterValue = anchorIsData ? comparableValue(getCell(grid, anchor)?.value) : null;

  const filterHint = !anchorIsData
    ? "Filter uses the selected cell — click a cell below the header."
    : filterValue === null
      ? "That cell is blank — click a cell holding the value to filter by."
      : null;

  // The toolbar has no anchor/focus of its own — every command acts on wherever the active cell
  // already is, exactly as `resolveCommand`'s guards (a blank filter cell, an empty selection)
  // already expect from a caller with no independent tracking.
  const emit = (command: GridCommandId, controlId: string) => {
    const action = resolveCommand(command, {
      grid,
      focus: grid.activeCell,
      anchor: grid.activeCell,
    });

    if (action !== null) {
      onAction(action, { command, inputMethod: "pointer", via: "toolbar", chord: null, controlId });
      gridFocusRef?.current?.focus({ preventScroll: true });
    }
  };

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
            // Unlike Ctrl+B (TOGGLE_BOLD), this always sets bold on rather than toggling it — a
            // genuinely different operation, tagged APPLY_BOLD so a route replay reaches the same
            // state the click actually produced (formatting.unbold-header has no mouse-only solve
            // because of exactly this; see the plan's §1a.9/§7.5/§12).
            onClick={() => emit("APPLY_BOLD", "toolbar-bold")}
          />
          <ToolbarButton
            label="$"
            title="Format as currency"
            disabled={bounds === null}
            onClick={() => emit("FORMAT_CURRENCY", "toolbar-currency")}
          />
          <ToolbarButton
            label="%"
            title="Format as percent"
            disabled={bounds === null}
            onClick={() => emit("FORMAT_PERCENT", "toolbar-percent")}
          />
          <ToolbarButton
            label="Date"
            title="Format as date"
            disabled={bounds === null}
            onClick={() => emit("FORMAT_DATE", "toolbar-date")}
          />
        </>
      )}

      {canSort && (
        <>
          <ToolbarButton
            label="A to Z"
            title="Sort low to high"
            disabled={false}
            onClick={() => emit("SORT_ASC", "toolbar-sort-asc")}
          />
          <ToolbarButton
            label="Z to A"
            title="Sort high to low"
            disabled={false}
            onClick={() => emit("SORT_DESC", "toolbar-sort-desc")}
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
            onClick={() => emit("FILTER_TO_VALUE", "toolbar-filter-equals")}
          />
          <ToolbarButton
            label="Filter >"
            title="Filter above the selected value"
            // A threshold only means something for a number.
            disabled={typeof filterValue !== "number"}
            onClick={() => emit("FILTER_ABOVE_VALUE", "toolbar-filter-above")}
          />
          <ToolbarButton
            label="Clear"
            title="Clear filters"
            disabled={grid.filters.length === 0}
            onClick={() => emit("CLEAR_FILTERS", "toolbar-clear-filters")}
          />
          {filterHint !== null && (
            <span data-testid="filter-hint" className="pl-1 text-[11px] text-muted">
              {filterHint}
            </span>
          )}
        </>
      )}
    </div>
  );
}

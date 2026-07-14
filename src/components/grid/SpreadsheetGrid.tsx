"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react";

import { CellView } from "@/components/grid/CellView";
import { ColumnHeader } from "@/components/grid/ColumnHeader";
import { FilterMenu, filterMenuOptions } from "@/components/grid/FilterMenu";
import { RowHeader } from "@/components/grid/RowHeader";
import { SelectionOverlay } from "@/components/grid/SelectionOverlay";
import { cellLeft, getGridMetrics } from "@/components/grid/gridMetrics";
import type { ActionMeta, GridCommandId } from "@/domain/commands/commandTypes";
import { matchChord } from "@/domain/commands/keymap";
import { nextFocusAnchor, resolveCommand } from "@/domain/commands/resolveCommand";
import type {
  CellAddress,
  GridAction,
  GridActionKind,
  GridState,
} from "@/domain/grid/gridTypes";
import type { GridDensity, Settings } from "@/domain/settings/themes";
import { cellKey } from "@/domain/grid/range";
import { isCellSelected, renderedRows, visibleDataRows } from "@/domain/grid/selectors";

/** Commands whose action the challenge can disable, the same way the toolbar gates its buttons. */
const SET_FORMAT_COMMANDS = new Set<GridCommandId>([
  "TOGGLE_BOLD",
  "FORMAT_CURRENCY",
  "FORMAT_PERCENT",
  "FORMAT_DATE",
]);

/**
 * Writes the shared anchor/focus rule (`nextFocusAnchor`) into the refs this component tracks it
 * in. The rule itself lives in `resolveCommand.ts`, because the route solver must apply exactly the
 * same one: a route it proves has to reach the state a human pressing those keys actually reaches.
 */
function updateRefsForAction(
  action: GridAction,
  base: CellAddress,
  anchorRef: RefObject<CellAddress | null>,
  focusRef: RefObject<CellAddress | null>,
): void {
  const next = nextFocusAnchor(action, base, {
    focus: focusRef.current ?? base,
    anchor: anchorRef.current ?? base,
  });

  anchorRef.current = next.anchor;
  focusRef.current = next.focus;
}

type SpreadsheetGridProps = {
  grid: GridState;
  onAction: (action: GridAction, meta: ActionMeta) => void;
  /**
   * The actions the current challenge allows, used to gate formatting shortcuts the way the
   * toolbar gates its buttons. Omitted means everything is allowed, which keeps the grid usable
   * on its own in tests.
   */
  allowedActions?: GridActionKind[];
  /** Lets the parent refocus the grid, so retry puts the player straight back on the keys. */
  focusRef?: RefObject<HTMLDivElement | null>;
  density?: GridDensity;
  gridlineStrength?: Settings["grid"]["gridlineStrength"];
  largeTargets?: boolean;
  /**
   * Hotkey Mode at `ranked` strictness: pointer input on the grid is ignored, so the question of
   * whether a run was keyboard-pure cannot arise. Never set outside Hotkey Mode — a mouse player
   * must not be locked out of the rest of the game.
   */
  pointerDisabled?: boolean;
};

const GRIDLINE_CLASSES: Record<Settings["grid"]["gridlineStrength"], string> = {
  soft: "border-line/60",
  standard: "border-line",
  strong: "border-line-strong",
};

export function SpreadsheetGrid({
  grid,
  onAction,
  allowedActions,
  focusRef,
  density = "comfortable",
  gridlineStrength = "standard",
  largeTargets = false,
  pointerDisabled = false,
}: SpreadsheetGridProps) {
  // A run is an aiming test. Snapshot presentation on mount so a settings update cannot move a
  // target under the pointer or selection outline while that run is active.
  const [presentation] = useState(() => ({
    density,
    gridlineStrength,
    metrics: getGridMetrics(density, largeTargets),
  }));
  const gridlineClass = GRIDLINE_CLASSES[presentation.gridlineStrength];
  const anchorRef = useRef<CellAddress | null>(null);
  const draggedRef = useRef(false);

  /**
   * The two ends of the keyboard selection. The reducer normalizes a range so its `start` is the
   * top-left cell, which loses which end the player is moving. These refs remember it: `keyAnchor`
   * is the fixed end and `keyFocus` is the end the arrows move.
   */
  const keyAnchorRef = useRef<CellAddress | null>(null);
  const keyFocusRef = useRef<CellAddress | null>(null);

  const internalRef = useRef<HTMLDivElement | null>(null);
  const containerRef = focusRef ?? internalRef;

  // The grid is the game, so it takes focus as soon as it exists. Keyboard-only play must not
  // require a click first.
  useEffect(() => {
    containerRef.current?.focus({ preventScroll: true });
  }, [containerRef]);

  const allows = useCallback(
    (kind: GridActionKind) => allowedActions === undefined || allowedActions.includes(kind),
    [allowedActions],
  );

  // FilterMenu owns no focus or keydown of its own (§1a.10 of the plan) — handleKeyDown below
  // intercepts arrows/Enter/Escape while it's open, so DOM focus never leaves the grid container.
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [filterMenuHighlight, setFilterMenuHighlight] = useState(0);
  const menuOptions = filterMenuOptions(grid, allows);
  const highlightedIndex = Math.min(filterMenuHighlight, Math.max(menuOptions.length - 1, 0));

  const closeFilterMenu = useCallback(() => {
    setFilterMenuOpen(false);
    setFilterMenuHighlight(0);
  }, []);

  // The header caret's mouse click steals DOM focus (`ChallengeRun.tsx`'s toolbar has the same
  // problem, §2.3 fact 3) — refocusing the container is what lets the grid's own keydown handler,
  // not a stray listener on the button, drive the menu that click just opened. Not a useCallback:
  // the ref read inside it (containerRef.current) is exactly what the React Compiler's manual-
  // memoization check and react-hooks/exhaustive-deps disagree about, so this is left for the
  // compiler to memoize on its own rather than hand-writing a dependency array either rule accepts.
  function openFilterMenu(): void {
    if (menuOptions.length === 0) {
      return;
    }

    setFilterMenuOpen(true);
    setFilterMenuHighlight(0);
    containerRef.current?.focus({ preventScroll: true });
  }

  // A drag can end anywhere, including outside the grid or outside the window. Without this, letting
  // go off-grid would leave the anchor set and the next hover would keep extending the old range.
  useEffect(() => {
    const endDrag = () => {
      anchorRef.current = null;
    };

    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);

    return () => {
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, []);

  const startDrag = useCallback((cell: CellAddress) => {
    anchorRef.current = cell;
    draggedRef.current = false;
  }, []);

  /**
   * Every pointer-originated dispatch goes through here, so `ranked` strictness has one gate rather
   * than four. The keyboard path does not: the mode bars the mouse, not the player.
   */
  const emitPointer = useCallback(
    (action: GridAction, meta: ActionMeta) => {
      if (pointerDisabled) {
        return;
      }

      onAction(action, meta);
    },
    [pointerDisabled, onAction],
  );

  const extendDrag = useCallback(
    (cell: CellAddress, event: PointerEvent<HTMLButtonElement>) => {
      const anchor = anchorRef.current;

      // `buttons` is the authority on whether the primary button is still held. Hovering with the
      // mouse up also fires pointerenter, and that must not paint a selection.
      if (anchor === null || event.buttons !== 1) {
        return;
      }

      if (anchor.row === cell.row && anchor.col === cell.col) {
        return;
      }

      draggedRef.current = true;

      const action = resolveCommand("DRAG_SELECT_RANGE", { grid, focus: cell, anchor });

      if (action === null) {
        return;
      }

      updateRefsForAction(action, cell, keyAnchorRef, keyFocusRef);
      emitPointer(action, {
        command: "DRAG_SELECT_RANGE",
        inputMethod: "pointer",
        via: "grid",
        chord: null,
        controlId: null,
      });
    },
    [grid, emitPointer],
  );

  const selectCell = useCallback(
    (cell: CellAddress) => {
      // A click always follows a drag's pointerup. Letting it through would collapse the range the
      // player just dragged back down to a single cell.
      if (draggedRef.current) {
        draggedRef.current = false;

        return;
      }

      const action = resolveCommand("CLICK_CELL", { grid, focus: cell, anchor: cell });

      if (action === null) {
        return;
      }

      updateRefsForAction(action, cell, keyAnchorRef, keyFocusRef);
      emitPointer(action, {
        command: "CLICK_CELL",
        inputMethod: "pointer",
        via: "grid",
        chord: null,
        controlId: null,
      });
    },
    [grid, emitPointer],
  );

  // Clicking a column header means "this column's data", the same as it does in Excel.
  const selectColumn = useCallback(
    (col: number) => {
      const base = { row: 0, col };
      const action = resolveCommand("CLICK_COLUMN_HEADER", { grid, focus: base, anchor: base });

      if (action === null) {
        return;
      }

      updateRefsForAction(action, base, keyAnchorRef, keyFocusRef);
      emitPointer(action, {
        command: "CLICK_COLUMN_HEADER",
        inputMethod: "pointer",
        via: "grid",
        chord: null,
        controlId: null,
      });
    },
    [grid, emitPointer],
  );

  const selectRow = useCallback(
    (row: number) => {
      const base = { row, col: 0 };
      const action = resolveCommand("CLICK_ROW_HEADER", { grid, focus: base, anchor: base });

      if (action === null) {
        return;
      }

      updateRefsForAction(action, base, keyAnchorRef, keyFocusRef);
      emitPointer(action, {
        command: "CLICK_ROW_HEADER",
        inputMethod: "pointer",
        via: "grid",
        chord: null,
        controlId: null,
      });
    },
    [grid, emitPointer],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      // The menu owns arrows/Enter/Escape while it's open — it has no keydown listener of its own
      // (§1a.10), so every other key is a no-op rather than falling through to grid movement.
      if (filterMenuOpen) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setFilterMenuHighlight((index) => Math.min(index + 1, Math.max(menuOptions.length - 1, 0)));
          return;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();
          setFilterMenuHighlight((index) => Math.max(index - 1, 0));
          return;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          closeFilterMenu();
          return;
        }

        if (event.key === "Enter") {
          event.preventDefault();

          const option = menuOptions[highlightedIndex];

          closeFilterMenu();

          if (option === undefined) {
            return;
          }

          const focus = keyFocusRef.current ?? grid.activeCell;
          const anchor = keyAnchorRef.current ?? grid.activeCell;
          const action = resolveCommand(option.command, { grid, focus, anchor });

          if (action === null) {
            return;
          }

          updateRefsForAction(action, focus, keyAnchorRef, keyFocusRef);
          onAction(action, {
            command: option.command,
            inputMethod: "keyboard",
            via: "menu",
            chord: null,
            controlId: null,
          });
        }

        return;
      }

      const match = matchChord(event);

      if (match === null) {
        return;
      }

      const { command, chord } = match;

      if (command === "OPEN_FILTER_MENU") {
        if (menuOptions.length > 0) {
          event.preventDefault();
          setFilterMenuOpen(true);
          setFilterMenuHighlight(0);
        }

        return;
      }

      // Movement is never gated: it is how the player gets around. Only the set-format commands
      // and the sort/filter commands below can be disallowed, exactly as the toolbar's own buttons
      // are — and, as before, a disallowed chord is not prevented at all, so the browser is free to
      // do whatever it would otherwise.
      if (SET_FORMAT_COMMANDS.has(command) && !allows("set-format")) {
        return;
      }

      // TOGGLE_FILTER's resolved action depends on grid state, so which permission gates it does
      // too — resolved the same way `resolveCommand` itself will resolve it a few lines down.
      if (command === "TOGGLE_FILTER" && !allows(grid.filters.length > 0 ? "clear-filters" : "filter-column")) {
        return;
      }

      event.preventDefault();

      const focus = keyFocusRef.current ?? grid.activeCell;
      const anchor = keyAnchorRef.current ?? grid.activeCell;
      const action = resolveCommand(command, { grid, focus, anchor });

      if (action === null) {
        return;
      }

      updateRefsForAction(action, focus, keyAnchorRef, keyFocusRef);
      onAction(action, {
        command,
        inputMethod: "keyboard",
        via: "shortcut",
        chord,
        controlId: null,
      });
    },
    [
      grid,
      onAction,
      allows,
      filterMenuOpen,
      menuOptions,
      highlightedIndex,
      closeFilterMenu,
    ],
  );

  const isColumnSelected = (col: number) =>
    grid.selection.kind === "column" && grid.selection.col === col;

  const isRowSelected = (row: number) => grid.selection.kind === "row" && grid.selection.row === row;

  // A filter is applied and it matched nothing. Not the same as an empty sheet: the table is still
  // there, and so is the filter — which is why the run is not touched and the headers stay.
  const noMatchingRows = grid.filters.length > 0 && visibleDataRows(grid).length === 0;

  return (
    <div
      role="grid"
      aria-label="Spreadsheet"
      data-testid="spreadsheet-grid"
      data-density={presentation.density}
      data-gridline-strength={presentation.gridlineStrength}
      tabIndex={0}
      ref={containerRef}
      onKeyDown={handleKeyDown}
      className={`relative w-max touch-none overflow-hidden rounded-md border-t border-l ${gridlineClass} bg-canvas select-none`}
    >
      <div role="row" className="flex">
        <div
          aria-hidden
          className={`border-r border-b ${gridlineClass} bg-surface-raised`}
          style={{
            width: presentation.metrics.rowHeaderWidth,
            height: presentation.metrics.columnHeaderHeight,
          }}
        />
        {grid.columns.map((label, col) => (
          <ColumnHeader
            key={label}
            col={col}
            label={label}
            isSelected={isColumnSelected(col)}
            onSelect={selectColumn}
            metrics={presentation.metrics}
            gridlineClass={gridlineClass}
            // Only the active column shows the caret: FilterMenu always acts on the active cell
            // (§1a.10), so a caret on another column would open a menu that doesn't operate on it.
            showFilterCaret={col === grid.activeCell.col && menuOptions.length > 0}
            onOpenFilterMenu={openFilterMenu}
          />
        ))}
      </div>

      {renderedRows(grid).map((row) => (
        <div
          role="row"
          key={grid.rows[row]}
          className="flex"
          style={{ height: presentation.metrics.rowHeight }}
        >
          <RowHeader
            row={row}
            label={grid.rows[row]}
            isSelected={isRowSelected(row)}
            onSelect={selectRow}
            metrics={presentation.metrics}
            gridlineClass={gridlineClass}
          />
          {grid.columns.map((_, col) => (
            <CellView
              key={cellKey({ row, col })}
              row={row}
              col={col}
              cell={grid.cells[cellKey({ row, col })]}
              isSelected={isCellSelected(grid, { row, col })}
              isActive={grid.activeCell.row === row && grid.activeCell.col === col}
              onSelect={selectCell}
              onDragStart={startDrag}
              onDragOver={extendDrag}
              metrics={presentation.metrics}
              gridlineClass={gridlineClass}
            />
          ))}
        </div>
      ))}

      {/* Nothing matched. Said plainly, inside the table, where the rows would have been — the
          headers stay, the filter stays applied, and the player can clear it and try again. The
          blank rows below the table are no longer drawn (see `renderedRows`), so this is the only
          thing under the header, and it cannot be mistaken for a result. */}
      {noMatchingRows && (
        <div role="row" className="flex" style={{ height: presentation.metrics.rowHeight }}>
          <div
            aria-hidden
            className={`border-r border-b ${gridlineClass} bg-surface-raised`}
            style={{
              width: presentation.metrics.rowHeaderWidth,
              height: presentation.metrics.rowHeight,
            }}
          />
          <div
            role="gridcell"
            aria-colspan={grid.colCount}
            data-testid="no-matching-rows"
            className={`flex items-center border-r border-b ${gridlineClass} px-3 text-[12px] text-muted italic`}
            style={{
              width: grid.colCount * presentation.metrics.colWidth,
              height: presentation.metrics.rowHeight,
            }}
          >
            No matching rows
          </div>
        </div>
      )}

      <SelectionOverlay grid={grid} metrics={presentation.metrics} />

      {filterMenuOpen && (
        <FilterMenu
          options={menuOptions}
          highlightedIndex={highlightedIndex}
          style={{
            left: cellLeft(presentation.metrics, grid.activeCell.col),
            top: presentation.metrics.columnHeaderHeight,
          }}
        />
      )}
    </div>
  );
}

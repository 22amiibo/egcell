import type { CellAddress, GridState } from "@/domain/grid/gridTypes";
import { getCell, renderedRows } from "@/domain/grid/selectors";

export type MoveDirection = "up" | "down" | "left" | "right";

function hasData(grid: GridState, address: CellAddress): boolean {
  const cell = getCell(grid, address);

  return cell !== undefined && cell.value.kind !== "blank";
}

/**
 * The positions the active cell can occupy along the axis of travel. Vertical movement walks the
 * rows the grid actually draws, so arrowing down from above a filtered-out row lands on the next
 * visible row rather than on a row the player cannot see. Horizontal movement walks every column,
 * because columns are never hidden.
 */
function axisPositions(grid: GridState, direction: MoveDirection): number[] {
  if (direction === "up" || direction === "down") {
    return renderedRows(grid);
  }

  return Array.from({ length: grid.colCount }, (_, col) => col);
}

/**
 * One step along the list, clamped at both ends. The current position can be missing from the list
 * when a filter hid the active cell's own row; stepping then lands on the nearest visible position
 * in the direction of travel instead of throwing the cursor to a corner.
 */
function neighborIndex(positions: number[], current: number, delta: 1 | -1): number {
  const index = positions.indexOf(current);

  if (index !== -1) {
    return Math.min(Math.max(index + delta, 0), positions.length - 1);
  }

  if (delta === 1) {
    const next = positions.findIndex((position) => position > current);

    return next === -1 ? positions.length - 1 : next;
  }

  for (let scan = positions.length - 1; scan >= 0; scan -= 1) {
    if (positions[scan] < current) {
      return scan;
    }
  }

  return 0;
}

function toAddress(from: CellAddress, direction: MoveDirection, position: number): CellAddress {
  if (direction === "up" || direction === "down") {
    return { row: position, col: from.col };
  }

  return { row: from.row, col: position };
}

function deltaOf(direction: MoveDirection): 1 | -1 {
  return direction === "down" || direction === "right" ? 1 : -1;
}

/** Plain arrow: one cell over, skipping rows a filter has hidden, stopping at the grid edge. */
export function stepActive(grid: GridState, from: CellAddress, direction: MoveDirection): CellAddress {
  const positions = axisPositions(grid, direction);
  const current = direction === "up" || direction === "down" ? from.row : from.col;

  return toAddress(from, direction, positions[neighborIndex(positions, current, deltaOf(direction))]);
}

/**
 * Ctrl/Cmd+arrow: Excel's data-region jump, graded against the visible grid.
 *
 * From inside a run of data it goes to the last cell of that run. From a blank, or from the end of
 * a run, it goes to the next cell that holds data. When no data remains in that direction it goes
 * to the grid edge, exactly as Excel heads for the sheet edge.
 */
export function jumpActive(grid: GridState, from: CellAddress, direction: MoveDirection): CellAddress {
  const positions = axisPositions(grid, direction);
  const delta = deltaOf(direction);
  const current = direction === "up" || direction === "down" ? from.row : from.col;

  const dataAt = (index: number) => hasData(grid, toAddress(from, direction, positions[index]));

  let index = neighborIndex(positions, current, delta);

  // Already pressed against the edge: neighborIndex clamps, so a jump from the boundary stays put.
  if (positions[index] === current) {
    return toAddress(from, direction, positions[index]);
  }

  const startIndex = positions.indexOf(current);
  const startHasData = startIndex !== -1 && dataAt(startIndex);

  if (startHasData && dataAt(index)) {
    // Inside a run of data: ride it to its last cell.
    while (index + delta >= 0 && index + delta < positions.length && dataAt(index + delta)) {
      index += delta;
    }

    return toAddress(from, direction, positions[index]);
  }

  // On a blank, or at the end of a run: find the next cell with data.
  for (let scan = index; scan >= 0 && scan < positions.length; scan += delta) {
    if (dataAt(scan)) {
      return toAddress(from, direction, positions[scan]);
    }
  }

  // Nothing but blanks ahead: the grid edge.
  return toAddress(from, direction, positions[delta === 1 ? positions.length - 1 : 0]);
}

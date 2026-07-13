/**
 * Fixed pixel metrics, shared by the grid and by the absolutely positioned selection overlay.
 * The overlay computes its rectangle from these numbers, so if the two ever disagreed the
 * selection box would drift away from the cells it claims to cover.
 *
 * Fixed sizes also stop the grid reflowing when a value changes, which would otherwise shift
 * the target the player is aiming at mid-run.
 */
export const COL_WIDTH = 104;
export const ROW_HEIGHT = 30;
export const ROW_HEADER_WIDTH = 44;
export const COLUMN_HEADER_HEIGHT = 30;

export function cellLeft(col: number): number {
  return ROW_HEADER_WIDTH + col * COL_WIDTH;
}

export function cellTop(row: number): number {
  return COLUMN_HEADER_HEIGHT + row * ROW_HEIGHT;
}

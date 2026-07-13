import type { CellAddress, RangeAddress } from "@/domain/grid/gridTypes";

const ALPHABET_LENGTH = 26;
const FIRST_LETTER_CODE = "A".charCodeAt(0);

export function cellKey(address: CellAddress): string {
  return `${address.row}:${address.col}`;
}

/** Sorts a range so `start` is the top-left cell and `end` is the bottom-right cell. */
export function normalizeRange(range: RangeAddress): RangeAddress {
  return {
    start: {
      row: Math.min(range.start.row, range.end.row),
      col: Math.min(range.start.col, range.end.col),
    },
    end: {
      row: Math.max(range.start.row, range.end.row),
      col: Math.max(range.start.col, range.end.col),
    },
  };
}

export function rangesEqual(a: RangeAddress, b: RangeAddress): boolean {
  const left = normalizeRange(a);
  const right = normalizeRange(b);

  return (
    left.start.row === right.start.row &&
    left.start.col === right.start.col &&
    left.end.row === right.end.row &&
    left.end.col === right.end.col
  );
}

export function isAddressInRange(address: CellAddress, range: RangeAddress): boolean {
  const { start, end } = normalizeRange(range);

  return (
    address.row >= start.row &&
    address.row <= end.row &&
    address.col >= start.col &&
    address.col <= end.col
  );
}

export function rangeCellCount(range: RangeAddress): number {
  const { start, end } = normalizeRange(range);

  return (end.row - start.row + 1) * (end.col - start.col + 1);
}

/** Maps a zero-based column index to its spreadsheet label: 0 -> A, 25 -> Z, 26 -> AA. */
export function columnLabel(col: number): string {
  let label = "";
  let remaining = col;

  while (remaining >= 0) {
    label = String.fromCharCode(FIRST_LETTER_CODE + (remaining % ALPHABET_LENGTH)) + label;
    remaining = Math.floor(remaining / ALPHABET_LENGTH) - 1;
  }

  return label;
}

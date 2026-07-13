import type { CellValue, FilterState } from "@/domain/grid/gridTypes";

/** The value a cell sorts and filters by. Null means blank, which always sorts last. */
export function comparableValue(value: CellValue | undefined): string | number | null {
  if (value === undefined) {
    return null;
  }

  switch (value.kind) {
    case "blank":
      return null;
    case "text":
      return value.value;
    case "number":
      return value.value;
    case "date":
      return value.iso;
    case "formula":
      return comparableValue(value.computed);
  }
}

/**
 * Numbers compare numerically and text compares lexicographically, so 9 sorts below 10 rather than
 * above it. Blanks sink to the bottom in both directions, as they do in Excel.
 */
export function compareCellValues(a: CellValue | undefined, b: CellValue | undefined): number {
  const left = comparableValue(a);
  const right = comparableValue(b);

  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  return String(left).localeCompare(String(right), "en-US");
}

export function matchesFilter(value: CellValue | undefined, filter: FilterState): boolean {
  const left = comparableValue(value);

  if (left === null) {
    return false;
  }

  switch (filter.op) {
    case "equals":
      return left === filter.value;
    case "greater-than":
      return typeof left === "number" && typeof filter.value === "number" && left > filter.value;
    case "less-than":
      return typeof left === "number" && typeof filter.value === "number" && left < filter.value;
  }
}

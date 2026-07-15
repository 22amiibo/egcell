import type { CellAddress, CellValue, GridState } from "@/domain/grid/gridTypes";
import { cellKey } from "@/domain/grid/range";

const A1_PATTERN = /^([A-Za-z]+)(\d+)$/;

export function parseA1(ref: string): CellAddress | null {
  const match = A1_PATTERN.exec(ref.trim());

  if (match === null) {
    return null;
  }

  let col = 0;

  for (const letter of match[1].toUpperCase()) {
    col = col * 26 + (letter.charCodeAt(0) - 64);
  }

  return { row: Number(match[2]) - 1, col: col - 1 };
}

export function columnLetter(col: number): string {
  let letters = "";
  let value = col + 1;

  while (value > 0) {
    const remainder = (value - 1) % 26;

    letters = String.fromCharCode(65 + remainder) + letters;
    value = Math.floor((value - 1) / 26);
  }

  return letters;
}

export function formatA1(cell: CellAddress): string {
  return `${columnLetter(cell.col)}${cell.row + 1}`;
}

const RANGE_FN =
  /^=\s*(SUM|AVERAGE|MIN|MAX|COUNT)\s*\(\s*([A-Za-z]+\d+)\s*:\s*([A-Za-z]+\d+)\s*\)\s*$/i;
const CELL_REF = /^=\s*([A-Za-z]+\d+)\s*$/;

function numberAt(grid: GridState, cell: CellAddress): number | null {
  const value = grid.cells[cellKey(cell)]?.value;

  if (value === undefined) {
    return null;
  }

  if (value.kind === "number") {
    return value.value;
  }

  if (value.kind === "formula" && value.computed.kind === "number") {
    return value.computed.value;
  }

  return null;
}

function inGrid(grid: GridState, cell: CellAddress): boolean {
  return cell.row >= 0 && cell.row < grid.rowCount && cell.col >= 0 && cell.col < grid.colCount;
}

/**
 * The five-function evaluator: SUM/AVERAGE/MIN/MAX/COUNT over one rectangular range, plus a bare
 * cell reference. Text and blanks are skipped the way Excel skips them. Anything else is an
 * honest error value, never a throw — a formula cell must always hold something renderable.
 */
export function evaluateFormula(grid: GridState, formula: string): CellValue {
  const rangeMatch = RANGE_FN.exec(formula);

  if (rangeMatch !== null) {
    const start = parseA1(rangeMatch[2]);
    const end = parseA1(rangeMatch[3]);

    if (start === null || end === null || !inGrid(grid, start) || !inGrid(grid, end)) {
      return { kind: "text", value: "#REF!" };
    }

    const numbers: number[] = [];

    for (let row = Math.min(start.row, end.row); row <= Math.max(start.row, end.row); row += 1) {
      for (let col = Math.min(start.col, end.col); col <= Math.max(start.col, end.col); col += 1) {
        const value = numberAt(grid, { row, col });

        if (value !== null) {
          numbers.push(value);
        }
      }
    }

    switch (rangeMatch[1].toUpperCase()) {
      case "SUM":
        return { kind: "number", value: numbers.reduce((sum, n) => sum + n, 0) };
      case "AVERAGE":
        return numbers.length === 0
          ? { kind: "text", value: "#DIV/0!" }
          : { kind: "number", value: numbers.reduce((sum, n) => sum + n, 0) / numbers.length };
      case "COUNT":
        return { kind: "number", value: numbers.length };
      case "MIN":
        return numbers.length === 0
          ? { kind: "text", value: "#REF!" }
          : { kind: "number", value: Math.min(...numbers) };
      case "MAX":
        return numbers.length === 0
          ? { kind: "text", value: "#REF!" }
          : { kind: "number", value: Math.max(...numbers) };
    }
  }

  const refMatch = CELL_REF.exec(formula);

  if (refMatch !== null) {
    const cell = parseA1(refMatch[1]);

    if (cell === null || !inGrid(grid, cell)) {
      return { kind: "text", value: "#REF!" };
    }

    const value = numberAt(grid, cell);

    return value === null ? { kind: "text", value: "#REF!" } : { kind: "number", value };
  }

  return { kind: "text", value: "#NAME?" };
}

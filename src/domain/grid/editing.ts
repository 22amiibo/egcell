import type { CellAddress, CellValue, GridState } from "@/domain/grid/gridTypes";
import { evaluateFormula } from "@/domain/grid/formulaEval";

/**
 * The edit buffer lives outside the reducer on purpose: the reducer sees one atomic
 * `set-cell-value` commit, never a keystroke, so `(challenge, grid) → isComplete` stays a cheap
 * goal test and the event log stays a route log rather than a keylogger.
 */
export type EditState =
  | { mode: "idle" }
  | {
      mode: "editing";
      cell: CellAddress;
      buffer: string;
      /** Printable characters entered over the edit's lifetime, pastes included. */
      chars: number;
      /** Characters removed — the honest count of "typed wrong, fixed it". */
      corrections: number;
    };

export const EDIT_IDLE: EditState = { mode: "idle" };

export function startEdit(cell: CellAddress, seedChar = ""): EditState {
  return { mode: "editing", cell, buffer: seedChar, chars: seedChar.length, corrections: 0 };
}

/** Fold a controlled input's next value in, counting growth as chars and shrinkage as corrections. */
export function editInput(state: EditState, nextBuffer: string): EditState {
  if (state.mode !== "editing") {
    return state;
  }

  const delta = nextBuffer.length - state.buffer.length;

  return {
    ...state,
    buffer: nextBuffer,
    chars: state.chars + Math.max(0, delta),
    corrections: state.corrections + Math.max(0, -delta),
  };
}

const NUMBER_PATTERN = /^[+-]?(\d+\.?\d*|\.\d+)$/;

/**
 * A committed buffer becomes a cell value: number when it reads as one, blank when empty, text
 * otherwise. Phase 2 adds the `=formula` branch, which reads the grid to evaluate formulas.
 */
export function parseCellInput(raw: string, grid: GridState): CellValue {
  const trimmed = raw.trim();

  if (trimmed.startsWith("=")) {
    return { kind: "formula", formula: raw, computed: evaluateFormula(grid, trimmed) };
  }

  if (trimmed === "") {
    return { kind: "blank" };
  }

  if (NUMBER_PATTERN.test(trimmed)) {
    return { kind: "number", value: Number(trimmed) };
  }

  return { kind: "text", value: raw };
}

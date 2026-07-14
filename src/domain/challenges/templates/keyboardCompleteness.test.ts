import { describe, expect, it } from "vitest";

import { DATASET_THEMES } from "@/data/datasets/themes";
import { generateVariant } from "@/domain/challenges/generateVariant";
import { formattingTemplates } from "@/domain/challenges/templates/formatting";
import { mixedTemplates } from "@/domain/challenges/templates/mixed";
import { sortFilterTemplates } from "@/domain/challenges/templates/sortFilter";
import type { ChallengeTemplate, ChallengeVariant } from "@/domain/challenges/variantTypes";
import { COMMAND_REGISTRY } from "@/domain/commands/commandRegistry";
import type { GridCommandId } from "@/domain/commands/commandTypes";
import { resolveCommand } from "@/domain/commands/resolveCommand";
import { gridReducer } from "@/domain/grid/gridReducer";
import type { CellAddress, GridAction, GridState } from "@/domain/grid/gridTypes";
import { cellKey } from "@/domain/grid/range";
import type { RunState } from "@/domain/runs/runTypes";
import { validateChallenge } from "@/domain/validation/validateChallenge";

/**
 * §1a.6's acceptance gate: the six templates §2.3 named as unsolvable without a mouse
 * (`gen.formatting.date`, both `gen.sort-filter.sort-*`, both `gen.sort-filter.filter-*`, and
 * `gen.mixed.sort-and-format`) must now solve through a command sequence drawn only from
 * `hotkeyEligible: true` commands, replayed through the real reducer and the real validator.
 */

function runFor(variant: ChallengeVariant): RunState {
  return {
    challengeId: variant.id,
    challengeVersion: variant.version,
    seed: variant.seed,
    mode: "main-speed",
    status: "running",
    startedAt: 0,
    finishedAt: null,
    elapsedMs: 0,
    events: [],
  };
}

function isComplete(variant: ChallengeVariant, grid: GridState): boolean {
  return validateChallenge({ challenge: variant, grid, run: runFor(variant) }).isComplete;
}

function findTemplate(templates: ChallengeTemplate[], id: string): ChallengeTemplate {
  const found = templates.find((candidate) => candidate.id === id);

  if (found === undefined) {
    throw new Error(`Missing template ${id}.`);
  }

  return found;
}

function draw(
  templates: ChallengeTemplate[],
  id: string,
  seed: string,
  difficulty: 1 | 2 | 3 | 4 | 5,
): ChallengeVariant {
  const variant = generateVariant({
    template: findTemplate(templates, id),
    themes: DATASET_THEMES,
    seed,
    difficulty,
  });

  if (variant === null) {
    throw new Error(`${id} failed to generate for seed ${seed}.`);
  }

  return variant;
}

/** Replays one command through the real reducer, proving it comes from the hotkeyEligible set. */
function replay(
  grid: GridState,
  command: GridCommandId,
  focus: CellAddress,
  anchor: CellAddress = focus,
): GridState {
  expect(COMMAND_REGISTRY[command].hotkeyEligible).toBe(true);

  const action = resolveCommand(command, { grid, focus, anchor });

  expect(action).not.toBeNull();

  return gridReducer(grid, action as GridAction);
}

/** The data cell a player would click to anchor a filter — the same one the template generated. */
function findCell(
  grid: GridState,
  col: number,
  first: number,
  last: number,
  value: string | number,
): CellAddress {
  for (let row = first; row <= last; row += 1) {
    const cellValue = grid.cells[cellKey({ row, col })]?.value;
    const candidate =
      cellValue?.kind === "text" ? cellValue.value : cellValue?.kind === "number" ? cellValue.value : null;

    if (candidate === value) {
      return { row, col };
    }
  }

  throw new Error(`No cell in column ${col} holds ${String(value)}.`);
}

describe("Phase 2 keyboard completeness — the six previously mouse-only templates", () => {
  it("gen.formatting.date solves with Ctrl+Space (SELECT_COLUMN) then the date-format chord", () => {
    const variant = draw(formattingTemplates, "gen.formatting.date", "kb-date", 3);

    if (variant.validation.kind !== "formatting") {
      throw new Error("Expected a formatting spec.");
    }

    expect(isComplete(variant, variant.initialGrid)).toBe(false);

    const focus = variant.validation.range.start;
    const selected = replay(variant.initialGrid, "SELECT_COLUMN", focus);
    const formatted = replay(selected, "FORMAT_DATE", focus);

    expect(isComplete(variant, formatted)).toBe(true);
  });

  it("gen.sort-filter.sort-numeric solves through FilterMenu's SORT_ASC/SORT_DESC", () => {
    const variant = draw(sortFilterTemplates, "gen.sort-filter.sort-numeric", "kb-sort-num", 3);

    if (variant.validation.kind !== "sort-filter" || variant.validation.requiredSort === undefined) {
      throw new Error("Expected a sort spec.");
    }

    expect(isComplete(variant, variant.initialGrid)).toBe(false);

    const { col, direction } = variant.validation.requiredSort;
    const command: GridCommandId = direction === "asc" ? "SORT_ASC" : "SORT_DESC";
    const sorted = replay(variant.initialGrid, command, { row: 0, col });

    expect(isComplete(variant, sorted)).toBe(true);
  });

  it("gen.sort-filter.sort-text solves through FilterMenu's SORT_ASC/SORT_DESC", () => {
    const variant = draw(sortFilterTemplates, "gen.sort-filter.sort-text", "kb-sort-text", 3);

    if (variant.validation.kind !== "sort-filter" || variant.validation.requiredSort === undefined) {
      throw new Error("Expected a sort spec.");
    }

    expect(isComplete(variant, variant.initialGrid)).toBe(false);

    const { col, direction } = variant.validation.requiredSort;
    const command: GridCommandId = direction === "asc" ? "SORT_ASC" : "SORT_DESC";
    const sorted = replay(variant.initialGrid, command, { row: 0, col });

    expect(isComplete(variant, sorted)).toBe(true);
  });

  it("gen.sort-filter.filter-equals solves through FilterMenu's FILTER_TO_VALUE", () => {
    const variant = draw(sortFilterTemplates, "gen.sort-filter.filter-equals", "kb-filter-eq", 2);

    if (variant.validation.kind !== "sort-filter" || variant.validation.requiredVisible === undefined) {
      throw new Error("Expected a filter spec.");
    }

    const grid = variant.initialGrid;

    expect(isComplete(variant, grid)).toBe(false);

    const { col, value } = variant.validation.requiredVisible;
    const first = grid.usedRange.start.row + grid.headerRows;
    const last = grid.usedRange.end.row;
    const focus = findCell(grid, col, first, last, value);
    const filtered = replay(grid, "FILTER_TO_VALUE", focus);

    expect(isComplete(variant, filtered)).toBe(true);
  });

  it("gen.sort-filter.filter-above solves through FilterMenu's FILTER_ABOVE_VALUE", () => {
    const variant = draw(sortFilterTemplates, "gen.sort-filter.filter-above", "kb-filter-above", 2);

    if (variant.validation.kind !== "sort-filter" || variant.validation.requiredVisible === undefined) {
      throw new Error("Expected a filter spec.");
    }

    const grid = variant.initialGrid;

    expect(isComplete(variant, grid)).toBe(false);

    const { col, value } = variant.validation.requiredVisible;
    const first = grid.usedRange.start.row + grid.headerRows;
    const last = grid.usedRange.end.row;
    const focus = findCell(grid, col, first, last, value);
    const filtered = replay(grid, "FILTER_ABOVE_VALUE", focus);

    expect(isComplete(variant, filtered)).toBe(true);
  });

  it("gen.mixed.sort-and-format solves with SORT_ASC/DESC, SELECT_ROW+TOGGLE_BOLD, and (at chain length 3) SELECT_COLUMN+FORMAT_CURRENCY", () => {
    const variant = draw(mixedTemplates, "gen.mixed.sort-and-format", "kb-mixed", 5);

    if (variant.validation.kind !== "composite") {
      throw new Error("Expected a composite spec.");
    }

    expect(isComplete(variant, variant.initialGrid)).toBe(false);

    let grid = variant.initialGrid;

    for (const part of variant.validation.parts) {
      if (part.kind === "sort-filter" && part.requiredSort !== undefined) {
        const command: GridCommandId = part.requiredSort.direction === "asc" ? "SORT_ASC" : "SORT_DESC";

        grid = replay(grid, command, { row: 0, col: part.requiredSort.col });
        continue;
      }

      if (part.kind === "formatting" && part.requiredFormat.bold === true) {
        const row = part.range.start.row;

        grid = replay(grid, "SELECT_ROW", { row, col: 0 });
        grid = replay(grid, "TOGGLE_BOLD", { row, col: 0 });
        continue;
      }

      if (part.kind === "formatting" && part.requiredFormat.numberFormat === "currency") {
        const focus = part.range.start;

        grid = replay(grid, "SELECT_COLUMN", focus);
        grid = replay(grid, "FORMAT_CURRENCY", focus);
        continue;
      }

      throw new Error(`Unexpected mixed part: ${JSON.stringify(part)}.`);
    }

    expect(isComplete(variant, grid)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import { DATASET_THEMES } from "@/data/datasets/themes";
import { ALL_DIFFICULTIES } from "@/domain/challenges/difficulty";
import { generateVariant } from "@/domain/challenges/generateVariant";
import { formattingTemplates } from "@/domain/challenges/templates/formatting";
import { sortFilterTemplates } from "@/domain/challenges/templates/sortFilter";
import type { ChallengeTemplate, ChallengeVariant } from "@/domain/challenges/variantTypes";
import { gridReducer } from "@/domain/grid/gridReducer";
import type { GridAction, GridState } from "@/domain/grid/gridTypes";
import { cellKey, normalizeRange } from "@/domain/grid/range";
import type { RunState } from "@/domain/runs/runTypes";
import { validateChallenge } from "@/domain/validation/validateChallenge";

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

function complete(variant: ChallengeVariant, grid: GridState): boolean {
  return validateChallenge({ challenge: variant, grid, run: runFor(variant) }).isComplete;
}

/** The action the toolbar or a shortcut would dispatch to solve each spec. */
function solvingAction(variant: ChallengeVariant): GridAction {
  const spec = variant.validation;

  switch (spec.kind) {
    case "formatting":
      return { kind: "set-format", range: spec.range, format: spec.requiredFormat };

    case "sort-filter":
      if (spec.requiredSort !== undefined) {
        return {
          kind: "sort-column",
          col: spec.requiredSort.col,
          direction: spec.requiredSort.direction,
        };
      }

      if (spec.requiredVisible !== undefined) {
        return {
          kind: "filter-column",
          col: spec.requiredVisible.col,
          op: spec.requiredVisible.op,
          value: spec.requiredVisible.value,
        };
      }

      throw new Error("A sort-filter spec must require something.");

    default:
      throw new Error(`Unexpected spec kind ${spec.kind}.`);
  }
}

/** A wrong-but-plausible action: reversed sort, mis-aimed format, wrong filter value. */
function nearMissAction(variant: ChallengeVariant): GridAction | null {
  const spec = variant.validation;

  if (spec.kind === "formatting") {
    const range = normalizeRange(spec.range);

    if (range.start.row === range.end.row) {
      return null;
    }

    // Everything but the last row: partial, never complete.
    return {
      kind: "set-format",
      range: { start: range.start, end: { row: range.end.row - 1, col: range.end.col } },
      format: spec.requiredFormat,
    };
  }

  if (spec.kind === "sort-filter" && spec.requiredSort !== undefined) {
    return {
      kind: "sort-column",
      col: spec.requiredSort.col,
      direction: spec.requiredSort.direction === "asc" ? "desc" : "asc",
    };
  }

  return null;
}

const eachTemplate = [...formattingTemplates, ...sortFilterTemplates].map(
  (template) => [template.id, template] as const,
);

describe("formatting and sort/filter templates", () => {
  it.each(eachTemplate)("%s generates deterministically", (_id, template) => {
    const first = generateVariant({ template, themes: DATASET_THEMES, seed: "det", difficulty: 3 });
    const second = generateVariant({ template, themes: DATASET_THEMES, seed: "det", difficulty: 3 });

    expect(first).not.toBeNull();
    expect(first).toEqual(second);
  });

  it.each(eachTemplate)("%s actually varies across seeds", (_id, template) => {
    const dimensions = new Set(
      Array.from({ length: 8 }, (_, draw) =>
        JSON.stringify(
          generateVariant({ template, themes: DATASET_THEMES, seed: `vary-${draw}`, difficulty: 3 })
            ?.dimensions,
        ),
      ),
    );

    expect(dimensions.size).toBeGreaterThan(1);
  });

  it.each(eachTemplate)("%s survives the fuzz, solves, and rejects near-misses", (_id, template) => {
    for (const difficulty of ALL_DIFFICULTIES) {
      for (let draw = 0; draw < 8; draw += 1) {
        const variant = generateVariant({
          template,
          themes: DATASET_THEMES,
          seed: `fuzz-${difficulty}-${draw}`,
          difficulty,
        });

        expect(variant).not.toBeNull();

        if (variant === null) {
          throw new Error("Unreachable.");
        }

        expect(complete(variant, variant.initialGrid)).toBe(false);

        const solved = gridReducer(variant.initialGrid, solvingAction(variant));

        expect(complete(variant, solved)).toBe(true);

        const miss = nearMissAction(variant);

        if (miss !== null) {
          expect(complete(variant, gridReducer(variant.initialGrid, miss))).toBe(false);
        }
      }
    }
  });

  it("keeps the header in place when a generated sort challenge is solved", () => {
    const template = sortFilterTemplates.find(
      (candidate) => candidate.id === "gen.sort-filter.sort-numeric",
    ) as ChallengeTemplate;

    const variant = generateVariant({
      template,
      themes: DATASET_THEMES,
      seed: "header-check",
      difficulty: 3,
    });

    expect(variant).not.toBeNull();

    if (variant === null || variant.validation.kind !== "sort-filter") {
      throw new Error("Expected a sort-filter spec.");
    }

    const grid = variant.initialGrid;
    const headerRowIndex = normalizeRange(grid.usedRange).start.row;
    const sorted = gridReducer(grid, solvingAction(variant));

    for (let col = 0; col < grid.colCount; col += 1) {
      expect(sorted.cells[cellKey({ row: headerRowIndex, col })]).toEqual(
        grid.cells[cellKey({ row: headerRowIndex, col })],
      );
    }
  });

  it("fails a filter challenge that keeps the wrong value visible", () => {
    const template = sortFilterTemplates.find(
      (candidate) => candidate.id === "gen.sort-filter.filter-equals",
    ) as ChallengeTemplate;

    const variant = generateVariant({
      template,
      themes: DATASET_THEMES,
      seed: "wrong-filter",
      difficulty: 2,
    });

    expect(variant).not.toBeNull();

    if (
      variant === null ||
      variant.validation.kind !== "sort-filter" ||
      variant.validation.requiredVisible === undefined
    ) {
      throw new Error("Expected a filter spec.");
    }

    const { col, value } = variant.validation.requiredVisible;

    // Find a different value present in the column and filter to that instead.
    const grid = variant.initialGrid;
    const { start, end } = normalizeRange(grid.usedRange);
    let other: string | null = null;

    for (let row = start.row + grid.headerRows; row <= end.row; row += 1) {
      const cell = grid.cells[cellKey({ row, col })]?.value;

      if (cell?.kind === "text" && cell.value !== value) {
        other = cell.value;
        break;
      }
    }

    expect(other).not.toBeNull();

    const filtered = gridReducer(grid, {
      kind: "filter-column",
      col,
      op: "equals",
      value: other as string,
    });

    expect(complete(variant, filtered)).toBe(false);
  });
});

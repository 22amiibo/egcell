import { describe, expect, it } from "vitest";

import { DATASET_THEMES } from "@/data/datasets/themes";
import { ALL_DIFFICULTIES } from "@/domain/challenges/difficulty";
import { generateVariant } from "@/domain/challenges/generateVariant";
import { selectionTemplates } from "@/domain/challenges/templates/selection";
import type { ChallengeVariant } from "@/domain/challenges/variantTypes";
import { gridReducer } from "@/domain/grid/gridReducer";
import type { GridAction, GridState } from "@/domain/grid/gridTypes";
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

/**
 * The action a real player would use for each template: header clicks and Ctrl+Space for a
 * column, Shift+Space for a row, drags for ranges. Solving through the reducer proves the mouse
 * and keyboard routes both land on the exact range the validator wants.
 */
function solvingAction(variant: ChallengeVariant): GridAction {
  const spec = variant.validation;

  if (spec.kind !== "selection") {
    throw new Error("Selection templates must emit selection specs.");
  }

  const range = spec.requiredRange;

  switch (variant.templateId) {
    case "gen.selection.column":
      return { kind: "select-column", col: range.start.col, usedRangeOnly: true };

    case "gen.selection.header-row":
    case "gen.selection.row-by-name":
      return { kind: "select-row", row: range.start.row };

    default:
      return { kind: "select-range", range };
  }
}

function complete(variant: ChallengeVariant, grid: GridState): boolean {
  return validateChallenge({ challenge: variant, grid, run: runFor(variant) }).isComplete;
}

const eachTemplate = selectionTemplates.map((template) => [template.id, template] as const);

describe("selection templates", () => {
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

  it.each(eachTemplate)("%s survives the fuzz and its player route solves it", (_id, template) => {
    for (const difficulty of ALL_DIFFICULTIES) {
      for (let draw = 0; draw < 8; draw += 1) {
        const variant = generateVariant({
          template,
          themes: DATASET_THEMES,
          seed: `fuzz-${difficulty}-${draw}`,
          difficulty,
        });

        expect(variant).not.toBeNull();

        if (variant === null || variant.validation.kind !== "selection") {
          throw new Error("Selection templates must emit selection specs.");
        }

        expect(complete(variant, variant.initialGrid)).toBe(false);

        const solved = gridReducer(variant.initialGrid, solvingAction(variant));

        expect(complete(variant, solved)).toBe(true);

        // Near-miss: the same range shifted down one row must fail.
        const range = variant.validation.requiredRange;
        const shifted = gridReducer(variant.initialGrid, {
          kind: "select-range",
          range: {
            start: { row: range.start.row + 1, col: range.start.col },
            end: { row: range.end.row + 1, col: range.end.col },
          },
        });

        expect(complete(variant, shifted)).toBe(false);
      }
    }
  });

  it("fails a headerless-values challenge when the header is included", () => {
    const template = selectionTemplates.find(
      (candidate) => candidate.id === "gen.selection.column-values",
    );

    expect(template).toBeDefined();

    const variant = generateVariant({
      template: template as (typeof selectionTemplates)[number],
      themes: DATASET_THEMES,
      seed: "header-miss",
      difficulty: 2,
    });

    expect(variant).not.toBeNull();

    if (variant === null || variant.validation.kind !== "selection") {
      throw new Error("Expected a selection spec.");
    }

    // Selecting the whole column via the header click includes the header row: near-miss.
    const withHeader = gridReducer(variant.initialGrid, {
      kind: "select-column",
      col: variant.validation.requiredRange.start.col,
      usedRangeOnly: true,
    });

    expect(complete(variant, withHeader)).toBe(false);
  });
});

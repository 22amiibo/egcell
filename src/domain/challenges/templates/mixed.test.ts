import { describe, expect, it } from "vitest";

import { DATASET_THEMES } from "@/data/datasets/themes";
import type { LeafValidationSpec } from "@/domain/challenges/challengeTypes";
import { generateVariant } from "@/domain/challenges/generateVariant";
import { mixedTemplates } from "@/domain/challenges/templates/mixed";
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

function actionFor(part: LeafValidationSpec): GridAction {
  switch (part.kind) {
    case "formatting":
      return { kind: "set-format", range: part.range, format: part.requiredFormat };
    case "sort-filter":
      if (part.requiredSort !== undefined) {
        return {
          kind: "sort-column",
          col: part.requiredSort.col,
          direction: part.requiredSort.direction,
        };
      }

      throw new Error("The generated mixed chain should use a sort part.");
    default:
      throw new Error(`Unsupported generated mixed part: ${part.kind}.`);
  }
}

function validate(variant: ChallengeVariant, grid: GridState) {
  return validateChallenge({ challenge: variant, grid, run: runFor(variant) });
}

function draw(seed: string, difficulty: 2 | 5): ChallengeVariant {
  const template = mixedTemplates[0];

  if (template === undefined) {
    throw new Error("Missing generated mixed template.");
  }

  const variant = generateVariant({ template, themes: DATASET_THEMES, seed, difficulty });

  if (variant === null || variant.validation.kind !== "composite") {
    throw new Error("Expected a generated mixed challenge.");
  }

  return variant;
}

describe("generated mixed templates", () => {
  it("generates the same two-step chain for the same seed", () => {
    const first = draw("mixed-deterministic", 2);
    const second = draw("mixed-deterministic", 2);

    expect(first).toEqual(second);
    expect(first.dimensions.chainLength).toBe(2);
    expect(first.validation.kind === "composite" && first.validation.parts).toHaveLength(2);
  });

  it("can generate a three-step chain at difficulty five", () => {
    const variants = Array.from({ length: 20 }, (_, index) => draw(`mixed-three-${index}`, 5));

    expect(variants.some((variant) => variant.dimensions.chainLength === 3)).toBe(true);
  });

  it("grades one subgoal as partial credit and completes in either order", () => {
    const variant = draw("mixed-orders", 5);
    const spec = variant.validation;

    if (spec.kind !== "composite") {
      throw new Error("Expected a composite spec.");
    }

    const actions = spec.parts.map(actionFor);
    const firstOnly = gridReducer(variant.initialGrid, actions[0]);
    const partial = validate(variant, firstOnly);

    expect(partial.isComplete).toBe(false);
    expect(partial.completionPercent).toBeCloseTo(1 / actions.length);
    expect(partial.subgoals?.filter((subgoal) => subgoal.isComplete)).toHaveLength(1);

    const forward = actions.reduce<GridState>(gridReducer, variant.initialGrid);
    const reverse = [...actions].reverse().reduce<GridState>(gridReducer, variant.initialGrid);

    expect(validate(variant, forward).isComplete).toBe(true);
    expect(validate(variant, reverse).isComplete).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import { DATASET_THEMES } from "@/data/datasets/themes";
import { ALL_DIFFICULTIES } from "@/domain/challenges/difficulty";
import { generateVariant } from "@/domain/challenges/generateVariant";
import { navigationTemplates } from "@/domain/challenges/templates/navigation";
import type { ChallengeVariant } from "@/domain/challenges/variantTypes";
import { gridReducer } from "@/domain/grid/gridReducer";
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

const eachTemplate = navigationTemplates.map((template) => [template.id, template] as const);

describe("navigation templates", () => {
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

  // The eligibility fuzz: every template, every difficulty, many seeds. Generation must succeed,
  // must not start complete, and one select-cell on the target must complete it — which is
  // exactly what a keyboard route dispatches.
  it.each(eachTemplate)("%s survives the fuzz and is solvable by one landing", (_id, template) => {
    for (const difficulty of ALL_DIFFICULTIES) {
      for (let draw = 0; draw < 8; draw += 1) {
        const variant = generateVariant({
          template,
          themes: DATASET_THEMES,
          seed: `fuzz-${difficulty}-${draw}`,
          difficulty,
        });

        expect(variant).not.toBeNull();

        const spec = (variant as ChallengeVariant).validation;

        if (variant === null || spec.kind !== "navigation") {
          throw new Error("Navigation templates must emit navigation specs.");
        }

        const untouched = validateChallenge({
          challenge: variant,
          grid: variant.initialGrid,
          run: runFor(variant),
        });

        expect(untouched.isComplete).toBe(false);

        const landed = gridReducer(variant.initialGrid, {
          kind: "select-cell",
          cell: spec.requiredCell,
        });
        const solved = validateChallenge({ challenge: variant, grid: landed, run: runFor(variant) });

        expect(solved.isComplete).toBe(true);

        // A near-miss lands next door and must fail.
        const neighbor = gridReducer(variant.initialGrid, {
          kind: "select-cell",
          cell: { row: spec.requiredCell.row, col: Math.max(spec.requiredCell.col - 1, 0) },
        });

        if (neighbor.activeCell.col !== spec.requiredCell.col) {
          const missed = validateChallenge({
            challenge: variant,
            grid: neighbor,
            run: runFor(variant),
          });

          expect(missed.isComplete).toBe(false);
        }
      }
    }
  });

  it("gives every template a stable drill id carrying template and difficulty, not the seed", () => {
    for (const template of navigationTemplates) {
      const a = generateVariant({ template, themes: DATASET_THEMES, seed: "id-a", difficulty: 2 });
      const b = generateVariant({ template, themes: DATASET_THEMES, seed: "id-b", difficulty: 2 });

      // Same drill, different instance: the personal-record key survives the re-draw.
      expect(a?.id).toBe(`${template.id}@${template.version}:d2`);
      expect(a?.id).toBe(b?.id);
      expect(a?.seed).not.toBe(b?.seed);
    }
  });
});

import { describe, expect, it } from "vitest";

import { DATASET_THEMES } from "@/data/datasets/themes";
import { DIFFICULTY_PRESETS } from "@/domain/challenges/difficulty";
import { checkVariant } from "@/domain/challenges/eligibility";
import { selectionTemplates } from "@/domain/challenges/templates/selection";
import type { ChallengeVariant, GeneratedChallenge } from "@/domain/challenges/variantTypes";
import { createRng } from "@/domain/random/rng";

/** A known-good generated draw the tests below break one property at a time. */
function goodDraw(): Required<Pick<GeneratedChallenge, "variant" | "dataset">> {
  const template = selectionTemplates.find(
    (candidate) => candidate.id === "gen.selection.column",
  );

  if (template === undefined) {
    throw new Error("Missing template.");
  }

  const seed = "eligibility-fixture";
  const generated = template.generate({
    rng: createRng(seed),
    seed,
    difficulty: 2,
    preset: DIFFICULTY_PRESETS[2],
    themes: DATASET_THEMES,
  });

  if (generated === null || generated.dataset === undefined) {
    throw new Error("The fixture draw failed, which is itself a bug.");
  }

  return { variant: generated.variant, dataset: generated.dataset };
}

function issuesOf(variant: ChallengeVariant, dataset = goodDraw().dataset): string[] {
  return checkVariant({ variant, dataset }).map((issue) => issue.check);
}

describe("checkVariant", () => {
  it("passes a good draw with zero issues", () => {
    const { variant, dataset } = goodDraw();

    expect(checkVariant({ variant, dataset })).toEqual([]);
  });

  it("rejects a target outside the grid", () => {
    const { variant, dataset } = goodDraw();
    const broken: ChallengeVariant = {
      ...variant,
      validation: {
        kind: "selection",
        requiredRange: {
          start: { row: 0, col: variant.initialGrid.colCount + 3 },
          end: { row: 4, col: variant.initialGrid.colCount + 3 },
        },
      },
    };

    expect(issuesOf(broken, dataset)).toContain("target-outside-grid");
  });

  it("rejects a challenge whose allowed actions cannot satisfy its spec", () => {
    const { variant, dataset } = goodDraw();

    expect(issuesOf({ ...variant, allowedActions: [] }, dataset)).toContain("actions-missing");
  });

  it("rejects a prompt that does not name its target column", () => {
    const { variant, dataset } = goodDraw();

    expect(issuesOf({ ...variant, prompt: "Select the target column." }, dataset)).toContain(
      "prompt-target-mismatch",
    );
  });

  it("rejects a prompt that names a column the validator ignores", () => {
    const { variant, dataset } = goodDraw();
    const spec = variant.validation;

    if (spec.kind !== "selection") {
      throw new Error("Expected a selection spec.");
    }

    const otherCol = Object.keys(dataset.headersByCol)
      .map(Number)
      .find((col) => col !== spec.requiredRange.start.col);
    const otherHeader = dataset.headersByCol[otherCol as number];

    const issues = issuesOf(
      { ...variant, prompt: `Select the ${otherHeader} column.` },
      dataset,
    );

    expect(issues).toContain("prompt-misdirection");
  });

  it("rejects a formatting target that already carries the required format", () => {
    const { variant, dataset } = goodDraw();

    // Headers are bold by default in this draw, so requiring bold on the header row is already
    // satisfied before the player touches anything.
    const broken: ChallengeVariant = {
      ...variant,
      allowedActions: [...variant.allowedActions, "set-format"],
      dimensions: { ...variant.dimensions, targetRole: undefined },
      prompt: "Make the header row bold.",
      validation: {
        kind: "formatting",
        range: {
          start: { row: dataset.headerRow, col: dataset.firstCol },
          end: { row: dataset.headerRow, col: dataset.lastCol },
        },
        requiredFormat: { bold: true },
      },
    };

    const issues = issuesOf(broken, dataset);

    expect(issues).toContain("format-already-satisfied");
    expect(issues).toContain("starts-complete");
  });

  it("rejects a byName target that does not appear exactly once", () => {
    const { variant, dataset } = goodDraw();

    const issues = issuesOf(
      { ...variant, dimensions: { ...variant.dimensions, targetLabel: "Nobody At All" } },
      dataset,
    );

    expect(issues).toContain("by-name-ambiguous");
  });

  it("rejects a composite whose labels do not align with its parts", () => {
    const { variant, dataset } = goodDraw();
    const selection = variant.validation;

    if (selection.kind !== "selection") {
      throw new Error("Expected a selection spec.");
    }

    const broken: ChallengeVariant = {
      ...variant,
      validation: {
        kind: "composite",
        parts: [selection, selection],
        partLabels: ["Only one label"],
      },
    };

    expect(issuesOf(broken, dataset)).toContain("composite-label-count");
  });
});

import { describe, expect, it } from "vitest";

import { DATASET_THEMES } from "@/data/datasets/themes";
import { generateVariant } from "@/domain/challenges/generateVariant";
import { navigationTemplates } from "@/domain/challenges/templates/navigation";
import type { ChallengeTemplate } from "@/domain/challenges/variantTypes";

const realTemplate = navigationTemplates[0];

describe("generateVariant", () => {
  it("is deterministic end to end", () => {
    const input = {
      template: realTemplate,
      themes: DATASET_THEMES,
      seed: "walk",
      difficulty: 4 as const,
    };

    expect(generateVariant(input)).toEqual(generateVariant(input));
  });

  it("terminates on a template that never produces a draw", () => {
    let calls = 0;
    const hopeless: ChallengeTemplate = {
      ...realTemplate,
      id: "gen.test.hopeless",
      generate: () => {
        calls += 1;

        return null;
      },
    };

    const variant = generateVariant({
      template: hopeless,
      themes: DATASET_THEMES,
      seed: "never",
      difficulty: 5,
    });

    expect(variant).toBeNull();
    // Bounded: at most MAX_ATTEMPTS per difficulty level, five levels.
    expect(calls).toBeLessThanOrEqual(40);
  });

  it("falls back to an easier preset when the requested difficulty cannot draw", () => {
    const fussy: ChallengeTemplate = {
      ...realTemplate,
      id: "gen.test.fussy",
      generate: (context) =>
        context.preset.difficulty === 1 ? realTemplate.generate(context) : null,
    };

    const variant = generateVariant({
      template: fussy,
      themes: DATASET_THEMES,
      seed: "fallback",
      difficulty: 3,
    });

    expect(variant).not.toBeNull();
    expect(variant?.difficulty).toBe(1);
    // The id carries the difficulty actually used, so the record book stays honest.
    expect(variant?.id).toContain(":d1");
  });
});

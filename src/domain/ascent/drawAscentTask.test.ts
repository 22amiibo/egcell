import { describe, expect, it } from "vitest";

import { generatedTemplates } from "@/data/challenges/generated";
import { DATASET_THEMES } from "@/data/datasets/themes";
import type { AscentDrawInput } from "@/domain/ascent/drawAscentTask";
import { drawAscentTask } from "@/domain/ascent/drawAscentTask";

function draw(overrides: Partial<AscentDrawInput> = {}) {
  return drawAscentTask({
    runSeed: "ascent:draw-test",
    index: 0,
    tier: 2,
    overdriveRungs: 0,
    lastTemplateIds: [],
    templates: generatedTemplates,
    themes: DATASET_THEMES,
    ...overrides,
  });
}

describe("drawAscentTask", () => {
  it("is deterministic: same input draws the same variant id and seed", () => {
    const a = draw({ runSeed: "ascent:det", index: 3 });
    const b = draw({ runSeed: "ascent:det", index: 3 });

    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a?.templateId).toBe(b?.templateId);
    expect(a?.seed).toBe(b?.seed);
  });

  it("draws different variants for different indices on the same run seed", () => {
    const results = new Set<string>();

    for (let index = 0; index < 8; index += 1) {
      const variant = draw({ runSeed: "ascent:spread", index });

      expect(variant).not.toBeNull();
      results.add(`${variant?.templateId}:${variant?.seed}`);
    }

    expect(results.size).toBeGreaterThan(1);
  });

  it("flows the requested tier into the drawn variant's difficulty", () => {
    for (const tier of [1, 2, 3, 4, 5] as const) {
      const variant = draw({ runSeed: `ascent:tier-${tier}`, tier });

      expect(variant).not.toBeNull();
      expect(variant?.difficulty).toBe(tier);
    }
  });

  it("does not draw the same template a third time in a row when the pool allows it", () => {
    for (let seedIndex = 0; seedIndex < 20; seedIndex += 1) {
      const runSeed = `ascent:no-three-${seedIndex}`;
      const first = draw({ runSeed, index: 0, lastTemplateIds: [] });

      expect(first).not.toBeNull();
      const firstId = first!.templateId;

      const third = draw({
        runSeed,
        index: 2,
        lastTemplateIds: [firstId, firstId],
      });

      expect(third).not.toBeNull();
      expect(third?.templateId).not.toBe(firstId);
    }
  });

  it("returns null when no template in the pool is seeded and sprint-eligible", () => {
    const variant = draw({
      templates: generatedTemplates.filter((template) => template.kind !== "seeded"),
    });

    expect(variant).toBeNull();
  });

  it("tightens scoring.targetSeconds under overdrive relative to a 0-rung draw", () => {
    const base = draw({ runSeed: "ascent:overdrive", index: 1, overdriveRungs: 0 });
    const rungOne = draw({ runSeed: "ascent:overdrive", index: 1, overdriveRungs: 1 });
    const rungThree = draw({ runSeed: "ascent:overdrive", index: 1, overdriveRungs: 3 });

    expect(base).not.toBeNull();
    expect(rungOne).not.toBeNull();
    expect(rungThree).not.toBeNull();

    const baseTarget = base!.scoring.targetSeconds;

    expect(rungOne!.scoring.targetSeconds).toBeCloseTo(Math.max(2, baseTarget * 0.9 ** 1));
    expect(rungThree!.scoring.targetSeconds).toBeCloseTo(Math.max(2, baseTarget * 0.9 ** 3));
    expect(rungOne!.scoring.targetSeconds).toBeLessThanOrEqual(baseTarget);
    expect(rungThree!.scoring.targetSeconds).toBeLessThanOrEqual(rungOne!.scoring.targetSeconds);
  });

  it("never tightens scoring.targetSeconds below the floor of 2 seconds", () => {
    const variant = draw({ runSeed: "ascent:floor", index: 1, overdriveRungs: 50 });

    expect(variant).not.toBeNull();
    expect(variant?.scoring.targetSeconds).toBeGreaterThanOrEqual(2);
  });
});

import { describe, expect, it } from "vitest";

import { selectionRevenueColumnChallenge } from "@/data/challenges";
import {
  createTemplateRegistry,
  fixedTemplate,
  materializeTemplate,
} from "@/domain/challenges/templateRegistry";

describe("createTemplateRegistry", () => {
  const template = fixedTemplate(selectionRevenueColumnChallenge);

  it("resolves a template by id and preserves registration order", () => {
    const registry = createTemplateRegistry([template]);

    expect(registry.byId(template.id)).toBe(template);
    expect(registry.all()).toEqual([template]);
    expect(registry.byFamily("selection")).toEqual([template]);
    expect(registry.families()).toEqual(["selection"]);
  });

  it("refuses a duplicate id at construction, when it is still cheap to fix", () => {
    expect(() => createTemplateRegistry([template, template])).toThrow(/duplicate/i);
  });
});

describe("fixedTemplate", () => {
  it("wraps a hand-authored challenge without changing its identity", () => {
    const template = fixedTemplate(selectionRevenueColumnChallenge);
    const variant = materializeTemplate(template, "any-seed", 3);

    // A fixed template ignores the draw: its id, seed, and grid are pinned, which is what keeps
    // every existing personal record resolving.
    expect(variant).not.toBeNull();
    expect(variant?.id).toBe(selectionRevenueColumnChallenge.id);
    expect(variant?.seed).toBe(selectionRevenueColumnChallenge.seed);
    expect(variant?.initialGrid).toBe(selectionRevenueColumnChallenge.initialGrid);
    expect(variant?.templateId).toBe(selectionRevenueColumnChallenge.id);
    expect(variant?.dimensions.themeId).toBe("classic-revenue");
  });
});

import { describe, expect, it } from "vitest";

import { SESSION_MODES } from "@/domain/sessions/sessionTypes";
import {
  categoryIdForMode,
  PERFORMANCE_CATEGORIES,
  performanceCategory,
} from "@/domain/stats/categories";

describe("PERFORMANCE_CATEGORIES", () => {
  it("gives every category a non-empty set of mode keys", () => {
    for (const category of PERFORMANCE_CATEGORIES) {
      expect(category.modeKeys.length).toBeGreaterThan(0);
    }
  });

  it("keeps the mode keys disjoint, so a run belongs to one category or to none — never two", () => {
    const seen = new Set<string>();

    for (const category of PERFORMANCE_CATEGORIES) {
      for (const modeKey of category.modeKeys) {
        expect(seen.has(modeKey)).toBe(false);
        seen.add(modeKey);
      }
    }
  });

  it("gives every category at least one metric, the first being its default", () => {
    for (const category of PERFORMANCE_CATEGORIES) {
      expect(category.metrics.length).toBeGreaterThan(0);
    }
  });

  it("demands a pure keyboard route for Hotkey, and for nothing else", () => {
    const pure = PERFORMANCE_CATEGORIES.filter(
      (category) => category.requires?.keyboardPure === true,
    );

    expect(pure.map((category) => category.id)).toEqual(["hotkey"]);
  });

  it("claims every session mode, so adding one cannot leave it off the graph unnoticed", () => {
    for (const mode of SESSION_MODES) {
      expect(categoryIdForMode(mode)).toBe(mode);
    }
  });
});

describe("categoryIdForMode", () => {
  it("maps the playable modes to their categories", () => {
    expect(categoryIdForMode("main-speed")).toBe("speed");
    expect(categoryIdForMode("practice")).toBe("practice");
    expect(categoryIdForMode("hotkey")).toBe("hotkey");
    expect(categoryIdForMode("sprint-10")).toBe("sprint-10");
  });

  it("returns null for a mode no category claims, rather than guessing one", () => {
    // A hand-edited blob, or a mode a later release removed. The run stays in the log and in
    // Recent Runs; it is excluded from every chart (§9.2). Excluded, never guessed.
    expect(categoryIdForMode("some-removed-mode")).toBeNull();
    expect(categoryIdForMode("")).toBeNull();
  });
});

describe("performanceCategory", () => {
  it("resolves an id to its category", () => {
    expect(performanceCategory("speed").label).toBe("Speed");
  });
});

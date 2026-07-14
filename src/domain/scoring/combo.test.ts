import { describe, expect, it } from "vitest";

import {
  advanceCombo,
  COMBO_RESET,
  comboMultiplier,
  comboOutcomeFrom,
} from "@/domain/scoring/combo";

describe("comboMultiplier", () => {
  it("starts at 1 and grows 0.1 per streak step", () => {
    expect(comboMultiplier(COMBO_RESET)).toBe(1);
    expect(comboMultiplier({ streak: 1 })).toBeCloseTo(1.1);
    expect(comboMultiplier({ streak: 5 })).toBeCloseTo(1.5);
  });

  it("caps at 1.5 for any longer streak", () => {
    expect(comboMultiplier({ streak: 6 })).toBeCloseTo(1.5);
    expect(comboMultiplier({ streak: 40 })).toBeCloseTo(1.5);
  });
});

describe("advanceCombo", () => {
  it("extends on an under-target, clean clear", () => {
    expect(advanceCombo({ streak: 2 }, { underTarget: true, clean: true })).toEqual({
      streak: 3,
    });
  });

  it("resets on an over-target clear", () => {
    expect(advanceCombo({ streak: 4 }, { underTarget: false, clean: true })).toEqual(COMBO_RESET);
  });

  it("resets on a dirty clear", () => {
    expect(advanceCombo({ streak: 4 }, { underTarget: true, clean: false })).toEqual(COMBO_RESET);
  });
});

describe("comboOutcomeFrom", () => {
  it("is clean when waste is zero and there are no corrections", () => {
    expect(
      comboOutcomeFrom({ elapsedMs: 4000, targetSeconds: 6, extraActions: 0, corrections: 0 }),
    ).toEqual({ underTarget: true, clean: true });
  });

  it("gives the benefit of the doubt when waste is unknowable", () => {
    expect(
      comboOutcomeFrom({ elapsedMs: 4000, targetSeconds: 6, extraActions: null, corrections: 0 }),
    ).toEqual({ underTarget: true, clean: true });
  });

  it("is dirty on wasted actions or corrections", () => {
    expect(
      comboOutcomeFrom({ elapsedMs: 4000, targetSeconds: 6, extraActions: 2, corrections: 0 })
        .clean,
    ).toBe(false);
    expect(
      comboOutcomeFrom({ elapsedMs: 4000, targetSeconds: 6, extraActions: 0, corrections: 1 })
        .clean,
    ).toBe(false);
  });

  it("is over target on the boundary's wrong side", () => {
    expect(
      comboOutcomeFrom({ elapsedMs: 6001, targetSeconds: 6, extraActions: 0, corrections: 0 })
        .underTarget,
    ).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { comboBreakRate, foldComboRunMetrics } from "@/domain/scoring/comboRunMetrics";
import type { ComboTaskOutcome } from "@/domain/scoring/combo";

const CLEAN: ComboTaskOutcome = { underTarget: true, clean: true };
const DIRTY: ComboTaskOutcome = { underTarget: false, clean: false };

function outcomes(...tags: Array<"clean" | "dirty">): ComboTaskOutcome[] {
  return tags.map((tag) => (tag === "clean" ? CLEAN : DIRTY));
}

describe("foldComboRunMetrics", () => {
  it("sustains a streak across an all-clean run: peak 5, no breaks, one opportunity per task after the first", () => {
    const metrics = foldComboRunMetrics(outcomes("clean", "clean", "clean", "clean", "clean"));

    expect(metrics).toEqual({ peakComboStreak: 5, comboBreakCount: 0, comboOpportunityCount: 4 });
  });

  it("reports the raw streak beyond COMBO_CAP — the peak is never clamped to 5", () => {
    const metrics = foldComboRunMetrics(
      outcomes("clean", "clean", "clean", "clean", "clean", "clean", "clean"),
    );

    expect(metrics.peakComboStreak).toBe(7);
    expect(metrics.comboBreakCount).toBe(0);
  });

  it("counts one break: two clean clears then a dirty one", () => {
    const metrics = foldComboRunMetrics(outcomes("clean", "clean", "dirty"));

    expect(metrics).toEqual({ peakComboStreak: 2, comboBreakCount: 1, comboOpportunityCount: 2 });
  });

  it("counts multiple breaks: clean, dirty, clean, dirty never lets the streak past 1", () => {
    const metrics = foldComboRunMetrics(outcomes("clean", "dirty", "clean", "dirty"));

    expect(metrics).toEqual({ peakComboStreak: 1, comboBreakCount: 2, comboOpportunityCount: 2 });
    expect(comboBreakRate(metrics)).toBe(1);
  });

  it("does not count a dirty task as a break when no combo was active yet (leading dirty)", () => {
    const metrics = foldComboRunMetrics(outcomes("dirty", "clean", "clean"));

    // The leading dirty task enters at streak 0 — dead, not active — so it is not an opportunity
    // and cannot be a break. Only the two clean clears that follow it are on record.
    expect(metrics).toEqual({ peakComboStreak: 2, comboBreakCount: 0, comboOpportunityCount: 1 });
  });

  it("counts exactly one break for one dirty task while a combo is active", () => {
    const metrics = foldComboRunMetrics(outcomes("clean", "dirty", "clean"));

    expect(metrics.comboBreakCount).toBe(1);
  });

  it("the (b) contrast pair — never active (all dirty) is null-rate, not zero-rate", () => {
    const neverActive = foldComboRunMetrics(outcomes("dirty", "dirty", "dirty"));

    expect(neverActive).toEqual({ peakComboStreak: 0, comboBreakCount: 0, comboOpportunityCount: 0 });
    expect(comboBreakRate(neverActive)).toBeNull();
  });

  it("the (b) contrast pair — always active and never broken (all clean) is zero-rate, not null", () => {
    const neverBroken = foldComboRunMetrics(outcomes("clean", "clean", "clean"));

    expect(neverBroken.comboOpportunityCount).toBeGreaterThan(0);
    expect(neverBroken.comboBreakCount).toBe(0);
    expect(comboBreakRate(neverBroken)).toBe(0);
  });

  it("folds an empty run to all zeros, with a null rate", () => {
    const metrics = foldComboRunMetrics([]);

    expect(metrics).toEqual({ peakComboStreak: 0, comboBreakCount: 0, comboOpportunityCount: 0 });
    expect(comboBreakRate(metrics)).toBeNull();
  });
});

describe("comboBreakRate", () => {
  it("divides breaks by opportunities when there were any", () => {
    expect(
      comboBreakRate({ peakComboStreak: 4, comboBreakCount: 1, comboOpportunityCount: 4 }),
    ).toBe(0.25);
  });

  it("is null when there were no opportunities, never zero", () => {
    expect(
      comboBreakRate({ peakComboStreak: 0, comboBreakCount: 0, comboOpportunityCount: 0 }),
    ).toBeNull();
  });
});

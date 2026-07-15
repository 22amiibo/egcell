import { describe, expect, it } from "vitest";

import {
  ASCENT_START,
  type AscentTaskOutcome,
} from "@/domain/ascent/ascentTypes";
import { advanceAscent } from "@/domain/ascent/ascentEngine";

describe("advanceAscent", () => {
  describe("heat and promotions", () => {
    it("increments heat on under-target completion", () => {
      const outcome: AscentTaskOutcome = { completed: true, underTarget: true };
      const next = advanceAscent(ASCENT_START, outcome);

      expect(next.heat).toBe(1);
      expect(next.tier).toBe(1);
      expect(next.tasksCompleted).toBe(1);
    });

    it("promotes after three under-target clears", () => {
      const outcome: AscentTaskOutcome = { completed: true, underTarget: true };
      let state = ASCENT_START;

      state = advanceAscent(state, outcome);
      expect(state.heat).toBe(1);
      expect(state.tier).toBe(1);

      state = advanceAscent(state, outcome);
      expect(state.heat).toBe(2);
      expect(state.tier).toBe(1);

      state = advanceAscent(state, outcome);
      expect(state.heat).toBe(0);
      expect(state.tier).toBe(2);
      expect(state.tasksCompleted).toBe(3);
    });
  });

  describe("slow clear resets heat without dropping tier", () => {
    it("resets heat on completed but not under-target clear", () => {
      const underTarget: AscentTaskOutcome = { completed: true, underTarget: true };
      const slowClear: AscentTaskOutcome = { completed: true, underTarget: false };
      let state = ASCENT_START;

      // Build up heat
      state = advanceAscent(state, underTarget);
      state = advanceAscent(state, underTarget);
      expect(state.heat).toBe(2);

      // Slow clear resets heat but keeps tier
      state = advanceAscent(state, slowClear);
      expect(state.heat).toBe(0);
      expect(state.tier).toBe(1);
      expect(state.tasksCompleted).toBe(3);
    });
  });

  describe("peakTier tracks high water", () => {
    it("updates peakTier when promoted beyond previous peak", () => {
      const outcome: AscentTaskOutcome = { completed: true, underTarget: true };
      let state = ASCENT_START;

      expect(state.peakTier).toBe(1);

      // Promote to tier 2
      for (let i = 0; i < 3; i++) {
        state = advanceAscent(state, outcome);
      }
      expect(state.tier).toBe(2);
      expect(state.peakTier).toBe(2);

      // Promote to tier 3
      for (let i = 0; i < 3; i++) {
        state = advanceAscent(state, outcome);
      }
      expect(state.tier).toBe(3);
      expect(state.peakTier).toBe(3);
    });

    it("does not drop peakTier when heat resets", () => {
      const underTarget: AscentTaskOutcome = { completed: true, underTarget: true };
      const slowClear: AscentTaskOutcome = { completed: true, underTarget: false };
      let state = ASCENT_START;

      // Promote to tier 2
      for (let i = 0; i < 3; i++) {
        state = advanceAscent(state, underTarget);
      }
      expect(state.peakTier).toBe(2);

      // Slow clear resets heat but doesn't touch peakTier
      state = advanceAscent(state, slowClear);
      expect(state.peakTier).toBe(2);
      expect(state.tier).toBe(2);
    });
  });

  describe("overdrive rungs at max tier", () => {
    it("starts accumulating overdrive rungs at tier 5", () => {
      const outcome: AscentTaskOutcome = { completed: true, underTarget: true };
      let state = ASCENT_START;

      // Promote from tier 1 to 5
      for (let t = 1; t < 5; t++) {
        for (let i = 0; i < 3; i++) {
          state = advanceAscent(state, outcome);
        }
      }
      expect(state.tier).toBe(5);
      expect(state.overdriveRungs).toBe(0);
      expect(state.heat).toBe(0);

      // Next promotion becomes an overdrive rung, tier stays 5
      state = advanceAscent(state, outcome);
      expect(state.heat).toBe(1);
      expect(state.tier).toBe(5);
      expect(state.overdriveRungs).toBe(0);

      state = advanceAscent(state, outcome);
      expect(state.heat).toBe(2);
      expect(state.tier).toBe(5);
      expect(state.overdriveRungs).toBe(0);

      state = advanceAscent(state, outcome);
      expect(state.heat).toBe(0);
      expect(state.tier).toBe(5);
      expect(state.overdriveRungs).toBe(1);
    });
  });

  describe("skip behavior", () => {
    it("increments tasksCompleted only on completed true", () => {
      const completed: AscentTaskOutcome = { completed: true, underTarget: true };
      const skipped: AscentTaskOutcome = { completed: false, underTarget: false };

      let state = ASCENT_START;
      expect(state.tasksCompleted).toBe(0);

      state = advanceAscent(state, completed);
      expect(state.tasksCompleted).toBe(1);

      state = advanceAscent(state, skipped);
      expect(state.tasksCompleted).toBe(1);
    });

    it("resets heat on skip", () => {
      const underTarget: AscentTaskOutcome = { completed: true, underTarget: true };
      const skipped: AscentTaskOutcome = { completed: false, underTarget: false };
      let state = ASCENT_START;

      // Build up heat
      state = advanceAscent(state, underTarget);
      state = advanceAscent(state, underTarget);
      expect(state.heat).toBe(2);

      // Skip resets heat
      state = advanceAscent(state, skipped);
      expect(state.heat).toBe(0);
      expect(state.tier).toBe(1);
      expect(state.tasksCompleted).toBe(2);
    });
  });
});

import { describe, expect, it } from "vitest";

import type { ChallengeVariant } from "@/domain/challenges/variantTypes";
import {
  OVERDRIVE_TIGHTENING,
  TIER_WEIGHT_STEP,
  ascentTaskScore,
  effectiveTargetSeconds,
  tierWeight,
  withTightenedTarget,
} from "@/domain/ascent/ascentScore";

describe("tierWeight", () => {
  it("tier 1 with no rungs = 1", () => {
    const weight = tierWeight({ tier: 1, overdriveRungs: 0 });
    expect(weight).toBe(1);
  });

  it("tier 3 with no rungs = 1.5", () => {
    const weight = tierWeight({ tier: 3, overdriveRungs: 0 });
    expect(weight).toBe(1.5);
  });

  it("tier 5 with no rungs = 2", () => {
    const weight = tierWeight({ tier: 5, overdriveRungs: 0 });
    expect(weight).toBe(2);
  });

  it("tier 5 with 1 rung = 2.25 (overdrive stacks)", () => {
    const weight = tierWeight({ tier: 5, overdriveRungs: 1 });
    expect(weight).toBe(2 + TIER_WEIGHT_STEP);
  });

  it("tier 5 with 4 rungs = 3 (continues stacking)", () => {
    const weight = tierWeight({ tier: 5, overdriveRungs: 4 });
    expect(weight).toBe(2 + 4 * TIER_WEIGHT_STEP);
  });

  it("tier 2 with 2 rungs combines tier and rungs", () => {
    const weight = tierWeight({ tier: 2, overdriveRungs: 2 });
    expect(weight).toBe(1 + TIER_WEIGHT_STEP * (2 - 1 + 2));
  });
});

describe("ascentTaskScore", () => {
  it("applies tier weight with rounding", () => {
    const score = ascentTaskScore(100, { tier: 1, overdriveRungs: 0 });
    expect(score).toBe(100);
  });

  it("rounds result to nearest integer", () => {
    // 100 * 1.5 = 150
    const score = ascentTaskScore(100, { tier: 3, overdriveRungs: 0 });
    expect(score).toBe(150);
  });

  it("rounds down when appropriate", () => {
    // 99 * 1.5 = 148.5, rounds to 148 or 149 depending on rounding
    const score = ascentTaskScore(99, { tier: 3, overdriveRungs: 0 });
    expect(score).toBe(Math.round(99 * 1.5));
  });

  it("tier 5 doubles the score", () => {
    const score = ascentTaskScore(100, { tier: 5, overdriveRungs: 0 });
    expect(score).toBe(200);
  });

  it("applies overdrive scaling on top of tier", () => {
    // tier 5 = 2, tier 5 + 1 rung = 2.25
    const scoreNoRung = ascentTaskScore(100, { tier: 5, overdriveRungs: 0 });
    const scoreWithRung = ascentTaskScore(100, { tier: 5, overdriveRungs: 1 });
    expect(scoreWithRung).toBe(225);
    expect(scoreWithRung).toBeGreaterThan(scoreNoRung);
  });
});

describe("effectiveTargetSeconds", () => {
  it("returns base at 0 rungs", () => {
    const effective = effectiveTargetSeconds(10, 0);
    expect(effective).toBe(10);
  });

  it("tightens target for each rung by OVERDRIVE_TIGHTENING factor", () => {
    // With 1 rung: 10 * 0.9 = 9
    const effective1 = effectiveTargetSeconds(10, 1);
    expect(effective1).toBe(10 * OVERDRIVE_TIGHTENING);
  });

  it("compounds tightening over multiple rungs", () => {
    // With 2 rungs: 10 * 0.9 * 0.9 = 8.1
    const effective2 = effectiveTargetSeconds(10, 2);
    expect(effective2).toBe(10 * OVERDRIVE_TIGHTENING ** 2);
  });

  it("enforces 2s minimum floor", () => {
    const effective = effectiveTargetSeconds(10, 100);
    expect(effective).toBe(2);
  });

  it("respects floor even at low rungs with small base", () => {
    const effective = effectiveTargetSeconds(2.5, 5);
    expect(effective).toBeGreaterThanOrEqual(2);
  });
});

describe("withTightenedTarget", () => {
  const baseVariant: ChallengeVariant = {
    id: "test-1",
    version: "1.0",
    slug: "test",
    title: "Test",
    prompt: "Test prompt",
    family: "navigation",
    difficulty: 3,
    seed: "seed",
    timingPolicy: { kind: "single-challenge", targetSeconds: 10 },
    initialGrid: {
      rowCount: 10,
      colCount: 10,
      usedRange: { start: { row: 0, col: 0 }, end: { row: 9, col: 9 } },
      headerRows: 1,
      columns: ["A", "B", "C"],
      rows: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      cells: {},
      activeCell: { row: 0, col: 0 },
      selection: { kind: "cell", cell: { row: 0, col: 0 } },
      hiddenRows: [],
      sortState: null,
      filters: [],
    },
    allowedActions: ["select-cell"],
    validation: { kind: "navigation", requiredCell: { row: 0, col: 0 } },
    scoring: { basePoints: 100, targetSeconds: 10, minimumCorrectnessForPr: 0.8 },
    practiceNotes: [],
    templateId: "test-template",
    templateVersion: "1.0",
    dimensions: {
      themeId: "light",
      rowCount: 10,
      colCount: 10,
      columnOrder: [],
      distractorRoles: [],
      chainLength: 1,
    },
    sprintEligible: true,
    timedEligible: true,
    leaderboardEligible: true,
  };

  it("returns identical reference at 0 rungs", () => {
    const tightened = withTightenedTarget(baseVariant, 0);
    expect(tightened).toBe(baseVariant);
  });

  it("creates new variant at >0 rungs", () => {
    const tightened = withTightenedTarget(baseVariant, 1);
    expect(tightened).not.toBe(baseVariant);
  });

  it("tightens targetSeconds in timingPolicy for >0 rungs", () => {
    const tightened = withTightenedTarget(baseVariant, 1);
    const expected = 10 * OVERDRIVE_TIGHTENING;
    expect(tightened.timingPolicy).toEqual({
      kind: "single-challenge",
      targetSeconds: expected,
    });
  });

  it("tightens targetSeconds in scoring config for >0 rungs", () => {
    const tightened = withTightenedTarget(baseVariant, 1);
    const expected = 10 * OVERDRIVE_TIGHTENING;
    expect(tightened.scoring.targetSeconds).toBe(expected);
  });

  it("updates both timingPolicy and scoring consistently at 2 rungs", () => {
    const tightened = withTightenedTarget(baseVariant, 2);
    const expected = 10 * OVERDRIVE_TIGHTENING ** 2;
    expect(tightened.timingPolicy).toEqual({
      kind: "single-challenge",
      targetSeconds: expected,
    });
    expect(tightened.scoring.targetSeconds).toBe(expected);
  });

  it("preserves all other variant fields", () => {
    const tightened = withTightenedTarget(baseVariant, 1);
    expect(tightened.id).toBe(baseVariant.id);
    expect(tightened.title).toBe(baseVariant.title);
    expect(tightened.difficulty).toBe(baseVariant.difficulty);
    expect(tightened.validation).toBe(baseVariant.validation);
  });

  it("applies 2s floor in tightened target", () => {
    const variant: ChallengeVariant = { ...baseVariant, scoring: { ...baseVariant.scoring, targetSeconds: 2.5 } };
    const tightened = withTightenedTarget(variant, 5);
    const policy = tightened.timingPolicy;
    if (policy.kind === "single-challenge") {
      expect(policy.targetSeconds).toBe(2);
    }
    expect(tightened.scoring.targetSeconds).toBe(2);
  });
});

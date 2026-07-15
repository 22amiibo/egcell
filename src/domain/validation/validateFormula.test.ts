import { describe, expect, it } from "vitest";

import type { Challenge } from "@/domain/challenges/challengeTypes";
import { parseCellInput } from "@/domain/grid/editing";
import { gridReducer } from "@/domain/grid/gridReducer";
import type { CellAddress, CellValue, GridState } from "@/domain/grid/gridTypes";
import type { RunState } from "@/domain/runs/runTypes";
import { validateFormula } from "@/domain/validation/validateFormula";
import type { SpecOfKind, ValidationInput } from "@/domain/validation/validatorTypes";
import { createRevenueGrid } from "@/test/fixtures/revenueGrid";

/**
 * A9, just past the fixed dataset's used range (rows 0-6, cols 0-4): free to hold a "total" the
 * player writes, without colliding with any Revenue figure the formula reads.
 */
const TARGET: CellAddress = { row: 8, col: 0 };
/** A10 — a second free cell, used only by the "unaccepted form" row to hold a total some other way. */
const REFERENCE: CellAddress = { row: 9, col: 0 };
/** The sum of the fixed dataset's Revenue column (C2:C7): 128400+94250+156900+72100+143750+88300. */
const EXPECTED_TOTAL = 683700;
const ACCEPTED_FORMULA = "=SUM(C2:C7)";

const spec: SpecOfKind<"formula"> = {
  kind: "formula",
  cell: TARGET,
  acceptedFormulas: [ACCEPTED_FORMULA],
  expectedValue: EXPECTED_TOTAL,
};

function stubChallenge(): Challenge {
  return {
    id: "test.formula",
    version: "v1",
    slug: "test-formula",
    title: "Test formula",
    prompt: "Total the Revenue column.",
    family: "formula",
    difficulty: 1,
    seed: "test-formula-v1",
    timingPolicy: { kind: "single-challenge", targetSeconds: 10 },
    initialGrid: createRevenueGrid(),
    allowedActions: ["select-cell", "set-cell-value"],
    validation: spec,
    scoring: { basePoints: 100, targetSeconds: 10, minimumCorrectnessForPr: 1 },
    practiceNotes: [],
  };
}

function runFor(challenge: Challenge): RunState {
  return {
    challengeId: challenge.id,
    challengeVersion: challenge.version,
    seed: challenge.seed,
    mode: "main-speed",
    status: "running",
    startedAt: 0,
    finishedAt: null,
    elapsedMs: 0,
    events: [],
  };
}

/** Commits a value through the real reducer, so a formula's `computed` is always honest. */
function commit(grid: GridState, cell: CellAddress, value: CellValue): GridState {
  return gridReducer(grid, { kind: "set-cell-value", cell, value });
}

function inputWithGrid(grid: GridState): ValidationInput {
  const challenge = stubChallenge();

  return { challenge, grid, run: runFor(challenge) };
}

describe("validateFormula", () => {
  it("prompts while the cell is still blank", () => {
    const result = validateFormula(inputWithGrid(createRevenueGrid()), spec);

    expect(result.isComplete).toBe(false);
    expect(result.correctness).toBe(0);
    expect(result.messages[0].text).toBe("Type a formula into A9.");
  });

  it("rejects the right number typed as a literal, and says why", () => {
    const grid = commit(createRevenueGrid(), TARGET, { kind: "number", value: EXPECTED_TOTAL });
    const result = validateFormula(inputWithGrid(grid), spec);

    expect(result.isComplete).toBe(false);
    expect(result.correctness).toBe(0);
    expect(result.messages[0].text).toMatch(/formula/i);
  });

  it("rejects a non-formula value that is not even the right number", () => {
    const grid = commit(createRevenueGrid(), TARGET, { kind: "text", value: "nope" });
    const result = validateFormula(inputWithGrid(grid), spec);

    expect(result.isComplete).toBe(false);
    expect(result.messages[0].text).toBe("A9 needs a formula starting with =.");
  });

  it("gives half credit to an unaccepted form that computes the target", () => {
    // =A10 is not the accepted shape, but A10 happens to hold the total some other way.
    const withReference = commit(createRevenueGrid(), REFERENCE, {
      kind: "number",
      value: EXPECTED_TOTAL,
    });
    const grid = commit(withReference, TARGET, parseCellInput("=A10", withReference));
    const result = validateFormula(inputWithGrid(grid), spec);

    expect(result.isComplete).toBe(false);
    expect(result.correctness).toBe(0.5);
    expect(result.messages[0].text).toContain(ACCEPTED_FORMULA);
  });

  it("rejects an accepted-form formula whose computed value is wrong", () => {
    // The formula itself is honest — it really does sum C2:C7 — but this spec was authored (or the
    // data changed) so that sum no longer matches the target it grades against.
    const wrongTarget: SpecOfKind<"formula"> = { ...spec, expectedValue: EXPECTED_TOTAL + 1000 };
    const base = createRevenueGrid();
    const grid = commit(base, TARGET, parseCellInput(ACCEPTED_FORMULA, base));
    const result = validateFormula(inputWithGrid(grid), wrongTarget);

    expect(result.isComplete).toBe(false);
    expect(result.correctness).toBe(0);
    expect(result.messages[0].text).toBe("That formula does not compute the target.");
  });

  it("passes an accepted form that computes the target", () => {
    const base = createRevenueGrid();
    const grid = commit(base, TARGET, parseCellInput(ACCEPTED_FORMULA, base));
    const result = validateFormula(inputWithGrid(grid), spec);

    expect(result.isComplete).toBe(true);
    expect(result.correctness).toBe(1);
    expect(result.accuracy).toBe(1);
    expect(result.messages[0].text).toContain("A9");
  });
});

import { describe, expect, it } from "vitest";

import type { Challenge } from "@/domain/challenges/challengeTypes";
import { gridReducer } from "@/domain/grid/gridReducer";
import type { CellAddress, CellValue, GridState } from "@/domain/grid/gridTypes";
import type { RunState } from "@/domain/runs/runTypes";
import { validateValue } from "@/domain/validation/validateValue";
import type { SpecOfKind, ValidationInput } from "@/domain/validation/validatorTypes";
import { createRevenueGrid } from "@/test/fixtures/revenueGrid";

/** A9, just past the fixed dataset's used range — free for a player to write into. */
const TARGET: CellAddress = { row: 8, col: 0 };

const numberSpec: SpecOfKind<"cell-value"> = {
  kind: "cell-value",
  cell: TARGET,
  expected: { kind: "number", value: 42 },
};

const textSpec: SpecOfKind<"cell-value"> = {
  kind: "cell-value",
  cell: TARGET,
  expected: { kind: "text", value: "Total" },
};

function stubChallenge(spec: SpecOfKind<"cell-value">): Challenge {
  return {
    id: "test.cell-value",
    version: "v1",
    slug: "test-cell-value",
    title: "Test cell value",
    prompt: "Write the value into A9.",
    family: "formula",
    difficulty: 1,
    seed: "test-cell-value-v1",
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

function commit(grid: GridState, cell: CellAddress, value: CellValue): GridState {
  return gridReducer(grid, { kind: "set-cell-value", cell, value });
}

function inputWithValue(spec: SpecOfKind<"cell-value">, value?: CellValue): ValidationInput {
  const challenge = stubChallenge(spec);
  const grid =
    value === undefined ? challenge.initialGrid : commit(challenge.initialGrid, TARGET, value);

  return { challenge, grid, run: runFor(challenge) };
}

describe("validateValue", () => {
  it("fails while the cell is still blank", () => {
    const result = validateValue(inputWithValue(numberSpec), numberSpec);

    expect(result.isComplete).toBe(false);
    expect(result.correctness).toBe(0);
    expect(result.messages[0].text).toBe("Type the value into A9.");
  });

  it("passes when a number is expected and the cell matches", () => {
    const result = validateValue(inputWithValue(numberSpec, { kind: "number", value: 42 }), numberSpec);

    expect(result.isComplete).toBe(true);
    expect(result.correctness).toBe(1);
    expect(result.accuracy).toBe(1);
  });

  it("fails when a number is expected and the cell holds the wrong number", () => {
    const result = validateValue(inputWithValue(numberSpec, { kind: "number", value: 41 }), numberSpec);

    expect(result.isComplete).toBe(false);
  });

  it("fails when a number is expected but the cell holds text", () => {
    const result = validateValue(
      inputWithValue(numberSpec, { kind: "text", value: "42" }),
      numberSpec,
    );

    expect(result.isComplete).toBe(false);
  });

  it("passes when text is expected and the cell matches after trimming", () => {
    const result = validateValue(
      inputWithValue(textSpec, { kind: "text", value: "  Total  " }),
      textSpec,
    );

    expect(result.isComplete).toBe(true);
    expect(result.correctness).toBe(1);
  });

  it("fails when text is expected and the cell holds different text", () => {
    const result = validateValue(
      inputWithValue(textSpec, { kind: "text", value: "Subtotal" }),
      textSpec,
    );

    expect(result.isComplete).toBe(false);
    expect(result.messages[0].text).toBe("A9 does not hold the value we need yet.");
  });

  it("fails when text is expected but the cell holds a number", () => {
    const result = validateValue(inputWithValue(textSpec, { kind: "number", value: 7 }), textSpec);

    expect(result.isComplete).toBe(false);
  });
});

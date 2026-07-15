import { describe, expect, it } from "vitest";

import { DATASET_THEMES } from "@/data/datasets/themes";
import { ALL_DIFFICULTIES } from "@/domain/challenges/difficulty";
import { generateVariant } from "@/domain/challenges/generateVariant";
import { formulaTemplates, withTargetRow } from "@/domain/challenges/templates/formula";
import type { ChallengeVariant } from "@/domain/challenges/variantTypes";
import type { DatasetTheme, GeneratedGrid } from "@/domain/datasets/datasetTypes";
import { parseCellInput } from "@/domain/grid/editing";
import { gridReducer } from "@/domain/grid/gridReducer";
import type { CellValue, GridAction, GridState } from "@/domain/grid/gridTypes";
import { cellKey } from "@/domain/grid/range";
import type { RunState } from "@/domain/runs/runTypes";
import { validateChallenge } from "@/domain/validation/validateChallenge";

function runFor(variant: ChallengeVariant): RunState {
  return {
    challengeId: variant.id,
    challengeVersion: variant.version,
    seed: variant.seed,
    mode: "main-speed",
    status: "running",
    startedAt: 0,
    finishedAt: null,
    elapsedMs: 0,
    events: [],
  };
}

function validate(variant: ChallengeVariant, grid: GridState) {
  return validateChallenge({ challenge: variant, grid, run: runFor(variant) });
}

function byId(id: string) {
  const template = formulaTemplates.find((candidate) => candidate.id === id);

  if (template === undefined) {
    throw new Error(`Missing formula template ${id}.`);
  }

  return template;
}

/** The action a player who read the target correctly would dispatch. */
function solvingAction(variant: ChallengeVariant): GridAction {
  const spec = variant.validation;

  if (spec.kind === "formula") {
    return {
      kind: "set-cell-value",
      cell: spec.cell,
      value: parseCellInput(spec.acceptedFormulas[0], variant.initialGrid),
    };
  }

  if (spec.kind === "cell-value") {
    const value: CellValue =
      spec.expected.kind === "number"
        ? { kind: "number", value: spec.expected.value }
        : { kind: "text", value: spec.expected.value };

    return { kind: "set-cell-value", cell: spec.cell, value };
  }

  throw new Error(`Unexpected generated formula spec kind: ${spec.kind}.`);
}

/** A wrong-but-plausible action: a number that misses the target by one. */
function nearMissAction(variant: ChallengeVariant): GridAction {
  const spec = variant.validation;

  if (spec.kind === "formula") {
    return {
      kind: "set-cell-value",
      cell: spec.cell,
      value: { kind: "number", value: spec.expectedValue + 1 },
    };
  }

  if (spec.kind === "cell-value") {
    const value: CellValue =
      spec.expected.kind === "number"
        ? { kind: "number", value: spec.expected.value + 1 }
        : { kind: "text", value: `${spec.expected.value}x` };

    return { kind: "set-cell-value", cell: spec.cell, value };
  }

  throw new Error(`Unexpected generated formula spec kind: ${spec.kind}.`);
}

const eachTemplate = formulaTemplates.map((template) => [template.id, template] as const);

describe("formula templates", () => {
  it.each(eachTemplate)("%s generates deterministically", (_id, template) => {
    const first = generateVariant({ template, themes: DATASET_THEMES, seed: "det", difficulty: 3 });
    const second = generateVariant({ template, themes: DATASET_THEMES, seed: "det", difficulty: 3 });

    expect(first).not.toBeNull();
    expect(first).toEqual(second);
  });

  it.each(eachTemplate)("%s actually varies across seeds", (_id, template) => {
    const dimensions = new Set(
      Array.from({ length: 8 }, (_, draw) =>
        JSON.stringify(
          generateVariant({ template, themes: DATASET_THEMES, seed: `vary-${draw}`, difficulty: 3 })
            ?.dimensions,
        ),
      ),
    );

    expect(dimensions.size).toBeGreaterThan(1);
  });

  it.each(eachTemplate)("%s is family formula with the right allowed actions", (_id, template) => {
    const variant = generateVariant({ template, themes: DATASET_THEMES, seed: "shape", difficulty: 3 });

    expect(variant).not.toBeNull();
    expect(variant?.family).toBe("formula");
    expect(variant?.allowedActions).toEqual(["select-cell", "set-cell-value"]);
  });

  // The eligibility fuzz, and the real solve-by-replay guarantee: every template, every
  // difficulty, many seeds. The untouched grid must not be complete, the winning action (replayed
  // through the real reducer) must complete it, and a near-miss must not.
  it.each(eachTemplate)("%s survives the fuzz and is solvable by one commit", (_id, template) => {
    for (const difficulty of ALL_DIFFICULTIES) {
      for (let draw = 0; draw < 8; draw += 1) {
        const variant = generateVariant({
          template,
          themes: DATASET_THEMES,
          seed: `fuzz-${difficulty}-${draw}`,
          difficulty,
        });

        expect(variant).not.toBeNull();

        const solved = variant as ChallengeVariant;

        expect(validate(solved, solved.initialGrid).isComplete).toBe(false);

        const afterSolve = gridReducer(solved.initialGrid, solvingAction(solved));

        expect(validate(solved, afterSolve).isComplete).toBe(true);

        const afterMiss = gridReducer(solved.initialGrid, nearMissAction(solved));

        expect(validate(solved, afterMiss).isComplete).toBe(false);
      }
    }
  });

  it("gives every template a stable drill id carrying template and difficulty, not the seed", () => {
    for (const template of formulaTemplates) {
      const a = generateVariant({ template, themes: DATASET_THEMES, seed: "id-a", difficulty: 2 });
      const b = generateVariant({ template, themes: DATASET_THEMES, seed: "id-b", difficulty: 2 });

      expect(a?.id).toBe(`${template.id}@${template.version}:d2`);
      expect(a?.id).toBe(b?.id);
      expect(a?.seed).not.toBe(b?.seed);
    }
  });

  describe("gen.formula.sum-column", () => {
    it("stores a normalized SUM formula over the data rows, and solving it completes the run", () => {
      const variant = generateVariant({
        template: byId("gen.formula.sum-column"),
        themes: DATASET_THEMES,
        seed: "sum-solve",
        difficulty: 3,
      });

      expect(variant).not.toBeNull();

      const spec = (variant as ChallengeVariant).validation;

      if (spec.kind !== "formula") {
        throw new Error("Expected a formula spec.");
      }

      expect(spec.acceptedFormulas[0]).toMatch(/^=SUM\([A-Z]+\d+:[A-Z]+\d+\)$/);
      expect(spec.acceptedFormulas[0].replace(/\s+/g, "").toUpperCase()).toBe(
        spec.acceptedFormulas[0],
      );

      const solved = gridReducer(
        (variant as ChallengeVariant).initialGrid,
        solvingAction(variant as ChallengeVariant),
      );

      expect(validate(variant as ChallengeVariant, solved).isComplete).toBe(true);
    });
  });

  describe("gen.formula.average-column", () => {
    it("stores a normalized AVERAGE formula over the data rows, and solving it completes the run", () => {
      const variant = generateVariant({
        template: byId("gen.formula.average-column"),
        themes: DATASET_THEMES,
        seed: "average-solve",
        difficulty: 3,
      });

      expect(variant).not.toBeNull();

      const spec = (variant as ChallengeVariant).validation;

      if (spec.kind !== "formula") {
        throw new Error("Expected a formula spec.");
      }

      expect(spec.acceptedFormulas[0]).toMatch(/^=AVERAGE\([A-Z]+\d+:[A-Z]+\d+\)$/);
      expect(spec.acceptedFormulas[0].replace(/\s+/g, "").toUpperCase()).toBe(
        spec.acceptedFormulas[0],
      );

      const solved = gridReducer(
        (variant as ChallengeVariant).initialGrid,
        solvingAction(variant as ChallengeVariant),
      );

      expect(validate(variant as ChallengeVariant, solved).isComplete).toBe(true);
    });
  });

  describe("gen.formula.copy-value", () => {
    it("targets a blank cell in a uniquely-named row, and typing the real value completes the run", () => {
      const variant = generateVariant({
        template: byId("gen.formula.copy-value"),
        themes: DATASET_THEMES,
        seed: "copy-solve",
        difficulty: 3,
      });

      expect(variant).not.toBeNull();

      const solved = variant as ChallengeVariant;
      const spec = solved.validation;

      if (spec.kind !== "cell-value") {
        throw new Error("Expected a cell-value spec.");
      }

      // The target cell starts blank: the player has something real to type.
      expect(solved.initialGrid.cells[cellKey(spec.cell)]).toBeUndefined();
      expect(solved.dimensions.targetLabel).toBeDefined();

      const afterSolve = gridReducer(solved.initialGrid, solvingAction(solved));

      expect(validate(solved, afterSolve).isComplete).toBe(true);
    });

    // A theme whose name pool cannot produce a unique target: every draw sees a duplicate name,
    // so the eligibility gate (by-name-ambiguous) must reject every attempt at every difficulty,
    // and generateVariant must exhaust its retries and hand back null.
    const tinyNameTheme: DatasetTheme = {
      id: "tiny-names",
      label: "Tiny names",
      columns: [
        { role: "category", header: "Region", type: "text", values: ["East", "West"] },
        { role: "name", header: "Rep", type: "text", values: ["OnlyOne"] },
        {
          role: "amount",
          header: "Revenue",
          type: "number",
          numberFormat: "currency",
          range: [100, 500],
        },
        { role: "count", header: "Units", type: "number", range: [1, 20] },
        { role: "rate", header: "Margin", type: "number", numberFormat: "percent", range: [5, 95] },
        { role: "status", header: "Status", type: "text", values: ["Complete", "Pending"] },
        { role: "date", header: "Close Date", type: "date", numberFormat: "date" },
        { role: "note", header: "Notes", type: "text", values: ["Follow up"] },
      ],
    };

    it("redraws to null when the name column can never produce a unique target", () => {
      const variant = generateVariant({
        template: byId("gen.formula.copy-value"),
        themes: [tinyNameTheme],
        seed: "no-unique-name",
        difficulty: 3,
      });

      expect(variant).toBeNull();
    });
  });
});

describe("withTargetRow", () => {
  function fakeDataset(rowCount: number): GeneratedGrid {
    const grid: GridState = {
      rowCount,
      colCount: 3,
      usedRange: { start: { row: 0, col: 0 }, end: { row: 2, col: 2 } },
      headerRows: 1,
      columns: ["A", "B", "C"],
      rows: Array.from({ length: rowCount }, (_, index) => index + 1),
      cells: {},
      activeCell: { row: 0, col: 0 },
      selection: { kind: "none" },
      hiddenRows: [],
      sortState: null,
      filters: [],
    };

    return {
      grid,
      themeId: "test",
      columnsByRole: {},
      headersByCol: {},
      headerRow: 0,
      firstDataRow: 1,
      lastDataRow: 2,
      firstCol: 0,
      lastCol: 2,
      distractorCols: [],
      blanksByCol: {},
    };
  }

  it("returns null when the grid has no spare row below the table", () => {
    // lastDataRow is 2, so the label row would be row 3 — out of bounds when rowCount is only 3.
    const dataset = fakeDataset(3);

    expect(withTargetRow(dataset, 1, "Total")).toBeNull();
  });

  it("adds a bold labelled row and returns the target cell when room exists", () => {
    const dataset = fakeDataset(6);
    const result = withTargetRow(dataset, 1, "Total");

    expect(result).not.toBeNull();
    expect(result?.target).toEqual({ row: 3, col: 1 });

    const labelCell = result?.dataset.grid.cells[cellKey({ row: 3, col: 0 })];

    expect(labelCell?.value).toEqual({ kind: "text", value: "Total" });
    expect(labelCell?.format).toEqual({ bold: true });
    expect(result?.dataset.grid.usedRange.end.row).toBe(3);
  });
});

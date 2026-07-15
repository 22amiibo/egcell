import type { PracticeNote, ValidationSpec } from "@/domain/challenges/challengeTypes";
import {
  finishVariant,
  pickTargetColumn,
  scaledPoints,
  scaledSeconds,
} from "@/domain/challenges/templates/shared";
import type {
  ChallengeTemplate,
  GeneratedChallenge,
  GenerationContext,
} from "@/domain/challenges/variantTypes";
import type { ColumnRole, GeneratedGrid } from "@/domain/datasets/datasetTypes";
import { generateDataset, shapeFromPreset } from "@/domain/datasets/generateDataset";
import { formatA1 } from "@/domain/grid/formulaEval";
import type { CellAddress, GridActionKind, GridState } from "@/domain/grid/gridTypes";
import { cellKey } from "@/domain/grid/range";

/** Roles every formula table carries, so the table reads like a real sheet. */
const BASE_ROLES: ColumnRole[] = ["category", "name", "amount", "count"];
/** Roles a sum/average target may point at — every number-bearing role. */
const NUMERIC_ROLES: ColumnRole[] = ["amount", "count", "rate"];
/** Roles a copy-value target may point at. Name is excluded: the prompt would read "X's name". */
const NAMED_CELL_ROLES: ColumnRole[] = ["category", "amount", "count", "rate", "status"];

const FORMULA_ACTIONS: GridActionKind[] = ["select-cell", "set-cell-value"];

/**
 * Extends the dataset grid with a labelled target row one row below the table: the label makes
 * the row part of the used range, so the target cell renders and the cursor can reach it.
 * Returns null when the grid has no spare row — the draw is rejected and redrawn.
 */
export function withTargetRow(
  dataset: GeneratedGrid,
  targetCol: number,
  label: string,
): { dataset: GeneratedGrid; target: CellAddress } | null {
  const row = dataset.lastDataRow + 1;
  const grid = dataset.grid;

  if (row >= grid.rowCount) {
    return null;
  }

  const labelCell = { row, col: dataset.firstCol };
  const labelled: GridState = {
    ...grid,
    cells: {
      ...grid.cells,
      [cellKey(labelCell)]: {
        address: labelCell,
        value: { kind: "text", value: label },
        format: { bold: true },
      },
    },
    usedRange: {
      start: grid.usedRange.start,
      end: { row: Math.max(grid.usedRange.end.row, row), col: grid.usedRange.end.col },
    },
  };

  return { dataset: { ...dataset, grid: labelled }, target: { row, col: targetCol } };
}

/** The numbers a range template's column actually holds, read the same way SUM/AVERAGE read them. */
function columnNumbers(dataset: GeneratedGrid, col: number): number[] {
  const numbers: number[] = [];

  for (let row = dataset.firstDataRow; row <= dataset.lastDataRow; row += 1) {
    const value = dataset.grid.cells[cellKey({ row, col })]?.value;

    if (value?.kind === "number") {
      numbers.push(value.value);
    }
  }

  return numbers;
}

function sumOf(numbers: number[]): number {
  return numbers.reduce((total, value) => total + value, 0);
}

/** Draws a dataset with a numeric column to target. Null when none could be placed. */
function drawNumericTarget(context: GenerationContext) {
  const theme = context.rng.fork("theme").pick(context.themes);
  const shape = shapeFromPreset(context.rng.fork("shape"), context.preset, {
    requiredRoles: BASE_ROLES,
  });
  const dataset = generateDataset(context.rng.fork("dataset"), theme, shape);
  const target = pickTargetColumn(context.rng.fork("target"), dataset, NUMERIC_ROLES);

  if (target === null) {
    return null;
  }

  return { dataset, target };
}

function formulaVariant(
  context: GenerationContext,
  input: {
    templateId: string;
    title: string;
    dataset: GeneratedGrid;
    prompt: string;
    validation: ValidationSpec;
    practiceNote: PracticeNote;
    baseSeconds: number;
    basePoints: number;
    dimensions?: Parameters<typeof finishVariant>[0]["dimensions"];
  },
): GeneratedChallenge {
  return finishVariant({
    templateId: input.templateId,
    templateVersion: "v1",
    family: "formula",
    title: input.title,
    context,
    dataset: input.dataset,
    prompt: input.prompt,
    validation: input.validation,
    allowedActions: FORMULA_ACTIONS,
    practiceNote: input.practiceNote,
    targetSeconds: scaledSeconds(input.baseSeconds, context.preset.difficulty),
    basePoints: scaledPoints(input.basePoints, context.preset.difficulty),
    dimensions: input.dimensions,
  });
}

const sumColumn: ChallengeTemplate = {
  id: "gen.formula.sum-column",
  version: "v1",
  family: "formula",
  label: "Total a column with SUM",
  kind: "seeded",
  varies: ["themeId", "rowCount", "colCount", "columnOrder", "targetRole"],
  sprintEligible: true,
  timedEligible: true,
  leaderboardEligible: true,
  generate(context) {
    const drawn = drawNumericTarget(context);

    if (drawn === null) {
      return null;
    }

    const { dataset, target } = drawn;
    const placed = withTargetRow(dataset, target.col, "Total");

    if (placed === null) {
      return null;
    }

    const first = formatA1({ row: dataset.firstDataRow, col: target.col });
    const last = formatA1({ row: dataset.lastDataRow, col: target.col });
    const acceptedFormulas = [`=SUM(${first}:${last})`];
    const expectedValue = sumOf(columnNumbers(dataset, target.col));
    const targetCellA1 = formatA1(placed.target);

    return formulaVariant(context, {
      templateId: "gen.formula.sum-column",
      title: "Total a column with SUM",
      dataset: placed.dataset,
      prompt: `Total the ${target.header} column in ${targetCellA1}.`,
      validation: {
        kind: "formula",
        cell: placed.target,
        acceptedFormulas,
        expectedValue,
      },
      practiceNote: {
        title: "Fast route",
        body: `Click ${targetCellA1}, type ${acceptedFormulas[0]}, and press Enter — SUM adds every ${target.header} figure in the range.`,
      },
      baseSeconds: 10,
      basePoints: 500,
      dimensions: { targetRole: target.role },
    });
  },
};

const averageColumn: ChallengeTemplate = {
  id: "gen.formula.average-column",
  version: "v1",
  family: "formula",
  label: "Average a column with AVERAGE",
  kind: "seeded",
  varies: ["themeId", "rowCount", "colCount", "columnOrder", "targetRole"],
  sprintEligible: true,
  timedEligible: true,
  leaderboardEligible: true,
  generate(context) {
    const drawn = drawNumericTarget(context);

    if (drawn === null) {
      return null;
    }

    const { dataset, target } = drawn;
    const placed = withTargetRow(dataset, target.col, "Average");

    if (placed === null) {
      return null;
    }

    const numbers = columnNumbers(dataset, target.col);

    if (numbers.length === 0) {
      return null;
    }

    const first = formatA1({ row: dataset.firstDataRow, col: target.col });
    const last = formatA1({ row: dataset.lastDataRow, col: target.col });
    const acceptedFormulas = [`=AVERAGE(${first}:${last})`];
    const expectedValue = sumOf(numbers) / numbers.length;
    const targetCellA1 = formatA1(placed.target);

    return formulaVariant(context, {
      templateId: "gen.formula.average-column",
      title: "Average a column with AVERAGE",
      dataset: placed.dataset,
      prompt: `Average the ${target.header} column in ${targetCellA1}.`,
      validation: {
        kind: "formula",
        cell: placed.target,
        acceptedFormulas,
        expectedValue,
      },
      practiceNote: {
        title: "Fast route",
        body: `Click ${targetCellA1}, type ${acceptedFormulas[0]}, and press Enter — AVERAGE divides the ${target.header} total by the row count.`,
      },
      baseSeconds: 10,
      basePoints: 500,
      dimensions: { targetRole: target.role },
    });
  },
};

/** Draws a dataset with both a name column and a named-cell target column. */
function drawNamedCellTarget(context: GenerationContext) {
  const theme = context.rng.fork("theme").pick(context.themes);
  const role = context.rng.fork("target").pick(NAMED_CELL_ROLES);
  const shape = shapeFromPreset(context.rng.fork("shape"), context.preset, {
    requiredRoles: BASE_ROLES.includes(role) ? BASE_ROLES : [...BASE_ROLES, role],
  });
  const dataset = generateDataset(context.rng.fork("dataset"), theme, shape);
  const col = dataset.columnsByRole[role];
  const nameCol = dataset.columnsByRole.name;

  if (col === undefined || nameCol === undefined) {
    return null;
  }

  return { dataset, role, col, nameCol, header: dataset.headersByCol[col] };
}

const copyValue: ChallengeTemplate = {
  id: "gen.formula.copy-value",
  version: "v1",
  family: "formula",
  label: "Copy a value by name",
  kind: "seeded",
  varies: ["themeId", "rowCount", "colCount", "columnOrder", "targetRole", "targetLabel"],
  sprintEligible: true,
  timedEligible: true,
  leaderboardEligible: true,
  generate(context) {
    const drawn = drawNamedCellTarget(context);

    if (drawn === null) {
      return null;
    }

    const { dataset, role, col, nameCol, header } = drawn;
    const row = context.rng.fork("row").int(dataset.firstDataRow, dataset.lastDataRow);
    const nameValue = dataset.grid.cells[cellKey({ row, col: nameCol })]?.value;

    if (nameValue?.kind !== "text") {
      return null;
    }

    const targetKey = cellKey({ row, col });
    const targetValue = dataset.grid.cells[targetKey]?.value;

    if (targetValue?.kind !== "number" && targetValue?.kind !== "text") {
      return null;
    }

    const expected =
      targetValue.kind === "number"
        ? ({ kind: "number", value: targetValue.value } as const)
        : ({ kind: "text", value: targetValue.value } as const);

    // The player must type the value in, so the cell the prompt names starts blank — exactly the
    // way generateDataset punches a blank: the cell key is simply absent.
    const cells = { ...dataset.grid.cells };

    delete cells[targetKey];

    const blanked: GridState = { ...dataset.grid, cells };
    const blankedDataset: GeneratedGrid = { ...dataset, grid: blanked };
    const cell = { row, col };
    const targetCellA1 = formatA1(cell);

    return formulaVariant(context, {
      templateId: "gen.formula.copy-value",
      title: "Copy a value by name",
      dataset: blankedDataset,
      prompt: `Type ${nameValue.value}'s ${header} into ${targetCellA1}.`,
      validation: { kind: "cell-value", cell, expected },
      practiceNote: {
        title: "Fast route",
        body: `Find ${nameValue.value} in the table, read the ${header} value, then type it into ${targetCellA1}.`,
      },
      baseSeconds: 8,
      basePoints: 400,
      dimensions: { targetRole: role, targetRowKind: "byName", targetLabel: nameValue.value },
    });
  },
};

export const formulaTemplates: ChallengeTemplate[] = [sumColumn, averageColumn, copyValue];

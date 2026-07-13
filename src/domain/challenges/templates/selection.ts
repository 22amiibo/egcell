import type { PracticeNote, ValidationSpec } from "@/domain/challenges/challengeTypes";
import {
  SELECTION_ACTIONS,
  finishVariant,
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
import { cellKey } from "@/domain/grid/range";

const BASE_ROLES: ColumnRole[] = ["category", "name", "amount", "count"];
const TARGET_ROLES: ColumnRole[] = ["name", "amount", "count", "status", "date", "rate", "category"];

function drawWithTarget(context: GenerationContext) {
  const theme = context.rng.fork("theme").pick(context.themes);
  const role = context.rng.fork("target").pick(TARGET_ROLES);
  const shape = shapeFromPreset(context.rng.fork("shape"), context.preset, {
    requiredRoles: BASE_ROLES.includes(role) ? BASE_ROLES : [...BASE_ROLES, role],
  });
  const dataset = generateDataset(context.rng.fork("dataset"), theme, shape);
  const col = dataset.columnsByRole[role];

  if (col === undefined) {
    return null;
  }

  return { dataset, role, col, header: dataset.headersByCol[col] };
}

function drawPlain(context: GenerationContext): GeneratedGrid {
  const theme = context.rng.fork("theme").pick(context.themes);
  const shape = shapeFromPreset(context.rng.fork("shape"), context.preset, {
    requiredRoles: BASE_ROLES,
  });

  return generateDataset(context.rng.fork("dataset"), theme, shape);
}

function selectionVariant(
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
    family: "selection",
    title: input.title,
    context,
    dataset: input.dataset,
    prompt: input.prompt,
    validation: input.validation,
    allowedActions: SELECTION_ACTIONS,
    practiceNote: input.practiceNote,
    targetSeconds: scaledSeconds(input.baseSeconds, context.preset.difficulty),
    basePoints: scaledPoints(input.basePoints, context.preset.difficulty),
    dimensions: input.dimensions,
  });
}

const wholeColumn: ChallengeTemplate = {
  id: "gen.selection.column",
  version: "v1",
  family: "selection",
  label: "Select a column",
  kind: "seeded",
  varies: ["themeId", "rowCount", "colCount", "columnOrder", "targetRole"],
  sprintEligible: true,
  timedEligible: true,
  leaderboardEligible: true,
  generate(context) {
    const drawn = drawWithTarget(context);

    if (drawn === null) {
      return null;
    }

    const { dataset, role, col, header } = drawn;

    return selectionVariant(context, {
      templateId: "gen.selection.column",
      title: "Select a column",
      dataset,
      prompt: `Select the ${header} column.`,
      validation: {
        kind: "selection",
        requiredRange: {
          start: { row: dataset.headerRow, col },
          end: { row: dataset.lastDataRow, col },
        },
        requireEntireColumnWithinUsedRange: true,
      },
      practiceNote: {
        title: "Fast route",
        body: `Click the ${header} column's letter header, or press Ctrl+Space from any ${header} cell.`,
      },
      baseSeconds: 7,
      basePoints: 1000,
      dimensions: { targetRole: role, headerIncluded: true },
    });
  },
};

const columnValues: ChallengeTemplate = {
  id: "gen.selection.column-values",
  version: "v1",
  family: "selection",
  label: "Select a column's values",
  kind: "seeded",
  varies: ["themeId", "rowCount", "colCount", "columnOrder", "targetRole"],
  sprintEligible: true,
  timedEligible: true,
  leaderboardEligible: true,
  generate(context) {
    const drawn = drawWithTarget(context);

    if (drawn === null) {
      return null;
    }

    const { dataset, role, col, header } = drawn;

    return selectionVariant(context, {
      templateId: "gen.selection.column-values",
      title: "Select a column's values",
      dataset,
      prompt: `Select the ${header} values, without the header.`,
      validation: {
        kind: "selection",
        requiredRange: {
          start: { row: dataset.firstDataRow, col },
          end: { row: dataset.lastDataRow, col },
        },
      },
      practiceNote: {
        title: "Fast route",
        body: `Click the first ${header} value, then Ctrl+Shift+Down takes the rest without the header.`,
      },
      baseSeconds: 8,
      basePoints: 1100,
      dimensions: { targetRole: role, headerIncluded: false },
    });
  },
};

const headerRow: ChallengeTemplate = {
  id: "gen.selection.header-row",
  version: "v1",
  family: "selection",
  label: "Select the headers",
  kind: "seeded",
  varies: ["themeId", "rowCount", "colCount", "columnOrder"],
  sprintEligible: true,
  timedEligible: true,
  leaderboardEligible: true,
  generate(context) {
    const dataset = drawPlain(context);

    return selectionVariant(context, {
      templateId: "gen.selection.header-row",
      title: "Select the headers",
      dataset,
      prompt: "Select the header row.",
      validation: {
        kind: "selection",
        requiredRange: {
          start: { row: dataset.headerRow, col: dataset.firstCol },
          end: { row: dataset.headerRow, col: dataset.lastCol },
        },
      },
      practiceNote: {
        title: "Fast route",
        body: "Click the header row's number, or press Shift+Space from any header cell.",
      },
      baseSeconds: 6,
      basePoints: 900,
      dimensions: { headerIncluded: true },
    });
  },
};

const rowByName: ChallengeTemplate = {
  id: "gen.selection.row-by-name",
  version: "v1",
  family: "selection",
  label: "Select a row by name",
  kind: "seeded",
  varies: ["themeId", "rowCount", "colCount", "columnOrder", "targetLabel"],
  sprintEligible: true,
  timedEligible: true,
  leaderboardEligible: true,
  generate(context) {
    const dataset = drawPlain(context);
    const nameCol = dataset.columnsByRole.name;

    if (nameCol === undefined) {
      return null;
    }

    const row = context.rng.fork("row").int(dataset.firstDataRow, dataset.lastDataRow);
    const nameValue = dataset.grid.cells[cellKey({ row, col: nameCol })]?.value;

    if (nameValue?.kind !== "text") {
      return null;
    }

    return selectionVariant(context, {
      templateId: "gen.selection.row-by-name",
      title: "Select a row by name",
      dataset,
      prompt: `Select ${nameValue.value}'s row.`,
      validation: {
        kind: "selection",
        requiredRange: {
          start: { row, col: dataset.firstCol },
          end: { row, col: dataset.lastCol },
        },
      },
      practiceNote: {
        title: "Fast route",
        body: `Find ${nameValue.value}, then Shift+Space takes the whole row from any of its cells.`,
      },
      baseSeconds: 7,
      basePoints: 1000,
      dimensions: { targetRowKind: "byName", targetLabel: nameValue.value },
    });
  },
};

const wholeTable: ChallengeTemplate = {
  id: "gen.selection.table",
  version: "v1",
  family: "selection",
  label: "Select the full table",
  kind: "seeded",
  varies: ["themeId", "rowCount", "colCount", "columnOrder"],
  sprintEligible: true,
  timedEligible: true,
  leaderboardEligible: true,
  generate(context) {
    const dataset = drawPlain(context);

    return selectionVariant(context, {
      templateId: "gen.selection.table",
      title: "Select the full table",
      dataset,
      prompt: "Select the whole table, header included.",
      validation: {
        kind: "selection",
        requiredRange: {
          start: { row: dataset.headerRow, col: dataset.firstCol },
          end: { row: dataset.lastDataRow, col: dataset.lastCol },
        },
      },
      practiceNote: {
        title: "Fast route",
        body: "Ctrl+A or Cmd+A from inside the table takes all of it, header included, in one keystroke.",
      },
      baseSeconds: 7,
      basePoints: 1200,
      dimensions: { headerIncluded: true },
    });
  },
};

const twoColumns: ChallengeTemplate = {
  id: "gen.selection.two-columns",
  version: "v1",
  family: "selection",
  label: "Select two columns of figures",
  kind: "seeded",
  varies: ["themeId", "rowCount", "colCount", "columnOrder"],
  sprintEligible: true,
  timedEligible: true,
  leaderboardEligible: true,
  generate(context) {
    const dataset = drawPlain(context);
    const { grid } = dataset;

    // Adjacent pairs where both columns hold numbers, so the prompt "figures" reads true.
    const pairs: Array<[number, number]> = [];

    for (let col = dataset.firstCol; col < dataset.lastCol; col += 1) {
      const left = grid.cells[cellKey({ row: dataset.firstDataRow, col })]?.value;
      const right = grid.cells[cellKey({ row: dataset.firstDataRow, col: col + 1 })]?.value;

      if (left?.kind === "number" && right?.kind === "number") {
        pairs.push([col, col + 1]);
      }
    }

    if (pairs.length === 0) {
      return null;
    }

    const [colA, colB] = context.rng.fork("pair").pick(pairs);
    const headerA = dataset.headersByCol[colA];
    const headerB = dataset.headersByCol[colB];

    return selectionVariant(context, {
      templateId: "gen.selection.two-columns",
      title: "Select two columns of figures",
      dataset,
      prompt: `Select the ${headerA} and ${headerB} figures, without the headers.`,
      validation: {
        kind: "selection",
        requiredRange: {
          start: { row: dataset.firstDataRow, col: colA },
          end: { row: dataset.lastDataRow, col: colB },
        },
      },
      practiceNote: {
        title: "Fast route",
        body: `Click the first ${headerA} value, then Ctrl+Shift+Down and Shift+Right take both columns without touching the mouse again.`,
      },
      baseSeconds: 9,
      basePoints: 1300,
      dimensions: { headerIncluded: false },
    });
  },
};

export const selectionTemplates: ChallengeTemplate[] = [
  wholeColumn,
  columnValues,
  headerRow,
  rowByName,
  wholeTable,
  twoColumns,
];

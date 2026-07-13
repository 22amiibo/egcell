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
import type { GridActionKind } from "@/domain/grid/gridTypes";

const BASE_ROLES: ColumnRole[] = ["category", "name", "amount", "count"];
const FORMATTING_ACTIONS: GridActionKind[] = [...SELECTION_ACTIONS, "set-format"];

/**
 * Draws a dataset whose target column starts WITHOUT the format the challenge asks for. The
 * eligibility gate rejects any draw where a target cell already satisfies the requirement, so a
 * formatting drill can never start complete.
 */
function drawUnformatted(context: GenerationContext, role: ColumnRole, boldHeaders = true) {
  const theme = context.rng.fork("theme").pick(context.themes);
  const shape = shapeFromPreset(context.rng.fork("shape"), context.preset, {
    requiredRoles: BASE_ROLES.includes(role) ? BASE_ROLES : [...BASE_ROLES, role],
    unformattedRoles: [role],
    boldHeaders,
  });
  const dataset = generateDataset(context.rng.fork("dataset"), theme, shape);
  const col = dataset.columnsByRole[role];

  if (col === undefined) {
    return null;
  }

  return { dataset, col, header: dataset.headersByCol[col] };
}

function formattingVariant(
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
    family: "formatting",
    title: input.title,
    context,
    dataset: input.dataset,
    prompt: input.prompt,
    validation: input.validation,
    allowedActions: FORMATTING_ACTIONS,
    practiceNote: input.practiceNote,
    targetSeconds: scaledSeconds(input.baseSeconds, context.preset.difficulty),
    basePoints: scaledPoints(input.basePoints, context.preset.difficulty),
    dimensions: input.dimensions,
  });
}

/** Column-of-figures format drills share everything but the format and the phrasing. */
function numberFormatTemplate(input: {
  templateId: string;
  label: string;
  role: ColumnRole;
  numberFormat: "currency" | "percent" | "date";
  phrase: (header: string) => string;
  practice: (header: string) => string;
}): ChallengeTemplate {
  return {
    id: input.templateId,
    version: "v1",
    family: "formatting",
    label: input.label,
    kind: "seeded",
    varies: ["themeId", "rowCount", "colCount", "columnOrder", "formatKind"],
    sprintEligible: true,
    timedEligible: true,
    leaderboardEligible: true,
    generate(context) {
      const drawn = drawUnformatted(context, input.role);

      if (drawn === null) {
        return null;
      }

      const { dataset, col, header } = drawn;

      return formattingVariant(context, {
        templateId: input.templateId,
        title: input.label,
        dataset,
        prompt: input.phrase(header),
        validation: {
          kind: "formatting",
          // The header is text; only the figures below it are graded.
          range: {
            start: { row: dataset.firstDataRow, col },
            end: { row: dataset.lastDataRow, col },
          },
          requiredFormat: { numberFormat: input.numberFormat },
        },
        practiceNote: { title: "Fast route", body: input.practice(header) },
        baseSeconds: 8,
        basePoints: 1200,
        dimensions: { targetRole: input.role, formatKind: input.numberFormat },
      });
    },
  };
}

const currency = numberFormatTemplate({
  templateId: "gen.formatting.currency",
  label: "Format a column as currency",
  role: "amount",
  numberFormat: "currency",
  phrase: (header) => `Format the ${header} figures as currency.`,
  practice: (header) =>
    `Ctrl+Space from any ${header} cell, then Ctrl+Shift+4. Formatting the header too costs nothing: only the figures are graded.`,
});

const percent = numberFormatTemplate({
  templateId: "gen.formatting.percent",
  label: "Format a column as percent",
  role: "rate",
  numberFormat: "percent",
  phrase: (header) => `Format the ${header} figures as percent.`,
  practice: (header) => `Select the ${header} figures and press Ctrl+Shift+5.`,
});

const dateFormat = numberFormatTemplate({
  templateId: "gen.formatting.date",
  label: "Apply the date format",
  role: "date",
  numberFormat: "date",
  phrase: (header) => `Apply the date format to the ${header} figures.`,
  practice: (header) => `Select the ${header} figures and use the Date button in the toolbar.`,
});

const boldHeader: ChallengeTemplate = {
  id: "gen.formatting.bold-header",
  version: "v1",
  family: "formatting",
  label: "Bold the headers",
  kind: "seeded",
  varies: ["themeId", "rowCount", "colCount", "columnOrder"],
  sprintEligible: true,
  timedEligible: true,
  leaderboardEligible: true,
  generate(context) {
    const theme = context.rng.fork("theme").pick(context.themes);
    const shape = shapeFromPreset(context.rng.fork("shape"), context.preset, {
      requiredRoles: BASE_ROLES,
      // The header has to start unbolded, or the challenge is already complete.
      boldHeaders: false,
    });
    const dataset = generateDataset(context.rng.fork("dataset"), theme, shape);

    return formattingVariant(context, {
      templateId: "gen.formatting.bold-header",
      title: "Bold the headers",
      dataset,
      prompt: "Make the header row bold.",
      validation: {
        kind: "formatting",
        range: {
          start: { row: dataset.headerRow, col: dataset.firstCol },
          end: { row: dataset.headerRow, col: dataset.lastCol },
        },
        requiredFormat: { bold: true },
      },
      practiceNote: {
        title: "Fast route",
        body: "Shift+Space from any header cell takes the row, then Ctrl+B bolds it. Two keystrokes.",
      },
      baseSeconds: 8,
      basePoints: 1100,
      dimensions: { formatKind: "bold" },
    });
  },
};

const boldColumn: ChallengeTemplate = {
  id: "gen.formatting.bold-column",
  version: "v1",
  family: "formatting",
  label: "Bold a column's values",
  kind: "seeded",
  varies: ["themeId", "rowCount", "colCount", "columnOrder", "targetRole"],
  sprintEligible: true,
  timedEligible: true,
  leaderboardEligible: true,
  generate(context) {
    const role = context.rng.fork("role").pick(["name", "category"] as ColumnRole[]);
    const theme = context.rng.fork("theme").pick(context.themes);
    const shape = shapeFromPreset(context.rng.fork("shape"), context.preset, {
      requiredRoles: BASE_ROLES,
    });
    const dataset = generateDataset(context.rng.fork("dataset"), theme, shape);
    const col = dataset.columnsByRole[role];

    if (col === undefined) {
      return null;
    }

    const header = dataset.headersByCol[col];

    return formattingVariant(context, {
      templateId: "gen.formatting.bold-column",
      title: "Bold a column's values",
      dataset,
      prompt: `Make the ${header} values bold.`,
      validation: {
        kind: "formatting",
        // The header is graded by other drills; this one wants the values below it.
        range: {
          start: { row: dataset.firstDataRow, col },
          end: { row: dataset.lastDataRow, col },
        },
        requiredFormat: { bold: true },
      },
      practiceNote: {
        title: "Fast route",
        body: `Click the first ${header} value, Ctrl+Shift+Down to take the rest, then Ctrl+B.`,
      },
      baseSeconds: 8,
      basePoints: 1200,
      dimensions: { targetRole: role, formatKind: "bold" },
    });
  },
};

export const formattingTemplates: ChallengeTemplate[] = [
  currency,
  percent,
  dateFormat,
  boldHeader,
  boldColumn,
];

import type { LeafValidationSpec } from "@/domain/challenges/challengeTypes";
import {
  SELECTION_ACTIONS,
  finishVariant,
  scaledPoints,
  scaledSeconds,
} from "@/domain/challenges/templates/shared";
import type { ChallengeTemplate } from "@/domain/challenges/variantTypes";
import type { ColumnRole } from "@/domain/datasets/datasetTypes";
import { generateDataset, shapeFromPreset } from "@/domain/datasets/generateDataset";
import type { GridActionKind, SortDirection } from "@/domain/grid/gridTypes";

const BASE_ROLES: ColumnRole[] = ["category", "name", "amount", "count"];
const MIXED_ACTIONS: GridActionKind[] = [
  ...SELECTION_ACTIONS,
  "set-format",
  "sort-column",
];

/**
 * A deliberately small chain whose steps do not interfere: sorting moves every formatted data
 * cell with its row, and header formatting stays outside the data block. The same final grid is
 * valid whichever order the player chooses.
 */
const sortAndFormat: ChallengeTemplate = {
  id: "gen.mixed.sort-and-format",
  version: "v1",
  family: "mixed",
  label: "Sort and format the table",
  kind: "seeded",
  varies: [
    "themeId",
    "rowCount",
    "colCount",
    "columnOrder",
    "sortDirection",
    "formatKind",
    "chainLength",
  ],
  sprintEligible: true,
  timedEligible: true,
  leaderboardEligible: true,
  generate(context) {
    const minSteps = Math.max(2, context.preset.chainLength[0]);
    const maxSteps = Math.max(minSteps, context.preset.chainLength[1]);
    const chainLength = context.rng.fork("chain-length").int(minSteps, maxSteps);
    const theme = context.rng.fork("theme").pick(context.themes);
    const shape = shapeFromPreset(context.rng.fork("shape"), context.preset, {
      requiredRoles: BASE_ROLES,
      boldHeaders: false,
      unformattedRoles: chainLength === 3 ? ["amount"] : [],
    });
    const dataset = generateDataset(context.rng.fork("dataset"), theme, shape);
    const amountCol = dataset.columnsByRole.amount;

    if (amountCol === undefined) {
      return null;
    }

    const header = dataset.headersByCol[amountCol];
    const direction: SortDirection = context.rng.fork("direction").bool() ? "desc" : "asc";
    const parts: LeafValidationSpec[] = [
      { kind: "sort-filter", requiredSort: { col: amountCol, direction } },
      {
        kind: "formatting",
        range: {
          start: { row: dataset.headerRow, col: dataset.firstCol },
          end: { row: dataset.headerRow, col: dataset.lastCol },
        },
        requiredFormat: { bold: true },
      },
    ];
    const partLabels = [`Sort ${header}`, "Bold the headers"];

    if (chainLength === 3) {
      parts.push({
        kind: "formatting",
        range: {
          start: { row: dataset.firstDataRow, col: amountCol },
          end: { row: dataset.lastDataRow, col: amountCol },
        },
        requiredFormat: { numberFormat: "currency" },
      });
      partLabels.push(`Format ${header} as currency`);
    }

    const sortPhrase = direction === "desc" ? "highest first" : "lowest first";
    const currencyPhrase = chainLength === 3 ? ` Format the ${header} figures as currency.` : "";

    return finishVariant({
      templateId: "gen.mixed.sort-and-format",
      templateVersion: "v1",
      family: "mixed",
      title: "Sort and format the table",
      context,
      dataset,
      prompt: `Sort the table by ${header}, ${sortPhrase}. Make the header row bold.${currencyPhrase}`,
      validation: { kind: "composite", parts, partLabels },
      allowedActions: MIXED_ACTIONS,
      practiceNote: {
        title: "Fast route",
        body: "The steps are independent. Sort from the target column, then use row and range selection for the formatting steps.",
      },
      targetSeconds: scaledSeconds(chainLength === 2 ? 10 : 16, context.preset.difficulty),
      basePoints: scaledPoints(chainLength === 2 ? 1700 : 2300, context.preset.difficulty),
      dimensions: {
        targetRole: "amount",
        sortKey: "amount",
        sortDirection: direction,
        formatKind: chainLength === 3 ? "currency" : "bold",
        chainLength,
      },
    });
  },
};

export const mixedTemplates: ChallengeTemplate[] = [sortAndFormat];

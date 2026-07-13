import {
  NAVIGATION_ACTIONS,
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

/** Roles every navigation table carries, so the table reads like a real sheet. */
const BASE_ROLES: ColumnRole[] = ["category", "name", "amount", "count"];
/** Roles a navigation target may point at. Category is excluded: its values repeat. */
const TARGET_ROLES: ColumnRole[] = ["name", "amount", "count", "status", "date", "rate"];

/**
 * The target role is drawn BEFORE the dataset and forced into the required roles, so the column
 * the prompt talks about always exists. The dataset then decides where it sits.
 */
function drawWithTarget(context: GenerationContext, options: { blankTarget?: boolean } = {}) {
  const theme = context.rng.fork("theme").pick(context.themes);
  const role = context.rng.fork("target").pick(TARGET_ROLES);
  const shape = shapeFromPreset(context.rng.fork("shape"), context.preset, {
    requiredRoles: BASE_ROLES.includes(role) ? BASE_ROLES : [...BASE_ROLES, role],
    blankInRole: options.blankTarget ? role : undefined,
  });
  const dataset = generateDataset(context.rng.fork("dataset"), theme, shape);
  const col = dataset.columnsByRole[role];

  if (col === undefined) {
    return null;
  }

  return { dataset, role, col, header: dataset.headersByCol[col] };
}

function navigationVariant(
  context: GenerationContext,
  input: {
    templateId: string;
    title: string;
    dataset: GeneratedGrid;
    prompt: string;
    target: { row: number; col: number };
    practiceBody: string;
    baseSeconds: number;
    basePoints: number;
    dimensions?: Parameters<typeof finishVariant>[0]["dimensions"];
  },
): GeneratedChallenge {
  return finishVariant({
    templateId: input.templateId,
    templateVersion: "v1",
    family: "navigation",
    title: input.title,
    context,
    dataset: input.dataset,
    prompt: input.prompt,
    validation: { kind: "navigation", requiredCell: { row: input.target.row, col: input.target.col } },
    allowedActions: NAVIGATION_ACTIONS,
    practiceNote: { title: "Fast route", body: input.practiceBody },
    targetSeconds: scaledSeconds(input.baseSeconds, context.preset.difficulty),
    basePoints: scaledPoints(input.basePoints, context.preset.difficulty),
    dimensions: input.dimensions,
  });
}

const lastInColumn: ChallengeTemplate = {
  id: "gen.navigation.last-in-column",
  version: "v1",
  family: "navigation",
  label: "Go to the last filled cell",
  kind: "seeded",
  varies: ["themeId", "rowCount", "colCount", "columnOrder", "targetRole"],
  sprintEligible: true,
  timedEligible: true,
  leaderboardEligible: true,
  generate(context) {
    // A gap in the target column at higher difficulties makes the edge-jump stop early, which is
    // the Excel habit this drill trains: Ctrl+Down again after the gap.
    const wantGap = context.preset.blanks && context.rng.fork("gap").bool(0.5);
    const drawn = drawWithTarget(context, { blankTarget: wantGap });

    if (drawn === null) {
      return null;
    }

    const { dataset, role, col, header } = drawn;

    return navigationVariant(context, {
      templateId: "gen.navigation.last-in-column",
      title: "Go to the last filled cell",
      dataset,
      prompt: `Go to the last filled cell in the ${header} column.`,
      target: { row: dataset.lastDataRow, col },
      practiceBody: `Click any ${header} cell, then Ctrl+Down or Cmd+Down jumps to the last filled cell. Jump again if a gap stops you early.`,
      baseSeconds: 5,
      basePoints: 800,
      dimensions: { targetRole: role, targetRowKind: "last" },
    });
  },
};

const firstInColumn: ChallengeTemplate = {
  id: "gen.navigation.first-in-column",
  version: "v1",
  family: "navigation",
  label: "Go to the first entry",
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

    return navigationVariant(context, {
      templateId: "gen.navigation.first-in-column",
      title: "Go to the first entry",
      dataset,
      prompt: `Go to the first entry in the ${header} column.`,
      target: { row: dataset.firstDataRow, col },
      practiceBody: `The first entry sits just under the ${header} header. Click it, or ride Ctrl+Up from below.`,
      baseSeconds: 4,
      basePoints: 700,
      dimensions: { targetRole: role, targetRowKind: "first" },
    });
  },
};

const bottomRightCorner: ChallengeTemplate = {
  id: "gen.navigation.corner",
  version: "v1",
  family: "navigation",
  label: "Go to the table's last cell",
  kind: "seeded",
  varies: ["themeId", "rowCount", "colCount", "columnOrder"],
  sprintEligible: true,
  timedEligible: true,
  leaderboardEligible: true,
  generate(context) {
    const theme = context.rng.fork("theme").pick(context.themes);
    const shape = shapeFromPreset(context.rng.fork("shape"), context.preset, {
      requiredRoles: BASE_ROLES,
    });
    const dataset = generateDataset(context.rng.fork("dataset"), theme, shape);

    return navigationVariant(context, {
      templateId: "gen.navigation.corner",
      title: "Go to the table's last cell",
      dataset,
      prompt: "Go to the bottom-right cell of the table.",
      target: { row: dataset.lastDataRow, col: dataset.lastCol },
      practiceBody:
        "From inside the table, Ctrl+Down then Ctrl+Right lands on the bottom-right corner in two keystrokes.",
      baseSeconds: 5,
      basePoints: 800,
      dimensions: { targetRowKind: "corner" },
    });
  },
};

const findByName: ChallengeTemplate = {
  id: "gen.navigation.find-name",
  version: "v1",
  family: "navigation",
  label: "Find a value by name",
  kind: "seeded",
  varies: ["themeId", "rowCount", "colCount", "columnOrder", "targetRole", "targetLabel"],
  sprintEligible: true,
  timedEligible: true,
  leaderboardEligible: true,
  generate(context) {
    const drawn = drawWithTarget(context);

    if (drawn === null || drawn.role === "name") {
      // The target column must not be the name column itself, or the prompt reads "X's name".
      return null;
    }

    const { dataset, role, col, header } = drawn;
    const nameCol = dataset.columnsByRole.name;

    if (nameCol === undefined) {
      return null;
    }

    const row = context.rng.fork("row").int(dataset.firstDataRow, dataset.lastDataRow);
    const nameValue = dataset.grid.cells[cellKey({ row, col: nameCol })]?.value;

    if (nameValue?.kind !== "text") {
      return null;
    }

    return navigationVariant(context, {
      templateId: "gen.navigation.find-name",
      title: "Find a value by name",
      dataset,
      prompt: `Go to ${nameValue.value}'s ${header} cell.`,
      target: { row, col },
      practiceBody: `Scan ${dataset.headersByCol[nameCol]} for ${nameValue.value}, then land on that row's ${header} cell. Reading the table fast is the skill.`,
      baseSeconds: 6,
      basePoints: 900,
      dimensions: { targetRole: role, targetRowKind: "byName", targetLabel: nameValue.value },
    });
  },
};

const firstBlank: ChallengeTemplate = {
  id: "gen.navigation.first-blank",
  version: "v1",
  family: "navigation",
  label: "Find the blank cell",
  kind: "seeded",
  varies: ["themeId", "rowCount", "colCount", "columnOrder", "targetRole"],
  sprintEligible: true,
  timedEligible: true,
  leaderboardEligible: true,
  generate(context) {
    const theme = context.rng.fork("theme").pick(context.themes);
    const role = context.rng.fork("target").pick(["amount", "count", "status", "date"] as ColumnRole[]);
    const shape = shapeFromPreset(context.rng.fork("shape"), context.preset, {
      requiredRoles: BASE_ROLES.includes(role) ? BASE_ROLES : [...BASE_ROLES, role],
      blankInRole: role,
    });
    const dataset = generateDataset(context.rng.fork("dataset"), theme, shape);
    const col = dataset.columnsByRole[role];

    if (col === undefined) {
      return null;
    }

    const blanks = dataset.blanksByCol[col] ?? [];

    if (blanks.length !== 1) {
      return null;
    }

    const header = dataset.headersByCol[col];

    return navigationVariant(context, {
      templateId: "gen.navigation.first-blank",
      title: "Find the blank cell",
      dataset,
      prompt: `Go to the blank cell in the ${header} column.`,
      target: { row: blanks[0], col },
      practiceBody: `Ctrl+Down from the ${header} header stops on the last cell before the gap; one more ArrowDown lands on the blank.`,
      baseSeconds: 6,
      basePoints: 900,
      dimensions: { targetRole: role, targetRowKind: "blank" },
    });
  },
};

export const navigationTemplates: ChallengeTemplate[] = [
  lastInColumn,
  firstInColumn,
  bottomRightCorner,
  findByName,
  firstBlank,
];

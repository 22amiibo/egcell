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
import type { GridActionKind, SortDirection } from "@/domain/grid/gridTypes";
import { cellKey } from "@/domain/grid/range";

const BASE_ROLES: ColumnRole[] = ["category", "name", "amount", "count"];
const SORT_ACTIONS: GridActionKind[] = [...SELECTION_ACTIONS, "sort-column"];
const FILTER_ACTIONS: GridActionKind[] = [...SELECTION_ACTIONS, "filter-column", "clear-filters"];

function drawWithRole(context: GenerationContext, candidates: ColumnRole[]) {
  const theme = context.rng.fork("theme").pick(context.themes);
  const role = context.rng.fork("target").pick(candidates);
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

function sortFilterVariant(
  context: GenerationContext,
  input: {
    templateId: string;
    title: string;
    dataset: GeneratedGrid;
    prompt: string;
    validation: ValidationSpec;
    allowedActions: GridActionKind[];
    practiceNote: PracticeNote;
    baseSeconds: number;
    basePoints: number;
    dimensions?: Parameters<typeof finishVariant>[0]["dimensions"];
  },
): GeneratedChallenge {
  return finishVariant({
    templateId: input.templateId,
    templateVersion: "v1",
    family: "sort-filter",
    title: input.title,
    context,
    dataset: input.dataset,
    prompt: input.prompt,
    validation: input.validation,
    allowedActions: input.allowedActions,
    practiceNote: input.practiceNote,
    targetSeconds: scaledSeconds(input.baseSeconds, context.preset.difficulty),
    basePoints: scaledPoints(input.basePoints, context.preset.difficulty),
    dimensions: input.dimensions,
  });
}

const sortNumeric: ChallengeTemplate = {
  id: "gen.sort-filter.sort-numeric",
  version: "v1",
  family: "sort-filter",
  label: "Sort by a numeric column",
  kind: "seeded",
  varies: ["themeId", "rowCount", "colCount", "columnOrder", "sortKey", "sortDirection"],
  sprintEligible: true,
  timedEligible: true,
  leaderboardEligible: true,
  generate(context) {
    const drawn = drawWithRole(context, ["amount", "count", "rate"]);

    if (drawn === null) {
      return null;
    }

    const { dataset, role, col, header } = drawn;
    const direction: SortDirection = context.rng.fork("direction").bool() ? "desc" : "asc";

    return sortFilterVariant(context, {
      templateId: "gen.sort-filter.sort-numeric",
      title: "Sort by a numeric column",
      dataset,
      prompt:
        direction === "desc"
          ? `Sort the table by ${header}, highest first.`
          : `Sort the table by ${header}, lowest first.`,
      validation: { kind: "sort-filter", requiredSort: { col, direction } },
      allowedActions: SORT_ACTIONS,
      practiceNote: {
        title: "Fast route",
        body: `Put the cursor anywhere in ${header} and sort. The whole row travels with the value.`,
      },
      baseSeconds: 9,
      basePoints: 1300,
      dimensions: { targetRole: role, sortKey: role, sortDirection: direction },
    });
  },
};

const sortText: ChallengeTemplate = {
  id: "gen.sort-filter.sort-text",
  version: "v1",
  family: "sort-filter",
  label: "Sort names alphabetically",
  kind: "seeded",
  varies: ["themeId", "rowCount", "colCount", "columnOrder", "sortDirection"],
  sprintEligible: true,
  timedEligible: true,
  leaderboardEligible: true,
  generate(context) {
    const drawn = drawWithRole(context, ["name"]);

    if (drawn === null) {
      return null;
    }

    const { dataset, role, col, header } = drawn;
    // A to Z most of the time, the way real sheets are sorted; Z to A keeps players honest.
    const direction: SortDirection = context.rng.fork("direction").bool(0.75) ? "asc" : "desc";

    return sortFilterVariant(context, {
      templateId: "gen.sort-filter.sort-text",
      title: "Sort names alphabetically",
      dataset,
      prompt:
        direction === "asc"
          ? `Sort the table by ${header}, A to Z.`
          : `Sort the table by ${header}, Z to A.`,
      validation: { kind: "sort-filter", requiredSort: { col, direction } },
      allowedActions: SORT_ACTIONS,
      practiceNote: {
        title: "Fast route",
        body: `Any ${header} cell, then sort. Text sorts alphabetically, numbers numerically.`,
      },
      baseSeconds: 9,
      basePoints: 1300,
      dimensions: { targetRole: role, sortKey: role, sortDirection: direction },
    });
  },
};

const filterEquals: ChallengeTemplate = {
  id: "gen.sort-filter.filter-equals",
  version: "v1",
  family: "sort-filter",
  label: "Filter to one value",
  kind: "seeded",
  varies: ["themeId", "rowCount", "colCount", "columnOrder", "filterRole", "filterValue"],
  sprintEligible: true,
  timedEligible: true,
  leaderboardEligible: true,
  generate(context) {
    const drawn = drawWithRole(context, ["category", "status"]);

    if (drawn === null) {
      return null;
    }

    const { dataset, role, col, header } = drawn;

    // The value is drawn from what the column actually holds, so the filter always matches
    // something; the eligibility gate rejects a draw where it matches everything.
    const present = new Set<string>();

    for (let row = dataset.firstDataRow; row <= dataset.lastDataRow; row += 1) {
      const value = dataset.grid.cells[cellKey({ row, col })]?.value;

      if (value?.kind === "text") {
        present.add(value.value);
      }
    }

    if (present.size < 2) {
      return null;
    }

    const value = context.rng.fork("value").pick([...present].sort());

    return sortFilterVariant(context, {
      templateId: "gen.sort-filter.filter-equals",
      title: "Filter to one value",
      dataset,
      prompt: `Show only the rows where ${header} is ${value}.`,
      validation: {
        kind: "sort-filter",
        requiredVisible: { col, op: "equals", value },
      },
      allowedActions: FILTER_ACTIONS,
      practiceNote: {
        title: "Fast route",
        body: `Select any ${value} cell in ${header}, then Filter keeps only the matching rows.`,
      },
      baseSeconds: 9,
      basePoints: 1300,
      dimensions: { targetRole: role, filterRole: role, filterValue: value },
    });
  },
};

const filterAbove: ChallengeTemplate = {
  id: "gen.sort-filter.filter-above",
  version: "v1",
  family: "sort-filter",
  label: "Filter above a value",
  kind: "seeded",
  varies: ["themeId", "rowCount", "colCount", "columnOrder", "filterRole", "filterValue"],
  sprintEligible: true,
  timedEligible: true,
  leaderboardEligible: true,
  generate(context) {
    const drawn = drawWithRole(context, ["amount", "count"]);

    if (drawn === null) {
      return null;
    }

    const { dataset, role, col, header } = drawn;
    const nameCol = dataset.columnsByRole.name;

    if (nameCol === undefined) {
      return null;
    }

    // The threshold is anchored to a row the player can find, the way "more Units than Bruno"
    // was: the toolbar filters relative to the selected cell, so the threshold must BE a cell.
    const rows: Array<{ row: number; value: number; name: string }> = [];

    for (let row = dataset.firstDataRow; row <= dataset.lastDataRow; row += 1) {
      const value = dataset.grid.cells[cellKey({ row, col })]?.value;
      const name = dataset.grid.cells[cellKey({ row, col: nameCol })]?.value;

      if (value?.kind === "number" && name?.kind === "text") {
        rows.push({ row, value: value.value, name: name.value });
      }
    }

    const max = Math.max(...rows.map((entry) => entry.value));
    const anchors = rows.filter((entry) => entry.value < max);

    if (anchors.length === 0) {
      return null;
    }

    const anchor = context.rng.fork("anchor").pick(anchors);

    return sortFilterVariant(context, {
      templateId: "gen.sort-filter.filter-above",
      title: "Filter above a value",
      dataset,
      prompt: `Show only the rows with more ${header} than ${anchor.name}.`,
      validation: {
        kind: "sort-filter",
        requiredVisible: { col, op: "greater-than", value: anchor.value },
      },
      allowedActions: FILTER_ACTIONS,
      practiceNote: {
        title: "Fast route",
        body: `Click ${anchor.name}'s ${header} cell, then Filter > keeps only the rows above it.`,
      },
      baseSeconds: 10,
      basePoints: 1400,
      dimensions: { targetRole: role, filterRole: role, filterValue: anchor.value },
    });
  },
};

export const sortFilterTemplates: ChallengeTemplate[] = [
  sortNumeric,
  sortText,
  filterEquals,
  filterAbove,
];

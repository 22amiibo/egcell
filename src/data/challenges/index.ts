import { generatedTemplates } from "@/data/challenges/generated";
import type { Challenge } from "@/domain/challenges/challengeTypes";
import {
  createTemplateRegistry,
  fixedTemplate,
  materializeTemplate,
  type TemplateRegistry,
} from "@/domain/challenges/templateRegistry";
import type { ChallengeTemplate, ChallengeVariant } from "@/domain/challenges/variantTypes";
import {
  EAST_ROW_COUNT,
  FIRST_DATA_ROW,
  HEADER_ROW,
  LAST_DATA_ROW,
  LAST_USED_COL,
  REGION_COL,
  REP_COL,
  REVENUE_COL,
  STATUS_COL,
  UNITS_COL,
  createRevenueGrid,
} from "@/data/grids/revenueGrid";

const SELECTION_ACTIONS = ["select-cell", "select-range", "select-row", "select-column"] as const;

/** Dara sits in the fourth data row of the fixed dataset. */
const DARA_ROW = FIRST_DATA_ROW + 3;
/** Bruno's Units figure, used as a filter threshold. Tied to the fixed dataset. */
const BRUNO_UNITS = 201;

export const selectionRevenueColumnChallenge: Challenge = {
  id: "selection.revenue-column",
  version: "v1",
  slug: "select-revenue-column",
  title: "Select the Revenue column",
  prompt: "Select the Revenue column.",
  family: "selection",
  difficulty: 1,
  seed: "revenue-column-v1",
  timingPolicy: { kind: "single-challenge", targetSeconds: 8 },
  initialGrid: createRevenueGrid(),
  allowedActions: [...SELECTION_ACTIONS],
  validation: {
    kind: "selection",
    requiredRange: {
      start: { row: HEADER_ROW, col: REVENUE_COL },
      end: { row: LAST_DATA_ROW, col: REVENUE_COL },
    },
    requireEntireColumnWithinUsedRange: true,
  },
  scoring: { basePoints: 1000, targetSeconds: 8, minimumCorrectnessForPr: 1 },
  practiceNotes: [
    {
      title: "Fast route",
      body: "Click the Revenue column header, or put the active cell anywhere in Revenue and press Ctrl+Space.",
    },
  ],
};

export const navigationLastRevenueCellChallenge: Challenge = {
  id: "navigation.last-revenue-cell",
  version: "v1",
  slug: "go-to-last-revenue-cell",
  title: "Go to the last Revenue cell",
  prompt: "Go to the last cell of the Revenue column.",
  family: "navigation",
  difficulty: 1,
  seed: "last-revenue-cell-v1",
  timingPolicy: { kind: "single-challenge", targetSeconds: 6 },
  initialGrid: createRevenueGrid(),
  allowedActions: ["select-cell"],
  validation: {
    kind: "navigation",
    requiredCell: { row: LAST_DATA_ROW, col: REVENUE_COL },
  },
  scoring: { basePoints: 800, targetSeconds: 6, minimumCorrectnessForPr: 1 },
  practiceNotes: [
    {
      title: "Fast route",
      body: "Click any Revenue cell, then Ctrl+Down or Cmd+Down jumps to the last filled cell, here and in Excel.",
    },
  ],
};

export const selectionHeaderRowChallenge: Challenge = {
  id: "selection.header-row",
  version: "v1",
  slug: "select-header-row",
  title: "Select the header row",
  prompt: "Select the header row.",
  family: "selection",
  difficulty: 1,
  seed: "header-row-v1",
  timingPolicy: { kind: "single-challenge", targetSeconds: 7 },
  initialGrid: createRevenueGrid(),
  allowedActions: [...SELECTION_ACTIONS],
  validation: {
    kind: "selection",
    requiredRange: {
      start: { row: HEADER_ROW, col: 0 },
      end: { row: HEADER_ROW, col: LAST_USED_COL },
    },
  },
  scoring: { basePoints: 800, targetSeconds: 7, minimumCorrectnessForPr: 1 },
  practiceNotes: [
    {
      title: "Fast route",
      body: "Click the row header to the left of row 1, or press Shift+Space with the active cell anywhere in row 1.",
    },
  ],
};

export const selectionWholeTableChallenge: Challenge = {
  id: "selection.whole-table",
  version: "v1",
  slug: "select-whole-table",
  title: "Select the whole table",
  prompt: "Select the whole table, header included.",
  family: "selection",
  difficulty: 2,
  seed: "whole-table-v1",
  timingPolicy: { kind: "single-challenge", targetSeconds: 10 },
  initialGrid: createRevenueGrid(),
  allowedActions: [...SELECTION_ACTIONS],
  validation: {
    kind: "selection",
    requiredRange: {
      start: { row: HEADER_ROW, col: 0 },
      end: { row: LAST_DATA_ROW, col: LAST_USED_COL },
    },
  },
  scoring: { basePoints: 1200, targetSeconds: 10, minimumCorrectnessForPr: 1 },
  practiceNotes: [
    {
      title: "Fast route",
      body: "Ctrl+A or Cmd+A selects the whole table in one keystroke, here and in Excel. Dragging from A1 to the last cell works too.",
    },
  ],
};

export const formattingBoldHeaderChallenge: Challenge = {
  id: "formatting.bold-header",
  version: "v1",
  slug: "bold-the-header-row",
  title: "Bold the header row",
  prompt: "Make the header row bold.",
  family: "formatting",
  difficulty: 2,
  seed: "bold-header-v1",
  // The header has to start unbolded, or the challenge is already complete.
  initialGrid: createRevenueGrid({ boldHeaders: false }),
  timingPolicy: { kind: "single-challenge", targetSeconds: 10 },
  allowedActions: [...SELECTION_ACTIONS, "set-format"],
  validation: {
    kind: "formatting",
    range: {
      start: { row: HEADER_ROW, col: 0 },
      end: { row: HEADER_ROW, col: LAST_USED_COL },
    },
    requiredFormat: { bold: true },
  },
  scoring: { basePoints: 1200, targetSeconds: 10, minimumCorrectnessForPr: 1 },
  practiceNotes: [
    {
      title: "Fast route",
      body: "Shift+Space selects the header row, then Ctrl+B or Cmd+B bolds it. Two keystrokes, here and in Excel.",
    },
  ],
};

export const formattingCurrencyRevenueChallenge: Challenge = {
  id: "formatting.currency-revenue",
  version: "v1",
  slug: "format-revenue-as-currency",
  title: "Format Revenue as currency",
  prompt: "Format the Revenue figures as currency.",
  family: "formatting",
  difficulty: 2,
  seed: "currency-revenue-v1",
  // Revenue starts as a plain number here, unlike every other challenge on this grid.
  initialGrid: createRevenueGrid({ revenueFormat: "general" }),
  timingPolicy: { kind: "single-challenge", targetSeconds: 12 },
  allowedActions: [...SELECTION_ACTIONS, "set-format"],
  validation: {
    kind: "formatting",
    // The Revenue header is text, so only the figures below it are graded.
    range: {
      start: { row: FIRST_DATA_ROW, col: REVENUE_COL },
      end: { row: LAST_DATA_ROW, col: REVENUE_COL },
    },
    requiredFormat: { numberFormat: "currency" },
  },
  scoring: { basePoints: 1200, targetSeconds: 12, minimumCorrectnessForPr: 1 },
  practiceNotes: [
    {
      title: "Fast route",
      body: "Select the column and press Ctrl+Shift+4 for currency. Formatting the header along with it costs nothing: only the figures are graded.",
    },
  ],
};

export const sortRevenueHighToLowChallenge: Challenge = {
  id: "sort-filter.revenue-high-to-low",
  version: "v1",
  slug: "sort-revenue-high-to-low",
  title: "Sort Revenue high to low",
  prompt: "Sort the table by Revenue, highest first.",
  family: "sort-filter",
  difficulty: 3,
  seed: "sort-revenue-desc-v1",
  initialGrid: createRevenueGrid(),
  timingPolicy: { kind: "single-challenge", targetSeconds: 12 },
  allowedActions: [...SELECTION_ACTIONS, "sort-column"],
  validation: {
    kind: "sort-filter",
    requiredSort: { col: REVENUE_COL, direction: "desc" },
  },
  scoring: { basePoints: 1400, targetSeconds: 12, minimumCorrectnessForPr: 1 },
  practiceNotes: [
    {
      title: "Fast route",
      body: "Put the cursor anywhere in Revenue and sort descending. The whole row travels with the value, which is what keeps the table honest.",
    },
  ],
};

export const filterEastRegionChallenge: Challenge = {
  id: "sort-filter.east-region",
  version: "v1",
  slug: "filter-region-to-east",
  title: "Show only the East region",
  prompt: "Show only the East region rows.",
  family: "sort-filter",
  difficulty: 3,
  seed: "filter-east-v1",
  initialGrid: createRevenueGrid(),
  timingPolicy: { kind: "single-challenge", targetSeconds: 12 },
  allowedActions: [...SELECTION_ACTIONS, "filter-column", "clear-filters"],
  validation: {
    kind: "sort-filter",
    requiredVisible: { col: REGION_COL, op: "equals", value: "East" },
  },
  scoring: { basePoints: 1400, targetSeconds: 12, minimumCorrectnessForPr: 1 },
  practiceNotes: [
    {
      title: "Fast route",
      body: `Select an East cell, then filter to it. ${EAST_ROW_COUNT} rows should remain.`,
    },
  ],
};

export const navigationFirstRegionCellChallenge: Challenge = {
  id: "navigation.first-region-cell",
  version: "v1",
  slug: "go-to-first-region-cell",
  title: "Go to the first Region cell",
  prompt: "Go to the first Region entry.",
  family: "navigation",
  difficulty: 1,
  seed: "first-region-cell-v1",
  timingPolicy: { kind: "single-challenge", targetSeconds: 4 },
  initialGrid: createRevenueGrid(),
  allowedActions: ["select-cell"],
  validation: {
    kind: "navigation",
    requiredCell: { row: FIRST_DATA_ROW, col: REGION_COL },
  },
  scoring: { basePoints: 600, targetSeconds: 4, minimumCorrectnessForPr: 1 },
  practiceNotes: [
    {
      title: "Fast route",
      body: "It is one cell below A1: click it, or press ArrowDown from the header.",
    },
  ],
};

export const navigationLastStatusCellChallenge: Challenge = {
  id: "navigation.last-status-cell",
  version: "v1",
  slug: "go-to-last-status-cell",
  title: "Go to the last Status cell",
  prompt: "Go to the last cell of the Status column.",
  family: "navigation",
  difficulty: 1,
  seed: "last-status-cell-v1",
  timingPolicy: { kind: "single-challenge", targetSeconds: 5 },
  initialGrid: createRevenueGrid(),
  allowedActions: ["select-cell"],
  validation: {
    kind: "navigation",
    requiredCell: { row: LAST_DATA_ROW, col: STATUS_COL },
  },
  scoring: { basePoints: 700, targetSeconds: 5, minimumCorrectnessForPr: 1 },
  practiceNotes: [
    {
      title: "Fast route",
      body: "Click any Status cell, then Ctrl+Down or Cmd+Down drops to the last one.",
    },
  ],
};

export const navigationDaraUnitsChallenge: Challenge = {
  id: "navigation.dara-units",
  version: "v1",
  slug: "find-dara-units",
  title: "Find Dara's Units",
  prompt: "Go to Dara's Units cell.",
  family: "navigation",
  difficulty: 2,
  seed: "dara-units-v1",
  timingPolicy: { kind: "single-challenge", targetSeconds: 7 },
  initialGrid: createRevenueGrid(),
  allowedActions: ["select-cell"],
  validation: {
    kind: "navigation",
    requiredCell: { row: DARA_ROW, col: UNITS_COL },
  },
  scoring: { basePoints: 900, targetSeconds: 7, minimumCorrectnessForPr: 1 },
  practiceNotes: [
    {
      title: "Fast route",
      body: "Scan the Rep column for Dara, then land on the Units cell in that row. Reading the table quickly is the skill.",
    },
  ],
};

export const selectionUnitsColumnChallenge: Challenge = {
  id: "selection.units-column",
  version: "v1",
  slug: "select-units-column",
  title: "Select the Units column",
  prompt: "Select the Units column.",
  family: "selection",
  difficulty: 1,
  seed: "units-column-v1",
  timingPolicy: { kind: "single-challenge", targetSeconds: 8 },
  initialGrid: createRevenueGrid(),
  allowedActions: [...SELECTION_ACTIONS],
  validation: {
    kind: "selection",
    requiredRange: {
      start: { row: HEADER_ROW, col: UNITS_COL },
      end: { row: LAST_DATA_ROW, col: UNITS_COL },
    },
    requireEntireColumnWithinUsedRange: true,
  },
  scoring: { basePoints: 1000, targetSeconds: 8, minimumCorrectnessForPr: 1 },
  practiceNotes: [
    {
      title: "Fast route",
      body: "Click the D column header, or press Ctrl+Space from any Units cell.",
    },
  ],
};

export const selectionFirstDataRowChallenge: Challenge = {
  id: "selection.first-data-row",
  version: "v1",
  slug: "select-first-data-row",
  title: "Select the first data row",
  prompt: "Select the first data row.",
  family: "selection",
  difficulty: 1,
  seed: "first-data-row-v1",
  timingPolicy: { kind: "single-challenge", targetSeconds: 7 },
  initialGrid: createRevenueGrid(),
  allowedActions: [...SELECTION_ACTIONS],
  validation: {
    kind: "selection",
    requiredRange: {
      start: { row: FIRST_DATA_ROW, col: 0 },
      end: { row: FIRST_DATA_ROW, col: LAST_USED_COL },
    },
  },
  scoring: { basePoints: 800, targetSeconds: 7, minimumCorrectnessForPr: 1 },
  practiceNotes: [
    {
      title: "Fast route",
      body: "Click the row header for row 2, or press Shift+Space from any cell in it.",
    },
  ],
};

export const selectionRevenueUnitsDataChallenge: Challenge = {
  id: "selection.revenue-units-data",
  version: "v1",
  slug: "select-revenue-and-units-figures",
  title: "Select the Revenue and Units figures",
  prompt: "Select the Revenue and Units figures, without the headers.",
  family: "selection",
  difficulty: 3,
  seed: "revenue-units-data-v1",
  timingPolicy: { kind: "single-challenge", targetSeconds: 10 },
  initialGrid: createRevenueGrid(),
  allowedActions: [...SELECTION_ACTIONS],
  validation: {
    kind: "selection",
    requiredRange: {
      start: { row: FIRST_DATA_ROW, col: REVENUE_COL },
      end: { row: LAST_DATA_ROW, col: UNITS_COL },
    },
  },
  scoring: { basePoints: 1300, targetSeconds: 10, minimumCorrectnessForPr: 1 },
  practiceNotes: [
    {
      title: "Fast route",
      body: "Click C2, then Ctrl+Shift+Down and Shift+Right does it without touching the mouse again.",
    },
  ],
};

export const formattingBoldRegionColumnChallenge: Challenge = {
  id: "formatting.bold-region-column",
  version: "v1",
  slug: "bold-the-region-names",
  title: "Bold the Region names",
  prompt: "Make the Region names bold.",
  family: "formatting",
  difficulty: 2,
  seed: "bold-region-v1",
  initialGrid: createRevenueGrid(),
  timingPolicy: { kind: "single-challenge", targetSeconds: 10 },
  allowedActions: [...SELECTION_ACTIONS, "set-format"],
  validation: {
    kind: "formatting",
    // The header is graded by other challenges; this one wants the names below it.
    range: {
      start: { row: FIRST_DATA_ROW, col: REGION_COL },
      end: { row: LAST_DATA_ROW, col: REGION_COL },
    },
    requiredFormat: { bold: true },
  },
  scoring: { basePoints: 1200, targetSeconds: 10, minimumCorrectnessForPr: 1 },
  practiceNotes: [
    {
      title: "Fast route",
      body: "Select A2, Ctrl+Shift+Down to take the column of names, then Ctrl+B.",
    },
  ],
};

export const formattingUnboldHeaderChallenge: Challenge = {
  id: "formatting.unbold-header",
  version: "v1",
  slug: "unbold-the-header-row",
  title: "Unbold the header row",
  prompt: "Remove the bold from the header row.",
  family: "formatting",
  difficulty: 2,
  seed: "unbold-header-v1",
  // The default grid ships the header bold, which is exactly what this one needs.
  initialGrid: createRevenueGrid(),
  timingPolicy: { kind: "single-challenge", targetSeconds: 10 },
  allowedActions: [...SELECTION_ACTIONS, "set-format"],
  validation: {
    kind: "formatting",
    range: {
      start: { row: HEADER_ROW, col: 0 },
      end: { row: HEADER_ROW, col: LAST_USED_COL },
    },
    requiredFormat: { bold: false },
  },
  scoring: { basePoints: 1200, targetSeconds: 10, minimumCorrectnessForPr: 1 },
  practiceNotes: [
    {
      title: "Fast route",
      body: "Select A1, Ctrl+Shift+Right to take the header cells, then Ctrl+B: a fully bold selection unbolds.",
    },
  ],
};

export const formattingBoldFirstDataRowChallenge: Challenge = {
  id: "formatting.bold-first-data-row",
  version: "v1",
  slug: "bold-the-first-data-row",
  title: "Bold the first data row",
  prompt: "Make the first data row bold.",
  family: "formatting",
  difficulty: 2,
  seed: "bold-first-data-row-v1",
  initialGrid: createRevenueGrid(),
  timingPolicy: { kind: "single-challenge", targetSeconds: 9 },
  allowedActions: [...SELECTION_ACTIONS, "set-format"],
  validation: {
    kind: "formatting",
    range: {
      start: { row: FIRST_DATA_ROW, col: 0 },
      end: { row: FIRST_DATA_ROW, col: LAST_USED_COL },
    },
    requiredFormat: { bold: true },
  },
  scoring: { basePoints: 1100, targetSeconds: 9, minimumCorrectnessForPr: 1 },
  practiceNotes: [
    {
      title: "Fast route",
      body: "Shift+Space anywhere in row 2, then Ctrl+B or the Bold button.",
    },
  ],
};

export const sortUnitsLowToHighChallenge: Challenge = {
  id: "sort-filter.units-low-to-high",
  version: "v1",
  slug: "sort-units-low-to-high",
  title: "Sort Units low to high",
  prompt: "Sort the table by Units, lowest first.",
  family: "sort-filter",
  difficulty: 2,
  seed: "sort-units-asc-v1",
  initialGrid: createRevenueGrid(),
  timingPolicy: { kind: "single-challenge", targetSeconds: 10 },
  allowedActions: [...SELECTION_ACTIONS, "sort-column"],
  validation: {
    kind: "sort-filter",
    requiredSort: { col: UNITS_COL, direction: "asc" },
  },
  scoring: { basePoints: 1300, targetSeconds: 10, minimumCorrectnessForPr: 1 },
  practiceNotes: [
    {
      title: "Fast route",
      body: "Put the cursor in Units and sort A to Z.",
    },
  ],
};

export const sortRepAToZChallenge: Challenge = {
  id: "sort-filter.rep-a-to-z",
  version: "v1",
  slug: "sort-reps-a-to-z",
  title: "Sort Reps A to Z",
  prompt: "Sort the table by Rep, alphabetically.",
  family: "sort-filter",
  difficulty: 2,
  seed: "sort-rep-asc-v1",
  initialGrid: createRevenueGrid(),
  timingPolicy: { kind: "single-challenge", targetSeconds: 10 },
  allowedActions: [...SELECTION_ACTIONS, "sort-column"],
  validation: {
    kind: "sort-filter",
    requiredSort: { col: REP_COL, direction: "asc" },
  },
  scoring: { basePoints: 1300, targetSeconds: 10, minimumCorrectnessForPr: 1 },
  practiceNotes: [
    {
      title: "Fast route",
      body: "Any Rep cell, then sort A to Z. Text sorts alphabetically, numbers numerically.",
    },
  ],
};

export const filterStatusCompleteChallenge: Challenge = {
  id: "sort-filter.status-complete",
  version: "v1",
  slug: "filter-status-to-complete",
  title: "Show only Complete rows",
  prompt: "Show only the rows whose Status is Complete.",
  family: "sort-filter",
  difficulty: 2,
  seed: "filter-status-complete-v1",
  initialGrid: createRevenueGrid(),
  timingPolicy: { kind: "single-challenge", targetSeconds: 10 },
  allowedActions: [...SELECTION_ACTIONS, "filter-column", "clear-filters"],
  validation: {
    kind: "sort-filter",
    requiredVisible: { col: STATUS_COL, op: "equals", value: "Complete" },
  },
  scoring: { basePoints: 1300, targetSeconds: 10, minimumCorrectnessForPr: 1 },
  practiceNotes: [
    {
      title: "Fast route",
      body: "Select any Complete cell in Status and filter to it.",
    },
  ],
};

export const filterUnitsAboveBrunoChallenge: Challenge = {
  id: "sort-filter.units-above-bruno",
  version: "v1",
  slug: "filter-units-above-bruno",
  title: "Show Units above Bruno's",
  prompt: "Show only the rows with more Units than Bruno.",
  family: "sort-filter",
  difficulty: 3,
  seed: "filter-units-above-bruno-v1",
  initialGrid: createRevenueGrid(),
  timingPolicy: { kind: "single-challenge", targetSeconds: 12 },
  allowedActions: [...SELECTION_ACTIONS, "filter-column", "clear-filters"],
  validation: {
    kind: "sort-filter",
    requiredVisible: { col: UNITS_COL, op: "greater-than", value: BRUNO_UNITS },
  },
  scoring: { basePoints: 1500, targetSeconds: 12, minimumCorrectnessForPr: 1 },
  practiceNotes: [
    {
      title: "Fast route",
      body: "Click Bruno's Units cell, then Filter > keeps only the rows above it.",
    },
  ],
};

export const mixedSortAndBoldChallenge: Challenge = {
  id: "mixed.sort-and-bold",
  version: "v1",
  slug: "sort-revenue-and-bold-header",
  title: "Sort Revenue and bold the header",
  prompt: "Sort Revenue highest first, and make the header row bold.",
  family: "mixed",
  difficulty: 4,
  seed: "sort-and-bold-v1",
  // The header starts unbolded so both halves are real work.
  initialGrid: createRevenueGrid({ boldHeaders: false }),
  timingPolicy: { kind: "single-challenge", targetSeconds: 16 },
  allowedActions: [...SELECTION_ACTIONS, "sort-column", "set-format"],
  validation: {
    kind: "composite",
    parts: [
      { kind: "sort-filter", requiredSort: { col: REVENUE_COL, direction: "desc" } },
      {
        kind: "formatting",
        range: {
          start: { row: HEADER_ROW, col: 0 },
          end: { row: HEADER_ROW, col: LAST_USED_COL },
        },
        requiredFormat: { bold: true },
      },
    ],
  },
  scoring: { basePoints: 1800, targetSeconds: 16, minimumCorrectnessForPr: 1 },
  practiceNotes: [
    {
      title: "Fast route",
      body: "Sort from any Revenue cell, then Shift+Space on row 1 and Ctrl+B. Either order works: sorting never moves the header.",
    },
  ],
};

export const mixedFilterEastCurrencyChallenge: Challenge = {
  id: "mixed.filter-east-currency",
  version: "v1",
  slug: "filter-east-and-format-currency",
  title: "Filter East and format Revenue",
  prompt: "Show only the East rows, and format the Revenue figures as currency.",
  family: "mixed",
  difficulty: 4,
  seed: "filter-east-currency-v1",
  // Revenue starts unformatted so the formatting half is real work.
  initialGrid: createRevenueGrid({ revenueFormat: "general" }),
  timingPolicy: { kind: "single-challenge", targetSeconds: 18 },
  allowedActions: [...SELECTION_ACTIONS, "filter-column", "clear-filters", "set-format"],
  validation: {
    kind: "composite",
    parts: [
      { kind: "sort-filter", requiredVisible: { col: REGION_COL, op: "equals", value: "East" } },
      {
        kind: "formatting",
        range: {
          start: { row: FIRST_DATA_ROW, col: REVENUE_COL },
          end: { row: LAST_DATA_ROW, col: REVENUE_COL },
        },
        requiredFormat: { numberFormat: "currency" },
      },
    ],
  },
  scoring: { basePoints: 1800, targetSeconds: 18, minimumCorrectnessForPr: 1 },
  practiceNotes: [
    {
      title: "Fast route",
      body: "Filter to an East cell, then Ctrl+Space from any Revenue cell and Ctrl+Shift+4. Either order works: hidden rows still take formatting.",
    },
  ],
};

/**
 * The order the game plays them in. The first eight are the original set and they stay first,
 * because session queues are deterministic slices of this list and reordering them would change
 * what Sprint 5 means overnight.
 *
 * These 23 are the last hand-written challenge literals. New content arrives as seeded templates;
 * these are wrapped as fixed templates below so the whole game flows through one registry.
 */
const fixedChallenges: Challenge[] = [
  selectionRevenueColumnChallenge,
  navigationLastRevenueCellChallenge,
  selectionHeaderRowChallenge,
  selectionWholeTableChallenge,
  formattingBoldHeaderChallenge,
  formattingCurrencyRevenueChallenge,
  sortRevenueHighToLowChallenge,
  filterEastRegionChallenge,
  navigationFirstRegionCellChallenge,
  navigationLastStatusCellChallenge,
  navigationDaraUnitsChallenge,
  selectionUnitsColumnChallenge,
  selectionFirstDataRowChallenge,
  selectionRevenueUnitsDataChallenge,
  formattingBoldRegionColumnChallenge,
  formattingUnboldHeaderChallenge,
  formattingBoldFirstDataRowChallenge,
  sortUnitsLowToHighChallenge,
  sortRepAToZChallenge,
  filterStatusCompleteChallenge,
  filterUnitsAboveBrunoChallenge,
  mixedSortAndBoldChallenge,
  mixedFilterEastCurrencyChallenge,
];

export const challengeTemplates: ChallengeTemplate[] = fixedChallenges.map(fixedTemplate);

/** One registry over everything: the 23 fixed classics and every seeded template. */
export const templateRegistry: TemplateRegistry = createTemplateRegistry([
  ...challengeTemplates,
  ...generatedTemplates,
]);

/**
 * The playable classic list, derived from its templates through the same materialization path
 * every generated variant uses. Ids and seeds are byte-identical to the literals above, so every
 * existing personal record still resolves.
 */
export const challenges: ChallengeVariant[] = challengeTemplates.map((template, index) => {
  const source = fixedChallenges[index];
  const variant = materializeTemplate(template, source.seed, source.difficulty);

  if (variant === null) {
    throw new Error(`Fixed template ${template.id} failed to materialize.`);
  }

  return variant;
});

/** The challenge the game opens into. */
export const defaultChallenge: Challenge = challenges[0];

export function challengeAfter(challenge: Challenge): Challenge {
  const index = challenges.findIndex((candidate) => candidate.id === challenge.id);

  // Wraps, so a player can keep going round the set rather than hitting a dead end.
  return challenges[(index + 1) % challenges.length];
}

import type { Challenge } from "@/domain/challenges/challengeTypes";
import {
  EAST_ROW_COUNT,
  FIRST_DATA_ROW,
  HEADER_ROW,
  LAST_DATA_ROW,
  LAST_USED_COL,
  REGION_COL,
  REVENUE_COL,
  createRevenueGrid,
} from "@/data/grids/revenueGrid";

const SELECTION_ACTIONS = ["select-cell", "select-range", "select-row", "select-column"] as const;

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

/** The order the game plays them in. Easiest first. */
export const challenges: Challenge[] = [
  selectionRevenueColumnChallenge,
  navigationLastRevenueCellChallenge,
  selectionHeaderRowChallenge,
  selectionWholeTableChallenge,
  formattingBoldHeaderChallenge,
  formattingCurrencyRevenueChallenge,
  sortRevenueHighToLowChallenge,
  filterEastRegionChallenge,
];

/** The challenge the game opens into. */
export const defaultChallenge: Challenge = selectionRevenueColumnChallenge;

export function challengeAfter(challenge: Challenge): Challenge {
  const index = challenges.findIndex((candidate) => candidate.id === challenge.id);

  // Wraps, so a player can keep going round the set rather than hitting a dead end.
  return challenges[(index + 1) % challenges.length];
}

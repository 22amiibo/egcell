import type { Challenge } from "@/domain/challenges/challengeTypes";
import type { CellFormat, CellValue, GridCell, GridState } from "@/domain/grid/gridTypes";
import { cellKey, columnLabel } from "@/domain/grid/range";

const ROW_COUNT = 12;
const COL_COUNT = 8;
const REVENUE_COL = 2;

const HEADERS = ["Region", "Rep", "Revenue", "Units", "Status"];

const DATA_ROWS: Array<[string, string, number, number, string]> = [
  ["East", "Alice", 128400, 312, "Complete"],
  ["West", "Bruno", 94250, 201, "Pending"],
  ["North", "Chidi", 156900, 388, "Complete"],
  ["South", "Dara", 72100, 165, "Pending"],
  ["East", "Eli", 143750, 341, "Complete"],
  ["West", "Farah", 88300, 190, "Pending"],
];

const LAST_USED_ROW = DATA_ROWS.length;
const LAST_USED_COL = HEADERS.length - 1;

function makeCell(row: number, col: number, value: CellValue, format: CellFormat = {}): GridCell {
  return { address: { row, col }, value, format };
}

export function createRevenueGrid(): GridState {
  const cells: Record<string, GridCell> = {};

  const addCell = (cell: GridCell) => {
    cells[cellKey(cell.address)] = cell;
  };

  HEADERS.forEach((header, col) => {
    addCell(makeCell(0, col, { kind: "text", value: header }, { bold: true }));
  });

  DATA_ROWS.forEach(([region, rep, revenue, units, status], index) => {
    const row = index + 1;

    addCell(makeCell(row, 0, { kind: "text", value: region }));
    addCell(makeCell(row, 1, { kind: "text", value: rep }));
    addCell(
      makeCell(row, REVENUE_COL, { kind: "number", value: revenue }, { numberFormat: "currency" }),
    );
    addCell(makeCell(row, 3, { kind: "number", value: units }));
    addCell(makeCell(row, 4, { kind: "text", value: status }));
  });

  return {
    rowCount: ROW_COUNT,
    colCount: COL_COUNT,
    usedRange: {
      start: { row: 0, col: 0 },
      end: { row: LAST_USED_ROW, col: LAST_USED_COL },
    },
    columns: Array.from({ length: COL_COUNT }, (_, col) => columnLabel(col)),
    rows: Array.from({ length: ROW_COUNT }, (_, row) => row + 1),
    cells,
    activeCell: { row: 0, col: 0 },
    selection: { kind: "none" },
    hiddenRows: [],
    sortState: null,
    filters: [],
  };
}

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
  allowedActions: ["select-cell", "select-range", "select-column"],
  validation: {
    kind: "selection",
    requiredRange: {
      start: { row: 0, col: REVENUE_COL },
      end: { row: LAST_USED_ROW, col: REVENUE_COL },
    },
    requireEntireColumnWithinUsedRange: true,
  },
  scoring: {
    basePoints: 1000,
    targetSeconds: 8,
    minimumCorrectnessForPr: 1,
  },
  practiceNotes: [
    {
      title: "Fast route",
      body: "Click the Revenue column header instead of dragging down the cells. A keyboard column-select shortcut lands once keyboard support exists.",
    },
  ],
};

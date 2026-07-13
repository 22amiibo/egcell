import type {
  CellFormat,
  CellValue,
  GridCell,
  GridState,
  NumberFormat,
} from "@/domain/grid/gridTypes";
import { cellKey, columnLabel } from "@/domain/grid/range";

const ROW_COUNT = 12;
const COL_COUNT = 8;

export const REGION_COL = 0;
export const REP_COL = 1;
export const REVENUE_COL = 2;
export const UNITS_COL = 3;
export const STATUS_COL = 4;

const HEADERS = ["Region", "Rep", "Revenue", "Units", "Status"];

/** Revenue values are distinct and out of order, so sorting them is a real change rather than a no-op. */
const DATA_ROWS: Array<[string, string, number, number, string]> = [
  ["East", "Alice", 128400, 312, "Complete"],
  ["West", "Bruno", 94250, 201, "Pending"],
  ["North", "Chidi", 156900, 388, "Complete"],
  ["South", "Dara", 72100, 165, "Pending"],
  ["East", "Eli", 143750, 341, "Complete"],
  ["West", "Farah", 88300, 190, "Pending"],
];

export const HEADER_ROW = 0;
export const FIRST_DATA_ROW = 1;
export const LAST_DATA_ROW = DATA_ROWS.length;
export const LAST_USED_COL = HEADERS.length - 1;

export const EAST_ROW_COUNT = DATA_ROWS.filter(([region]) => region === "East").length;

export type RevenueGridOptions = {
  /** A challenge that asks the player to bold the header needs the header to start unbolded. */
  boldHeaders?: boolean;
  /** Likewise, a currency challenge needs Revenue to start as a plain number. */
  revenueFormat?: NumberFormat;
};

function makeCell(row: number, col: number, value: CellValue, format: CellFormat = {}): GridCell {
  return { address: { row, col }, value, format };
}

export function createRevenueGrid(options: RevenueGridOptions = {}): GridState {
  const { boldHeaders = true, revenueFormat = "currency" } = options;

  const cells: Record<string, GridCell> = {};

  const addCell = (cell: GridCell) => {
    cells[cellKey(cell.address)] = cell;
  };

  HEADERS.forEach((header, col) => {
    addCell(makeCell(HEADER_ROW, col, { kind: "text", value: header }, { bold: boldHeaders }));
  });

  DATA_ROWS.forEach(([region, rep, revenue, units, status], index) => {
    const row = index + FIRST_DATA_ROW;

    addCell(makeCell(row, REGION_COL, { kind: "text", value: region }));
    addCell(makeCell(row, REP_COL, { kind: "text", value: rep }));
    addCell(
      makeCell(row, REVENUE_COL, { kind: "number", value: revenue }, { numberFormat: revenueFormat }),
    );
    addCell(makeCell(row, UNITS_COL, { kind: "number", value: units }));
    addCell(makeCell(row, STATUS_COL, { kind: "text", value: status }));
  });

  return {
    rowCount: ROW_COUNT,
    colCount: COL_COUNT,
    usedRange: {
      start: { row: HEADER_ROW, col: 0 },
      end: { row: LAST_DATA_ROW, col: LAST_USED_COL },
    },
    headerRows: 1,
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

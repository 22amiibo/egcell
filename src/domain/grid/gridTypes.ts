export type CellAddress = { row: number; col: number };
export type RangeAddress = { start: CellAddress; end: CellAddress };

export type CellValue =
  | { kind: "blank" }
  | { kind: "text"; value: string }
  | { kind: "number"; value: number }
  | { kind: "date"; iso: string }
  | { kind: "formula"; formula: string; computed: CellValue };

export type CellFormat = {
  bold?: boolean;
  numberFormat?: "general" | "currency" | "percent" | "date";
  fill?: string;
};

export type GridCell = {
  address: CellAddress;
  value: CellValue;
  format: CellFormat;
};

export type GridSelection =
  | { kind: "none" }
  | { kind: "cell"; cell: CellAddress }
  | { kind: "range"; range: RangeAddress }
  | { kind: "row"; row: number }
  | { kind: "column"; col: number; usedRangeOnly: boolean };

export type SortState = {
  col: number;
  direction: "asc" | "desc";
};

export type FilterState = {
  col: number;
  op: "equals" | "greater-than" | "less-than";
  value: string | number;
};

export type GridState = {
  rowCount: number;
  colCount: number;
  usedRange: RangeAddress;
  columns: string[];
  rows: number[];
  cells: Record<string, GridCell>;
  activeCell: CellAddress;
  selection: GridSelection;
  hiddenRows: number[];
  sortState: SortState | null;
  filters: FilterState[];
};

export type GridActionKind = "select-cell" | "select-range" | "select-row" | "select-column";

export type GridAction =
  | { kind: "select-cell"; cell: CellAddress }
  | { kind: "select-range"; range: RangeAddress }
  | { kind: "select-row"; row: number }
  | { kind: "select-column"; col: number; usedRangeOnly: boolean };

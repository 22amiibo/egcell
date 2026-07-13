export type CellAddress = { row: number; col: number };
export type RangeAddress = { start: CellAddress; end: CellAddress };

export type CellValue =
  | { kind: "blank" }
  | { kind: "text"; value: string }
  | { kind: "number"; value: number }
  | { kind: "date"; iso: string }
  | { kind: "formula"; formula: string; computed: CellValue };

export type NumberFormat = "general" | "currency" | "percent" | "date";

export type CellFormat = {
  bold?: boolean;
  numberFormat?: NumberFormat;
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

export type SortDirection = "asc" | "desc";

export type SortState = {
  col: number;
  direction: SortDirection;
};

export type FilterOp = "equals" | "greater-than" | "less-than";

export type FilterState = {
  col: number;
  op: FilterOp;
  value: string | number;
};

export type GridState = {
  rowCount: number;
  colCount: number;
  usedRange: RangeAddress;
  /**
   * How many rows at the top of the used range are headers. Sorting and filtering move and hide
   * data rows, and both must leave the header alone, so the model has to know where it ends.
   */
  headerRows: number;
  columns: string[];
  rows: number[];
  cells: Record<string, GridCell>;
  activeCell: CellAddress;
  selection: GridSelection;
  hiddenRows: number[];
  sortState: SortState | null;
  filters: FilterState[];
};

export type GridActionKind =
  | "select-cell"
  | "select-range"
  | "select-row"
  | "select-column"
  | "set-format"
  | "sort-column"
  | "filter-column"
  | "clear-filters";

export type GridAction =
  | { kind: "select-cell"; cell: CellAddress }
  | { kind: "select-range"; range: RangeAddress }
  | { kind: "select-row"; row: number }
  | { kind: "select-column"; col: number; usedRangeOnly: boolean }
  /** Merges into whatever format the cell already carries, rather than replacing it. */
  | { kind: "set-format"; range: RangeAddress; format: CellFormat }
  | { kind: "sort-column"; col: number; direction: SortDirection }
  | { kind: "filter-column"; col: number; op: FilterOp; value: string | number }
  | { kind: "clear-filters" };

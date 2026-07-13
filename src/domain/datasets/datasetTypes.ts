import type { GridState, NumberFormat } from "@/domain/grid/gridTypes";

/**
 * Roles are the seam between datasets and challenges. A template asks for "the amount column";
 * the dataset decides that this table's amount column is called Spend and sits at index 4. A
 * template may only locate its targets through a role, never through a header string or a column
 * constant, so grid and validation spec can never disagree about where a column is.
 */
export type ColumnRole =
  | "category" // East / West, Marketing / Ops — the thing you filter by
  | "name" // a person, a vendor, a project — the thing you look up by
  | "amount" // money — currency-formattable
  | "count" // units, seats, tasks — whole numbers
  | "rate" // margin, progress — percent-formattable
  | "status" // Complete / Pending — a small closed set
  | "date" // an ISO date — date-formattable
  | "note"; // free text — a distractor by nature

export type ThemeColumn = {
  role: ColumnRole;
  header: string;
  type: "text" | "number" | "date";
  /** How the data cells start formatted, unless the shape strips it. */
  numberFormat?: NumberFormat;
  /** Categorical pool for text roles. Name pools are sampled without replacement. */
  values?: readonly string[];
  /** Inclusive integer bounds for number roles. Rates are drawn as percents and stored /100. */
  range?: [number, number];
  /** A similar-looking header for a distractor twin at higher difficulties. */
  confusable?: string;
};

/**
 * A theme is data, not logic. It supplies headers and value pools; it can change what a table
 * says but never what a validator checks, except through the schema the generator hands back.
 */
export type DatasetTheme = {
  id: string;
  label: string;
  columns: ThemeColumn[];
};

/** What the generator is asked to build. Templates derive this from the difficulty preset. */
export type DatasetShape = {
  /** Data rows, header excluded. */
  rows: number;
  /** Roles the template must be able to target. Always placed. */
  requiredRoles: ColumnRole[];
  /** Total column budget, distractors included. Raised if the roles cannot fit. */
  totalCols: number;
  distractorCols: number;
  /** Whether distractors may be similar-looking twins ("Revenue" next to "Revenue LY"). */
  confusables: boolean;
  /** Punch one blank cell into this role's column, for edge-jump and first-blank drills. */
  blankInRole?: ColumnRole;
  /** May the table start away from A1. */
  tableOffset: boolean;
  /** Roles whose data cells start with no number format, for formatting drills. */
  unformattedRoles?: ColumnRole[];
  boldHeaders?: boolean;
};

/**
 * A generated grid plus the layout the generator chose. Templates read target coordinates ONLY
 * from here — never from a constant — which is the rule that keeps a generated grid and its
 * validation spec from ever disagreeing about where a column is.
 */
export type GeneratedGrid = {
  grid: GridState;
  themeId: string;
  /** Column index of each primary role actually placed. Twins are not in here. */
  columnsByRole: Partial<Record<ColumnRole, number>>;
  /** Header text by absolute column index. */
  headersByCol: Record<number, string>;
  headerRow: number;
  firstDataRow: number;
  lastDataRow: number;
  firstCol: number;
  lastCol: number;
  /** Columns beyond the primary roles: confusable twins and note columns. */
  distractorCols: number[];
  /** Rows holding a punched blank, by column index. */
  blanksByCol: Record<number, number[]>;
};

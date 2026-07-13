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

/**
 * The Revenue dataset is shipped by the app, not by the tests, so production code never imports
 * from the test tree. This fixture just re-exports it.
 */
export {
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

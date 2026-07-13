/**
 * The Revenue dataset is owned by the challenge that ships it, so production code never
 * imports from the test tree. This fixture re-exports it for domain tests.
 */
export { createRevenueGrid } from "@/data/challenges/selectionRevenueColumn";

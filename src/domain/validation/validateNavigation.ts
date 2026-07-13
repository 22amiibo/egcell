import {
  NOTHING_DONE_YET,
  type ChallengeValidator,
  failed,
  passed,
} from "@/domain/validation/validatorTypes";

/**
 * Navigation grades the active cell, not the selection. Landing on the right cell counts however
 * the player got there, whether by clicking it or by arrowing across the grid.
 */
export const validateNavigation: ChallengeValidator<"navigation"> = ({ grid }, spec) => {
  if (grid.selection.kind === "none") {
    return NOTHING_DONE_YET;
  }

  const { requiredCell } = spec;
  const { activeCell } = grid;

  if (activeCell.row !== requiredCell.row || activeCell.col !== requiredCell.col) {
    return failed("That is not the target cell.");
  }

  return passed("You are on the target cell.");
};

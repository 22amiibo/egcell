import type { ChallengeValidator } from "@/domain/validation/validatorTypes";
import { failed, passed } from "@/domain/validation/validatorTypes";
import { cellKey } from "@/domain/grid/range";
import { formatA1 } from "@/domain/grid/formulaEval";

/**
 * Grades the committed cell's value directly, never the route the player took to it: typing "42"
 * and pasting "42" score the same, because both end in a `set-cell-value` commit holding the same
 * `CellValue`.
 */
export const validateValue: ChallengeValidator<"cell-value"> = (input, spec) => {
  const value = input.grid.cells[cellKey(spec.cell)]?.value ?? { kind: "blank" };
  const a1 = formatA1(spec.cell);

  if (value.kind === "blank") {
    return failed(`Type the value into ${a1}.`);
  }

  if (spec.expected.kind === "number") {
    if (value.kind === "number" && value.value === spec.expected.value) {
      return passed(`${a1} holds the right value.`);
    }

    return failed(`${a1} does not hold the value we need yet.`);
  }

  if (value.kind === "text" && value.value.trim() === spec.expected.value.trim()) {
    return passed(`${a1} holds the right value.`);
  }

  return failed(`${a1} does not hold the value we need yet.`);
};

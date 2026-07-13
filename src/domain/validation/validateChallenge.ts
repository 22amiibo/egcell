import { validateFormatting } from "@/domain/validation/validateFormatting";
import { validateNavigation } from "@/domain/validation/validateNavigation";
import { validateSelection } from "@/domain/validation/validateSelection";
import { validateSortFilter } from "@/domain/validation/validateSortFilter";
import type { ValidationInput, ValidationResult } from "@/domain/validation/validatorTypes";

/**
 * The single entry point the game runs after every player action.
 *
 * It routes on the challenge's validation spec, never on its id, so a challenge can be renamed or
 * reversioned without touching a validator. The switch is exhaustive: adding a `ValidationSpec`
 * kind without a validator is a type error rather than a challenge that silently never completes.
 */
export function validateChallenge(input: ValidationInput): ValidationResult {
  const spec = input.challenge.validation;

  switch (spec.kind) {
    case "selection":
      return validateSelection(input, spec);
    case "navigation":
      return validateNavigation(input, spec);
    case "formatting":
      return validateFormatting(input, spec);
    case "sort-filter":
      return validateSortFilter(input, spec);
  }
}

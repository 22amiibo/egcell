import type { ValidationSpec } from "@/domain/challenges/challengeTypes";
import { selectionValidator } from "@/domain/validation/validateSelection";
import type {
  ChallengeValidator,
  ValidationInput,
  ValidationResult,
} from "@/domain/validation/validatorTypes";

const validators: Record<ValidationSpec["kind"], ChallengeValidator> = {
  selection: selectionValidator,
};

/**
 * The single entry point the game runs after every player action.
 * Routes on the challenge's validation spec, never on its id, so a challenge can be renamed
 * or reversioned without touching a validator.
 */
export function validateChallenge(input: ValidationInput): ValidationResult {
  return validators[input.challenge.validation.kind].validate(input);
}

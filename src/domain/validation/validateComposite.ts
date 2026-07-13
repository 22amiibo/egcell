import type { LeafValidationSpec } from "@/domain/challenges/challengeTypes";
import { validateFormatting } from "@/domain/validation/validateFormatting";
import { validateNavigation } from "@/domain/validation/validateNavigation";
import { validateSelection } from "@/domain/validation/validateSelection";
import { validateSortFilter } from "@/domain/validation/validateSortFilter";
import {
  type ChallengeValidator,
  type ValidationInput,
  type ValidationResult,
  failed,
  passed,
} from "@/domain/validation/validatorTypes";

function validatePart(input: ValidationInput, part: LeafValidationSpec): ValidationResult {
  switch (part.kind) {
    case "selection":
      return validateSelection(input, part);
    case "navigation":
      return validateNavigation(input, part);
    case "formatting":
      return validateFormatting(input, part);
    case "sort-filter":
      return validateSortFilter(input, part);
  }
}

/**
 * A mixed challenge is its parts and nothing more: every leaf spec must pass, progress is the
 * mean of the parts, and the message shown is the first unfinished part's, so the player is told
 * about one thing to fix rather than a list.
 */
export const validateComposite: ChallengeValidator<"composite"> = (input, spec) => {
  if (spec.parts.length === 0) {
    return failed("This challenge has no parts to grade, which is a bug in its definition.");
  }

  const results = spec.parts.map((part) => validatePart(input, part));

  if (results.every((result) => result.isComplete)) {
    return passed("Every part of the task is done.");
  }

  const completionPercent =
    results.reduce((sum, result) => sum + result.completionPercent, 0) / results.length;
  const correctness =
    results.reduce((sum, result) => sum + result.correctness, 0) / results.length;
  const firstUnfinished = results.find((result) => !result.isComplete) as ValidationResult;

  return {
    isComplete: false,
    correctness,
    completionPercent,
    accuracy: 1,
    messages: firstUnfinished.messages,
  };
};

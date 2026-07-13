import type { Challenge, ValidationSpec } from "@/domain/challenges/challengeTypes";
import type { GridState } from "@/domain/grid/gridTypes";
import type { RunState } from "@/domain/runs/runTypes";

export type ValidationMessage = {
  kind: "success" | "error" | "info";
  text: string;
};

export type ValidationResult = {
  isComplete: boolean;
  /** 0 to 1. Squared by scoring, so partial credit is punished hard. */
  correctness: number;
  /** 0 to 1. Carries partial progress in future fixed-time modes. */
  completionPercent: number;
  /** 0 to 1. Pinned at 1 until invalid-action tracking exists. */
  accuracy: number;
  messages: ValidationMessage[];
};

export type ValidationInput = {
  challenge: Challenge;
  grid: GridState;
  run: RunState;
};

export type SpecOfKind<K extends ValidationSpec["kind"]> = Extract<ValidationSpec, { kind: K }>;

/** A validator is handed its own narrowed spec, so it can never read another family's fields. */
export type ChallengeValidator<K extends ValidationSpec["kind"]> = (
  input: ValidationInput,
  spec: SpecOfKind<K>,
) => ValidationResult;

export const NOTHING_DONE_YET: ValidationResult = {
  isComplete: false,
  correctness: 0,
  completionPercent: 0,
  accuracy: 1,
  messages: [{ kind: "info", text: "Nothing is selected yet." }],
};

export function failed(text: string): ValidationResult {
  return {
    isComplete: false,
    correctness: 0,
    completionPercent: 0,
    accuracy: 1,
    messages: [{ kind: "error", text }],
  };
}

export function passed(text: string): ValidationResult {
  return {
    isComplete: true,
    correctness: 1,
    completionPercent: 1,
    accuracy: 1,
    messages: [{ kind: "success", text }],
  };
}

/** Partial progress: the run is not over, but the player has some of it right. */
export function partial(progress: number, text: string): ValidationResult {
  return {
    isComplete: false,
    correctness: progress,
    completionPercent: progress,
    accuracy: 1,
    messages: [{ kind: "error", text }],
  };
}

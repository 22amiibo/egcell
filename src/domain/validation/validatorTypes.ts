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

export type ChallengeValidator = {
  kind: ValidationSpec["kind"];
  validate(input: ValidationInput): ValidationResult;
};

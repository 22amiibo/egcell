import type { GridActionKind, GridState, RangeAddress } from "@/domain/grid/gridTypes";

export type ChallengeFamily = "navigation" | "selection" | "formatting" | "sort-filter" | "formula";
export type ChallengeMode = "main-speed" | "practice";

export type TimingPolicy =
  | { kind: "single-challenge"; targetSeconds: number }
  | { kind: "fixed-time"; durationSeconds: number };

export type ValidationSpec = {
  kind: "selection";
  requiredRange: RangeAddress;
  requireEntireColumnWithinUsedRange?: boolean;
};

export type ChallengeScoringConfig = {
  basePoints: number;
  targetSeconds: number;
  minimumCorrectnessForPr: number;
};

export type PracticeNote = {
  title: string;
  body: string;
};

export type Challenge = {
  id: string;
  version: string;
  slug: string;
  title: string;
  prompt: string;
  family: ChallengeFamily;
  difficulty: 1 | 2 | 3 | 4 | 5;
  seed: string;
  timingPolicy: TimingPolicy;
  initialGrid: GridState;
  allowedActions: GridActionKind[];
  validation: ValidationSpec;
  scoring: ChallengeScoringConfig;
  practiceNotes: PracticeNote[];
};

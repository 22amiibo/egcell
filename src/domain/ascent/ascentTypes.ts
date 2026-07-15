import type { ChallengeDifficulty } from "@/domain/challenges/challengeTypes";

export type AscentConfig = {
  durationSeconds: number;
  /** Consecutive under-target clears that buy a promotion. */
  heatToPromote: number;
  maxTier: ChallengeDifficulty;
};

export const ASCENT_CONFIG: AscentConfig = { durationSeconds: 90, heatToPromote: 3, maxTier: 5 };

export type AscentState = {
  tier: ChallengeDifficulty;
  /** Progress toward the next promotion. Resets on any clear that is not under-target. */
  heat: number;
  /** Promotions earned past maxTier: each tightens targets instead of raising the tier. */
  overdriveRungs: number;
  peakTier: ChallengeDifficulty;
  tasksCompleted: number;
};

export const ASCENT_START: AscentState = {
  tier: 1,
  heat: 0,
  overdriveRungs: 0,
  peakTier: 1,
  tasksCompleted: 0,
};

export type AscentTaskOutcome = { completed: boolean; underTarget: boolean };

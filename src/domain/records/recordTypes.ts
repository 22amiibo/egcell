import type { ChallengeMode } from "@/domain/challenges/challengeTypes";

export type PersonalRecord = {
  challengeId: string;
  mode: ChallengeMode;
  bestScore: number;
  bestElapsedMs: number;
  bestCorrectness: number;
  /** ISO 8601. */
  achievedAt: string;
  seed: string;
};

/** Keyed by `${challengeId}:${mode}`. */
export type PersonalRecordStore = Record<string, PersonalRecord>;

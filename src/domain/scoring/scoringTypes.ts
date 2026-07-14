export type ScoreInput = {
  elapsedMs: number;
  /** 0 to 1, from the validator. */
  correctness: number;
  /** 0 to 1, from the validator. */
  completionPercent: number;
  /** 0 to 1, from the validator. */
  accuracy: number;
  basePoints: number;
  targetSeconds: number;
  /** Streak multiplier from the combo economy. Absent (1) outside sessions and Ascent. */
  comboMultiplier?: number;
};

export type ScoreResult = {
  score: number;
  speedMultiplier: number;
  correctnessMultiplier: number;
  completionMultiplier: number;
  accuracyMultiplier: number;
  comboMultiplier: number;
};

import type { ScoreInput, ScoreResult } from "@/domain/scoring/scoringTypes";

const MIN_SPEED_MULTIPLIER = 0.2;
const MAX_SPEED_MULTIPLIER = 2;
/** Below this, timing is noise rather than skill, so the clock stops rewarding speed. */
const FASTEST_CREDITED_SECONDS = 0.5;
/** Accuracy can only move a quarter of the score. Correctness carries the rest. */
const ACCURACY_WEIGHT = 0.25;
const MAX_COMBO_MULTIPLIER = 1.5;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Correctness is squared so a half-right run pays a quarter, not a half. That closes the
 * loophole where spamming a partly-correct answer quickly outscores getting it right.
 */
export function scoreRun(input: ScoreInput): ScoreResult {
  const elapsedSeconds = Math.max(input.elapsedMs / 1000, FASTEST_CREDITED_SECONDS);

  const speedMultiplier = clamp(
    input.targetSeconds / elapsedSeconds,
    MIN_SPEED_MULTIPLIER,
    MAX_SPEED_MULTIPLIER,
  );
  const correctnessMultiplier = input.correctness ** 2;
  const accuracyMultiplier = 1 - ACCURACY_WEIGHT + ACCURACY_WEIGHT * input.accuracy;
  const completionMultiplier = input.completionPercent;
  const comboMultiplier = clamp(input.comboMultiplier ?? 1, 1, MAX_COMBO_MULTIPLIER);

  const score = Math.round(
    input.basePoints *
      speedMultiplier *
      correctnessMultiplier *
      accuracyMultiplier *
      completionMultiplier *
      comboMultiplier,
  );

  return {
    score: Math.max(score, 0),
    speedMultiplier,
    correctnessMultiplier,
    completionMultiplier,
    accuracyMultiplier,
    comboMultiplier,
  };
}

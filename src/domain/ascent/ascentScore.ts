import type { AscentState } from "@/domain/ascent/ascentTypes";
import type { ChallengeVariant } from "@/domain/challenges/variantTypes";

export const TIER_WEIGHT_STEP = 0.25;
export const OVERDRIVE_TIGHTENING = 0.9;
export const MIN_TARGET_SECONDS = 2;

/** Climbing compounds: tier 5 pays 2×, and every overdrive rung keeps stacking. */
export function tierWeight(state: Pick<AscentState, "tier" | "overdriveRungs">): number {
  return 1 + TIER_WEIGHT_STEP * (state.tier - 1 + state.overdriveRungs);
}

export function ascentTaskScore(
  rawScore: number,
  state: Pick<AscentState, "tier" | "overdriveRungs">,
): number {
  return Math.round(rawScore * tierWeight(state));
}

export function effectiveTargetSeconds(base: number, overdriveRungs: number): number {
  return Math.max(MIN_TARGET_SECONDS, base * OVERDRIVE_TIGHTENING ** overdriveRungs);
}

/** Overdrive tightens the drill itself, so scoring, pace, and the combo all read one truth. */
export function withTightenedTarget(
  variant: ChallengeVariant,
  overdriveRungs: number,
): ChallengeVariant {
  if (overdriveRungs === 0) {
    return variant;
  }

  const targetSeconds = effectiveTargetSeconds(variant.scoring.targetSeconds, overdriveRungs);

  return {
    ...variant,
    timingPolicy: { kind: "single-challenge", targetSeconds },
    scoring: { ...variant.scoring, targetSeconds },
  };
}

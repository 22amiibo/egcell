import {
  ASCENT_CONFIG,
  type AscentConfig,
  type AscentState,
  type AscentTaskOutcome,
} from "@/domain/ascent/ascentTypes";
import type { ChallengeDifficulty } from "@/domain/challenges/challengeTypes";

/**
 * The entire ladder. A pure reducer: the tier is a ratchet (it never drops — the clock is the
 * only limiter, by design), heat is the promotion counter, and promotions past maxTier become
 * overdrive rungs.
 */
export function advanceAscent(
  state: AscentState,
  outcome: AscentTaskOutcome,
  config: AscentConfig = ASCENT_CONFIG,
): AscentState {
  const tasksCompleted = state.tasksCompleted + (outcome.completed ? 1 : 0);

  if (!(outcome.completed && outcome.underTarget)) {
    return { ...state, tasksCompleted, heat: 0 };
  }

  const heat = state.heat + 1;

  if (heat < config.heatToPromote) {
    return { ...state, tasksCompleted, heat };
  }

  if (state.tier < config.maxTier) {
    const tier = (state.tier + 1) as ChallengeDifficulty;

    return {
      tier,
      heat: 0,
      overdriveRungs: state.overdriveRungs,
      peakTier: tier > state.peakTier ? tier : state.peakTier,
      tasksCompleted,
    };
  }

  return { ...state, tasksCompleted, heat: 0, overdriveRungs: state.overdriveRungs + 1 };
}

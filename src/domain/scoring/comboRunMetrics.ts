import { advanceCombo, COMBO_RESET, type ComboTaskOutcome } from "@/domain/scoring/combo";

/** Run-level combo shape, folded once per completed Session/Ascent run. All raw counts. */
export type ComboRunMetrics = {
  /** Largest streak reached this run. Raw and unbounded (unlike the ×multiplier, capped at COMBO_CAP). */
  peakComboStreak: number;
  /** Active-combo transitions that reset the streak. */
  comboBreakCount: number;
  /** Transitions entering with an active combo (streak > 0) — where a combo could continue or break. */
  comboOpportunityCount: number;
};

/**
 * Replays `advanceCombo` over the exact per-task outcomes the driver scored with, so the fold is
 * authoritative by construction. NOTE (deviation from the brief's `foldComboRunMetrics(events)`):
 * combo lives on the per-task ComboTaskOutcome, NOT on RunEvent[] (which carries no per-task
 * target/elapsed/waste), so the fold consumes the outcomes fed to `advanceCombo` — the same signal
 * that drives the score's combo multiplier — not the raw run-event stream.
 */
export function foldComboRunMetrics(outcomes: ComboTaskOutcome[]): ComboRunMetrics {
  let state = COMBO_RESET;
  let peakComboStreak = 0;
  let comboBreakCount = 0;
  let comboOpportunityCount = 0;

  for (const outcome of outcomes) {
    const active = state.streak > 0;
    if (active) {
      comboOpportunityCount += 1;
    }
    state = advanceCombo(state, outcome);
    if (active && state.streak === 0) {
      comboBreakCount += 1;
    }
    if (state.streak > peakComboStreak) {
      peakComboStreak = state.streak;
    }
  }

  return { peakComboStreak, comboBreakCount, comboOpportunityCount };
}

/** The calibration signal. Null when there were no active-combo opportunities (never zero — see brief). */
export function comboBreakRate(metrics: ComboRunMetrics): number | null {
  return metrics.comboOpportunityCount > 0
    ? metrics.comboBreakCount / metrics.comboOpportunityCount
    : null;
}

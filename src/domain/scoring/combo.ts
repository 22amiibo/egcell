/**
 * The combo economy. A streak of consecutive tasks cleared under target with no wasted actions
 * and no keystroke corrections. The multiplier a task is scored with is the streak *entering* it;
 * drivers advance the streak after consuming the finished task.
 *
 * Applied only where no per-challenge personal record is banked (session tasks, Ascent tasks):
 * a `${challengeId}:${mode}` record fed by cross-task streak state would stop being comparable.
 */
export type ComboState = { streak: number };

export const COMBO_RESET: ComboState = { streak: 0 };

/** Five clean clears take the multiplier from 1.0 to its cap. */
export const COMBO_CAP = 5;
export const COMBO_STEP = 0.1;

export type ComboTaskOutcome = {
  underTarget: boolean;
  /** No wasted actions beyond the fastest route, and no keystroke corrections. */
  clean: boolean;
};

export function comboMultiplier(state: ComboState): number {
  return 1 + COMBO_STEP * Math.min(Math.max(state.streak, 0), COMBO_CAP);
}

export function advanceCombo(state: ComboState, outcome: ComboTaskOutcome): ComboState {
  return outcome.underTarget && outcome.clean ? { streak: state.streak + 1 } : COMBO_RESET;
}

export type ComboOutcomeInput = {
  elapsedMs: number;
  targetSeconds: number;
  /** Wasted actions beyond the solver's optimum. Null when the comparison could not say (`confidence: "low"`). */
  extraActions: number | null;
  /** Keystroke corrections in this task. 0 until typing exists. */
  corrections: number;
};

/** Unknown waste is treated as clean: a combo must never break on the engine's ignorance. */
export function comboOutcomeFrom(input: ComboOutcomeInput): ComboTaskOutcome {
  return {
    underTarget: input.elapsedMs <= input.targetSeconds * 1000,
    clean: (input.extraActions ?? 0) === 0 && input.corrections === 0,
  };
}

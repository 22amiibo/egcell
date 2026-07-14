import type { RunRecord } from "@/domain/runs/runRecord";

export type RunEligibility = {
  countsForPersonalBest: boolean;
  countsForPerformanceStats: boolean;
  countsForLeaderboard: boolean;
  countsForRecentRuns: boolean;
  countsForPracticeActivity: boolean;
};

/**
 * Exactly the fields the rules below read — no more (§1a.11). A `RunRecord` satisfies this
 * structurally, so the log can pass one straight in; `useGameRun` passes these four alone, because
 * it must decide a personal best *before* a record exists to build.
 *
 * What is absent matters as much as what is present: **there is no `modeKey` here.** A Practice run
 * and a Speed run in the same state are graded identically, which is the whole of §1a.1 — Practice
 * is an ordinary record-eligible mode, and assistance, not mode identity, is what unranks a run.
 */
export type RunEligibilityInput = Pick<
  RunRecord,
  "schemaVersion" | "assist" | "outcome" | "integrity"
>;

const NOTHING_COUNTS: RunEligibility = {
  countsForPersonalBest: false,
  countsForPerformanceStats: false,
  countsForLeaderboard: false,
  countsForRecentRuns: false,
  countsForPracticeActivity: false,
};

/** Shown and practised with, but off every board: the shape both an assisted and a failed run take. */
const UNRANKED_BUT_SHOWN: RunEligibility = {
  countsForPersonalBest: false,
  countsForPerformanceStats: false,
  countsForLeaderboard: false,
  countsForRecentRuns: true,
  countsForPracticeActivity: true,
};

const EVERYTHING_COUNTS: RunEligibility = {
  countsForPersonalBest: true,
  countsForPerformanceStats: true,
  countsForLeaderboard: true,
  countsForRecentRuns: true,
  countsForPracticeActivity: true,
};

/**
 * The one place that decides what a run counts for. Every board — personal bests, the performance
 * graph, the leaderboard, Recent Runs, practice activity — asks this and nothing else, so a change
 * of policy is a change of this function and retro-applies to runs already on disk (which is why
 * eligibility is derived at read time and never stored, §5.4).
 *
 * The rules, in order (§5.6, confirmed unchanged by §1a.4):
 *
 * 1. Suspect integrity → nothing counts. The run is still stored, for audit.
 * 2. Assistance revealed → unranked, but still shown and still practice. **This is the only rule
 *    that unranks a Practice run**, and it unranks a Speed run in exactly the same breath.
 * 3. The run did not reach a graded end → unranked, still shown (labelled).
 * 4. Migrated from the v1 history → stats yes, personal best no: the PB books are authoritative and
 *    are never re-derived from the 50-row window v1 kept (§9.4).
 * 5. Otherwise → everything.
 *
 * **Route purity is deliberately not decided here.** Whether a Hotkey run was pure enough to bank
 * its record is a route question, and route evaluation stays strictly separate from run
 * classification — `isHotkeyPersonalBestEligible` and the category registry's `requires` clause
 * answer it (Phase 7). One concern, one place.
 */
export function getRunEligibility(run: RunEligibilityInput): RunEligibility {
  if (run.integrity === "suspect") {
    return NOTHING_COUNTS;
  }

  if (run.assist === "revealed") {
    return UNRANKED_BUT_SHOWN;
  }

  if (run.outcome !== "completed") {
    return UNRANKED_BUT_SHOWN;
  }

  if (run.schemaVersion === 1) {
    return {
      countsForPersonalBest: false,
      countsForPerformanceStats: true,
      countsForLeaderboard: false,
      countsForRecentRuns: true,
      countsForPracticeActivity: true,
    };
  }

  return EVERYTHING_COUNTS;
}

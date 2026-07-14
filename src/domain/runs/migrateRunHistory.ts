import { challenges } from "@/data/challenges";
import type { SkillFamily } from "@/domain/mastery/masteryTypes";
import {
  readProfile,
  type ProfileModeStats,
  type RunHistoryEntry,
} from "@/domain/profile/runHistory";
import { skillFamilyOf, type RunRecord } from "@/domain/runs/runRecord";
import { categoryIdForMode } from "@/domain/stats/categories";
import type { JsonStorage } from "@/lib/storage";

export type MigratedLog = {
  runs: RunRecord[];
  priorTotals: { runs: number; tasksCompleted: number };
  /** v1's per-mode bests, minus what the imported rows already carry. See `priorFor` below. */
  priorByMode: Record<string, ProfileModeStats>;
};

/**
 * The v1 history stored no family, so the only handle on one is the run's label — which was the
 * challenge's title. `ProfilePanel` has been doing this lookup at render time since it shipped
 * (`ProfilePanel.tsx:31`); **this is that hack's last use.** Records written from here on carry
 * `family` outright, and the map dies with the migration.
 */
const FAMILY_BY_TITLE = new Map<string, SkillFamily>(
  challenges.map((challenge) => [challenge.title, skillFamilyOf(challenge.family)]),
);

/**
 * A session's label is its mode name, never a challenge title, so it misses the map — and should:
 * a session draws across families by design. A classic whose title has since changed misses it too,
 * and lands on the same honest null.
 */
function familyFor(entry: RunHistoryEntry): SkillFamily | null {
  return FAMILY_BY_TITLE.get(entry.label) ?? null;
}

function recordFor(entry: RunHistoryEntry): RunRecord | null {
  const atMs = Date.parse(entry.at);

  // A row whose timestamp will not parse cannot be sorted, bucketed, or plotted. Dropped, not
  // repaired: there is no honest moment to substitute for one the storage lost.
  if (Number.isNaN(atMs)) {
    return null;
  }

  return {
    schemaVersion: 1,
    id: entry.id,
    atMs,
    at: entry.at,

    modeKey: entry.modeKey,
    categoryId: categoryIdForMode(entry.modeKey),
    label: entry.label,
    // v1 stored none of these. Null is the truth; a guess would be worse than a gap.
    challengeId: null,
    challengeVersion: null,
    templateId: null,
    family: familyFor(entry),
    difficulty: null,
    seed: null,

    outcome: entry.completed ? "completed" : "failed",
    completed: entry.completed,
    tasksCompleted: entry.tasksCompleted,
    // v1 never stored the planned length. For a single run it is 1; for a session, the best
    // available answer is what the player actually finished.
    taskCount: Math.max(entry.tasksCompleted, 1),

    score: entry.score,
    elapsedMs: entry.elapsedMs,
    targetMs: null,
    // v1 only knew whether a run completed. Correctness and accuracy are inferred from that and
    // from nothing else — no route data existed to infer them from.
    correctness: entry.completed ? 1 : 0,
    accuracy: entry.completed ? 1 : 0,

    actions: null,
    keyboardActions: null,
    shortcutActions: null,
    optimalActions: null,
    routeEfficiency: null,
    keyboardShare: null,
    routeId: null,

    // Not a default, a fact (§9.3): the help button did not exist when these runs were played, so
    // no code path could have revealed a hint during one. No legacy run can have been assisted.
    assist: "none",
    integrity: "ok",
    isNewRecord: entry.isNewRecord,
    attempts: 0,
    eventDigest: null,
  };
}

/**
 * `run-history:v1` → the run log. Runs once, from `runLog.read()`, when the log key is absent and a
 * v1 profile is present. **The v1 key is left on disk, untouched** — it *is* the backup, and it is
 * removed only in Phase 10, one release after the log has shipped and worked (§9.5).
 *
 * Nothing here writes to the personal-record or session-record books. They are already correct, and
 * re-deriving a personal best from the 50-row window v1 kept would be strictly worse than what is
 * banked (§9.4) — which is exactly what `schemaVersion: 1` → `countsForPersonalBest: false` encodes.
 */
export function migrateRunHistory(storage: JsonStorage): MigratedLog {
  const profile = readProfile(storage);
  // v1 stored newest first. The log is chronological, oldest first: appending is O(1), and every
  // view reverses or filters.
  const runs = profile.entries
    .map(recordFor)
    .filter((record): record is RunRecord => record !== null)
    .reverse();

  // v1's `byMode` outlived its own entry list by design: a best score set by a run the 50-cap later
  // destroyed still stood, because the aggregate was folded in before the row fell off
  // (`runHistory.ts:45`). Rebuilding the table from the imported rows alone would therefore *take a
  // record away from the player*. Carry the aggregates forward instead — with the run counts
  // reduced by the rows now in the log, so nothing is counted twice, exactly as `priorTotals` does.
  const importedByMode = new Map<string, number>();

  for (const run of runs) {
    importedByMode.set(run.modeKey, (importedByMode.get(run.modeKey) ?? 0) + 1);
  }

  const priorByMode: Record<string, ProfileModeStats> = {};

  for (const [modeKey, stats] of Object.entries(profile.byMode)) {
    priorByMode[modeKey] = {
      ...stats,
      runs: Math.max(0, stats.runs - (importedByMode.get(modeKey) ?? 0)),
    };
  }

  // The same reasoning for the lifetime totals: v1 counted every run ever played, including the
  // rows its cap destroyed. Keeping the difference stops the totals shrinking on upgrade.
  return {
    runs,
    priorTotals: {
      runs: Math.max(0, profile.totalRuns - runs.length),
      tasksCompleted: Math.max(
        0,
        profile.totalTasksCompleted - runs.reduce((sum, run) => sum + run.tasksCompleted, 0),
      ),
    },
    priorByMode,
  };
}

import type { ProfileModeStats } from "@/domain/profile/runHistory";
import { migrateRunHistory } from "@/domain/runs/migrateRunHistory";
import { getRunEligibility } from "@/domain/runs/runEligibility";
import {
  isRunRecord,
  RECENT_RUNS_LIMIT,
  RUN_LOG_KEY,
  type RunRecord,
} from "@/domain/runs/runRecord";
import {
  PERFORMANCE_CATEGORIES,
  type PerformanceCategoryId,
} from "@/domain/stats/categories";
import type { JsonStorage } from "@/lib/storage";

/** Runs older than `RUN_LOG_LIMIT`, folded into daily buckets. Built in Phase 10 (§9.7). */
export type RunRollup = {
  /** Local day, `YYYY-MM-DD`. */
  day: string;
  categoryId: PerformanceCategoryId | null;
  runs: number;
  tasksCompleted: number;
  meanScore: number;
  bestScore: number;
};

export type RunLog = {
  version: 2;
  /** Runs the v1 50-cap destroyed before this feature existed. Keeps the lifetime totals honest. */
  priorTotals: { runs: number; tasksCompleted: number };
  /**
   * The per-mode bests v1 folded into storage as it went, minus what the imported rows already
   * carry. Without this, a best score set by a run the 50-cap destroyed would vanish on upgrade:
   * v1's `byMode` outlived its own entry list by design (`runHistory.ts:45`), and the log has to
   * honour that or the migration would quietly take a record away from the player.
   */
  priorByMode: Record<string, ProfileModeStats>;
  /** Runs folded into daily buckets past the limit. Empty until Phase 10. */
  rollups: RunRollup[];
  /** Chronological, oldest first. Appending is O(1); every view filters or reverses. */
  runs: RunRecord[];
};

export function emptyLog(): RunLog {
  return {
    version: 2,
    priorTotals: { runs: 0, tasksCompleted: 0 },
    priorByMode: {},
    rollups: [],
    runs: [],
  };
}

function isModeStats(value: unknown): value is ProfileModeStats {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<ProfileModeStats>;

  return (
    typeof candidate.bestScore === "number" &&
    (candidate.bestElapsedMs === null || typeof candidate.bestElapsedMs === "number") &&
    typeof candidate.runs === "number"
  );
}

function isRollup(value: unknown): value is RunRollup {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<RunRollup>;

  return (
    typeof candidate.day === "string" &&
    (candidate.categoryId === null || typeof candidate.categoryId === "string") &&
    typeof candidate.runs === "number" &&
    typeof candidate.tasksCompleted === "number" &&
    typeof candidate.meanScore === "number" &&
    typeof candidate.bestScore === "number"
  );
}

/**
 * Untrusted, as always. A malformed row is dropped; a malformed blob yields an empty log; a storage
 * that throws yields an empty log (`storage.ts` swallows that already). The game never crashes over
 * history.
 *
 * **The presence of the log key is itself the "already migrated" flag** — there is no separate
 * marker to fall out of sync with it. When the key is absent, the v1 history is read and converted
 * once; the v1 key is left on disk untouched, as the backup (§9.5).
 */
export function readRunLog(storage: JsonStorage): RunLog {
  const raw = storage.read<unknown>(RUN_LOG_KEY, null);

  if (raw === null) {
    const migrated = migrateRunHistory(storage);

    return {
      version: 2,
      priorTotals: migrated.priorTotals,
      priorByMode: migrated.priorByMode,
      rollups: [],
      runs: migrated.runs,
    };
  }

  if (typeof raw !== "object") {
    return emptyLog();
  }

  const candidate = raw as Partial<RunLog>;
  const priorTotals = candidate.priorTotals;
  const priorByMode: Record<string, ProfileModeStats> = {};

  if (typeof candidate.priorByMode === "object" && candidate.priorByMode !== null) {
    for (const [modeKey, stats] of Object.entries(candidate.priorByMode)) {
      if (isModeStats(stats)) {
        priorByMode[modeKey] = stats;
      }
    }
  }

  return {
    version: 2,
    priorTotals:
      typeof priorTotals === "object" &&
      priorTotals !== null &&
      typeof priorTotals.runs === "number" &&
      typeof priorTotals.tasksCompleted === "number"
        ? priorTotals
        : { runs: 0, tasksCompleted: 0 },
    priorByMode,
    rollups: Array.isArray(candidate.rollups) ? candidate.rollups.filter(isRollup) : [],
    runs: Array.isArray(candidate.runs) ? candidate.runs.filter(isRunRecord) : [],
  };
}

export function writeRunLog(storage: JsonStorage, log: RunLog): void {
  storage.write(RUN_LOG_KEY, log);
}

/** Chronological, so the newest run goes on the end. Trimming to `RUN_LOG_LIMIT` lands in Phase 10. */
export function appendRun(log: RunLog, record: RunRecord): RunLog {
  return { ...log, runs: [...log.runs, record] };
}

/**
 * Newest first, capped. **The limit lives here, never in a component** (§5.5): `RecentRuns` is
 * handed exactly as many records as it may show and cannot display more. A run that scrolls out of
 * the window is still in the log, and still counted by `selectTotals`.
 */
export function selectRecentRuns(log: RunLog, limit: number = RECENT_RUNS_LIMIT): RunRecord[] {
  return log.runs
    .filter((run) => getRunEligibility(run).countsForRecentRuns)
    .slice(-limit)
    .reverse();
}

/**
 * Chronological, filtered to one category and to what the policy says may shape a statistic.
 *
 * A category may demand more than the policy does, and Hotkey does: `requires.keyboardPure` keeps a
 * run that reached for the mouse off the Hotkey chart. That run is still a run — it still played,
 * still scored, and still appears in Recent Runs. It simply is not evidence about keyboard speed,
 * which is the only thing that chart claims to be about.
 */
export function selectEligibleForStats(log: RunLog, categoryId: PerformanceCategoryId): RunRecord[] {
  const category = PERFORMANCE_CATEGORIES.find((candidate) => candidate.id === categoryId);
  const demandsPurity = category?.requires?.keyboardPure === true;

  return log.runs.filter((run) => {
    if (run.categoryId !== categoryId || !getRunEligibility(run).countsForPerformanceStats) {
      return false;
    }

    // A run recorded before the route fields existed cannot prove it was pure, and an unproven
    // claim is not a claim. It stays off the chart rather than being given the benefit of the doubt.
    return !demandsPurity || run.keyboardShare === 1;
  });
}

/**
 * Lifetime totals: what the log holds, plus what was folded into rollups, plus what v1's 50-cap
 * destroyed before any of this existed. Nothing is counted twice, and nothing earned is lost.
 *
 * Deliberately **not** filtered by eligibility: "how much have I played" is a different question
 * from "what counts for a record", and an assisted or abandoned run is still a run the player did.
 */
export function selectTotals(log: RunLog): { runs: number; tasksCompleted: number } {
  const rollups = log.rollups.reduce(
    (sum, rollup) => ({
      runs: sum.runs + rollup.runs,
      tasksCompleted: sum.tasksCompleted + rollup.tasksCompleted,
    }),
    { runs: 0, tasksCompleted: 0 },
  );

  return {
    runs: log.priorTotals.runs + rollups.runs + log.runs.length,
    tasksCompleted:
      log.priorTotals.tasksCompleted +
      rollups.tasksCompleted +
      log.runs.reduce((sum, run) => sum + run.tasksCompleted, 0),
  };
}

/**
 * The profile's "bests by mode" table: the bests carried forward from v1 (set by runs its 50-cap
 * destroyed, and unrecoverable from the rows that survived), with every run in the log folded on
 * top. Same shape and same rule as v1: an abandoned run cannot hold the time record.
 *
 * The counts do not double: `priorByMode[mode].runs` is v1's lifetime count *minus* the rows the
 * migration imported, exactly as `priorTotals` is (§9.5, and `migrateRunHistory`).
 */
export function selectByMode(log: RunLog): Record<string, ProfileModeStats> {
  const byMode: Record<string, ProfileModeStats> = { ...log.priorByMode };

  for (const run of log.runs) {
    const existing = byMode[run.modeKey] ?? { bestScore: 0, bestElapsedMs: null, runs: 0 };
    const bestElapsedMs = run.completed
      ? existing.bestElapsedMs === null
        ? run.elapsedMs
        : Math.min(existing.bestElapsedMs, run.elapsedMs)
      : existing.bestElapsedMs;

    byMode[run.modeKey] = {
      bestScore: Math.max(existing.bestScore, run.score),
      bestElapsedMs,
      runs: existing.runs + 1,
    };
  }

  return byMode;
}

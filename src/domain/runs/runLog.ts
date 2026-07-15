import type { ProfileModeStats } from "@/domain/profile/runHistory";
import { migrateRunHistory } from "@/domain/runs/migrateRunHistory";
import { getRunEligibility } from "@/domain/runs/runEligibility";
import {
  isRunRecord,
  RECENT_RUNS_LIMIT,
  RUN_LOG_KEY,
  RUN_LOG_LIMIT,
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

/**
 * Rows written before these fields existed lack the keys; reading fills null, no migration.
 *
 * Spelled as three `?? null` fallbacks rather than `{ peakTier: null, ..., ...record }`: `RunRecord`
 * declares all three as always-present, so a default-then-spread reads to the type checker as
 * always overwritten (TS2783) even though a pre-existing row on disk can genuinely lack the key.
 * Same fill, expressed so it survives contact with `record`'s own declared type.
 */
export function normalizeRunRecord(record: RunRecord): RunRecord {
  return {
    ...record,
    peakTier: record.peakTier ?? null,
    wpm: record.wpm ?? null,
    keystrokeAccuracy: record.keystrokeAccuracy ?? null,
  };
}

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
    runs: Array.isArray(candidate.runs)
      ? candidate.runs.filter(isRunRecord).map(normalizeRunRecord)
      : [],
  };
}

export function writeRunLog(storage: JsonStorage, log: RunLog): void {
  try {
    storage.write(RUN_LOG_KEY, log);
  } catch {
    // A full quota is not an exceptional circumstance, it is a Tuesday — and the run has already
    // been played. Losing the record of it is bad; taking the page down and losing the *game* is
    // worse. The write is best-effort, and the player keeps playing.
    //
    // Nothing is logged and nothing is shown: there is no action a player could take, and a toast
    // that says "your storage is full" during a timed run is a worse outcome than a missing row.
  }
}

/** The local day a run happened on, which is the unit both the rollups and the chart think in. */
function localDay(atMs: number): string {
  const date = new Date(atMs);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Folds the oldest runs into daily buckets once the log passes `RUN_LOG_LIMIT` (§9.7).
 *
 * **A personal-best run is never folded.** It is kept verbatim, however old, because it is the one
 * row a player might go looking for — and a record that has quietly become a number in an aggregate
 * is a record they will believe was taken from them. Everything else about that day survives as a
 * count, a mean, and a best, so the totals and the trends still add up to the same numbers they did
 * the day before the fold.
 *
 * The budget is therefore spent on *ordinary* runs: records are set aside first, and the oldest
 * ordinary runs are folded until what remains fits. The first version of this took the oldest
 * `excess` rows and put the records among them back at the front — which meant those records sat
 * inside the very window the next fold re-examined, were preserved again, and were never consumed.
 * The log settled at the limit *plus every record ever earned*, growing for as long as the player
 * kept improving. Nothing was lost, but the cap was not a cap, and the write that eventually
 * overflows the storage quota is one this module deliberately swallows.
 *
 * So the bound is honest but conditional: `RUN_LOG_LIMIT` rows, unless the player holds more records
 * than that, in which case the records win and the log is exactly their records. That is the right
 * way round — a cap may cost a player their history, but it may not cost them their bests.
 *
 * This is the only code in the system that removes a run row. It is written so that nothing a player
 * earned can be lost by it, and the tests count the totals on both sides of the fold to prove it.
 */
function foldOldest(log: RunLog): RunLog {
  const records = log.runs.reduce((count, run) => (run.isNewRecord ? count + 1 : count), 0);
  const ordinaryBudget = Math.max(0, RUN_LOG_LIMIT - records);
  let toFold = Math.max(0, log.runs.length - records - ordinaryBudget);

  if (toFold === 0) {
    return log;
  }

  const foldable: RunRecord[] = [];
  const kept: RunRecord[] = [];

  // One pass, oldest first, so `kept` stays in the chronological order the rest of the module reads
  // it in. A record is never a candidate, however old it is.
  for (const run of log.runs) {
    if (!run.isNewRecord && toFold > 0) {
      foldable.push(run);
      toFold -= 1;
      continue;
    }

    kept.push(run);
  }

  const byDay = new Map<string, RunRollup>();

  for (const rollup of log.rollups) {
    byDay.set(`${rollup.day}:${rollup.categoryId}`, { ...rollup });
  }

  for (const run of foldable) {
    const key = `${localDay(run.atMs)}:${run.categoryId}`;
    const existing = byDay.get(key);

    if (existing === undefined) {
      byDay.set(key, {
        day: localDay(run.atMs),
        categoryId: run.categoryId,
        runs: 1,
        tasksCompleted: run.tasksCompleted,
        meanScore: run.score,
        bestScore: run.score,
      });
      continue;
    }

    // The mean is recomputed from the running total rather than averaged with itself, which would
    // weight the newest run as heavily as every run before it put together.
    const total = existing.meanScore * existing.runs + run.score;

    existing.runs += 1;
    existing.tasksCompleted += run.tasksCompleted;
    existing.meanScore = total / existing.runs;
    existing.bestScore = Math.max(existing.bestScore, run.score);
  }

  return {
    ...log,
    rollups: [...byDay.values()].sort((left, right) => left.day.localeCompare(right.day)),
    runs: kept,
  };
}

/** Chronological, so the newest run goes on the end. Past the limit, the oldest are folded away. */
export function appendRun(log: RunLog, record: RunRecord): RunLog {
  return foldOldest({ ...log, runs: [...log.runs, record] });
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

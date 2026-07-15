import type { JsonStorage } from "@/lib/storage";

export const ASCENT_RECORDS_KEY = "excel-speed-trainer:v1:ascent-records";

export type AscentRecord = {
  durationSeconds: number;
  bestScore: number;
  /** The peak tier of the best-scoring run — not necessarily the highest peak ever. */
  peakTierAtBest: number;
  bestTasksCompleted: number;
  /** Independent high-water mark: the highest tier any run ever reached. */
  bestPeakTier: number;
  /** ISO 8601. */
  achievedAt: string;
};

/** Keyed by `ascent:${durationSeconds}`, so a future duration picker never mixes races. */
export type AscentRecordStore = Record<string, AscentRecord>;

export function ascentRecordKey(durationSeconds: number): string {
  return `ascent:${durationSeconds}`;
}

/**
 * Score decides the record (it already carries the tier weighting); ties break toward more
 * tasks, then the incumbent. `bestPeakTier` merges independently — a wild low-scoring run that
 * touched tier 5 keeps that peak forever, exactly like a PB run surviving the log fold.
 */
export function updateAscentRecords(
  store: AscentRecordStore,
  candidate: AscentRecord,
): AscentRecordStore {
  const key = ascentRecordKey(candidate.durationSeconds);
  const existing = store[key];

  if (existing === undefined) {
    return { ...store, [key]: candidate };
  }

  const winner =
    candidate.bestScore !== existing.bestScore
      ? candidate.bestScore > existing.bestScore
        ? candidate
        : existing
      : candidate.bestTasksCompleted > existing.bestTasksCompleted
        ? candidate
        : existing;

  return {
    ...store,
    [key]: { ...winner, bestPeakTier: Math.max(existing.bestPeakTier, candidate.bestPeakTier) },
  };
}

/**
 * `updateAscentRecords` always returns a freshly spread record past the first insert (the
 * independent `bestPeakTier` merge guarantees it), so the object identity trick
 * `currentBest === candidate` that `useLocalSessionRecords` uses can never fire again after a
 * duration's first run. This mirrors the same score-then-tasks tie-break on the two fields that
 * actually define "the record," so a submitter can tell whether its own run was the winner without
 * relying on reference equality. A peak-tier bump alone (candidate loses on score) is deliberately
 * not a new record — `bestPeakTier` is a high-water mark, not the record itself.
 */
export function isNewAscentRecord(
  previousBest: AscentRecord | undefined,
  candidate: AscentRecord,
): boolean {
  if (previousBest === undefined) {
    return true;
  }

  if (candidate.bestScore !== previousBest.bestScore) {
    return candidate.bestScore > previousBest.bestScore;
  }

  return candidate.bestTasksCompleted > previousBest.bestTasksCompleted;
}

function isAscentRecord(value: unknown): value is AscentRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<AscentRecord>;

  return (
    typeof candidate.durationSeconds === "number" &&
    typeof candidate.bestScore === "number" &&
    typeof candidate.peakTierAtBest === "number" &&
    typeof candidate.bestTasksCompleted === "number" &&
    typeof candidate.bestPeakTier === "number" &&
    typeof candidate.achievedAt === "string"
  );
}

/** Untrusted, like everything read back from the browser: entries that do not parse are dropped. */
export function readAscentRecords(storage: JsonStorage): AscentRecordStore {
  const raw = storage.read<unknown>(ASCENT_RECORDS_KEY, {});

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {};
  }

  const store: AscentRecordStore = {};

  for (const value of Object.values(raw)) {
    if (isAscentRecord(value)) {
      store[ascentRecordKey(value.durationSeconds)] = value;
    }
  }

  return store;
}

export function writeAscentRecords(storage: JsonStorage, store: AscentRecordStore): void {
  storage.write(ASCENT_RECORDS_KEY, store);
}

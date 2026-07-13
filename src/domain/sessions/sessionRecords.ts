import {
  SESSION_MODES,
  type SessionMode,
  type SessionResult,
} from "@/domain/sessions/sessionTypes";
import type { JsonStorage } from "@/lib/storage";

export const SESSION_RECORDS_KEY = "excel-speed-trainer:v1:session-records";

export type SessionRecord = {
  mode: SessionMode;
  bestScore: number;
  bestElapsedMs: number;
  bestTasksCompleted: number;
  /** ISO 8601. */
  achievedAt: string;
};

/** Keyed by mode, so Sprint 5 and Sprint 10 can never share a record. */
export type SessionRecordStore = Partial<Record<SessionMode, SessionRecord>>;

/**
 * Higher score wins. Ties break toward more tasks completed, then toward the faster total time,
 * then toward the incumbent, so an identical replay does not churn the achievedAt stamp.
 */
export function betterSessionRecord(
  existing: SessionRecord | undefined,
  candidate: SessionRecord,
): SessionRecord {
  if (existing === undefined) {
    return candidate;
  }

  if (candidate.bestScore !== existing.bestScore) {
    return candidate.bestScore > existing.bestScore ? candidate : existing;
  }

  if (candidate.bestTasksCompleted !== existing.bestTasksCompleted) {
    return candidate.bestTasksCompleted > existing.bestTasksCompleted ? candidate : existing;
  }

  if (candidate.bestElapsedMs !== existing.bestElapsedMs) {
    return candidate.bestElapsedMs < existing.bestElapsedMs ? candidate : existing;
  }

  return existing;
}

export function sessionRecordFromResult(result: SessionResult): SessionRecord {
  return {
    mode: result.mode,
    bestScore: result.totalScore,
    bestElapsedMs: result.totalElapsedMs,
    bestTasksCompleted: result.tasksCompleted,
    achievedAt: result.finishedAt,
  };
}

export function updateSessionRecords(
  store: SessionRecordStore,
  candidate: SessionRecord,
): SessionRecordStore {
  return { ...store, [candidate.mode]: betterSessionRecord(store[candidate.mode], candidate) };
}

function isSessionRecord(value: unknown): value is SessionRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<SessionRecord>;

  return (
    typeof candidate.mode === "string" &&
    (SESSION_MODES as string[]).includes(candidate.mode) &&
    typeof candidate.bestScore === "number" &&
    typeof candidate.bestElapsedMs === "number" &&
    typeof candidate.bestTasksCompleted === "number" &&
    typeof candidate.achievedAt === "string"
  );
}

/** Untrusted, like everything read back from the browser: entries that do not parse are dropped. */
export function readSessionRecords(storage: JsonStorage): SessionRecordStore {
  const raw = storage.read<unknown>(SESSION_RECORDS_KEY, {});

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {};
  }

  const store: SessionRecordStore = {};

  for (const value of Object.values(raw)) {
    if (isSessionRecord(value)) {
      store[value.mode] = value;
    }
  }

  return store;
}

export function writeSessionRecords(storage: JsonStorage, store: SessionRecordStore): void {
  storage.write(SESSION_RECORDS_KEY, store);
}

import type { ChallengeDifficulty } from "@/domain/challenges/challengeTypes";
import {
  SESSION_MODES,
  type SessionMode,
  type SessionResult,
} from "@/domain/sessions/sessionTypes";
import type { JsonStorage } from "@/lib/storage";

/**
 * v2: seeded queues replaced deterministic list slices, so v1 session records measure a different
 * game and are deliberately left behind under the old key. Per-challenge records are untouched.
 */
export const SESSION_RECORDS_KEY = "excel-speed-trainer:v2:session-records";

export type SessionRecord = {
  mode: SessionMode;
  difficulty: ChallengeDifficulty;
  bestScore: number;
  bestElapsedMs: number;
  bestTasksCompleted: number;
  /** ISO 8601. */
  achievedAt: string;
};

/** Sprint 5 at difficulty 2 and Sprint 5 at difficulty 3 are different races. */
export function sessionRecordKey(mode: SessionMode, difficulty: ChallengeDifficulty): string {
  return `${mode}:d${difficulty}`;
}

/** Keyed by `sessionRecordKey`, so lengths and difficulties never share a record. */
export type SessionRecordStore = Record<string, SessionRecord>;

/**
 * Higher score wins. Ties break toward more tasks completed, then toward the faster total time,
 * then toward the incumbent, so an identical replay does not churn the achievedAt stamp.
 *
 * Score, never elapsed time: scoring normalises each task against its own target, which is what
 * makes records comparable across seeded draws. A session time record would be a queue lottery.
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

export function sessionRecordFromResult(
  result: SessionResult,
  difficulty: ChallengeDifficulty,
): SessionRecord {
  return {
    mode: result.mode,
    difficulty,
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
  const key = sessionRecordKey(candidate.mode, candidate.difficulty);

  return { ...store, [key]: betterSessionRecord(store[key], candidate) };
}

function isSessionRecord(value: unknown): value is SessionRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<SessionRecord>;

  return (
    typeof candidate.mode === "string" &&
    (SESSION_MODES as string[]).includes(candidate.mode) &&
    typeof candidate.difficulty === "number" &&
    [1, 2, 3, 4, 5].includes(candidate.difficulty) &&
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
      store[sessionRecordKey(value.mode, value.difficulty)] = value;
    }
  }

  return store;
}

export function writeSessionRecords(storage: JsonStorage, store: SessionRecordStore): void {
  storage.write(SESSION_RECORDS_KEY, store);
}

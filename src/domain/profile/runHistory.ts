import type { JsonStorage } from "@/lib/storage";

export const RUN_HISTORY_KEY = "excel-speed-trainer:v1:run-history";

/** Entries beyond this fall off the list. The totals and per-mode bests keep counting anyway. */
export const HISTORY_LIMIT = 50;

export type RunHistoryEntry = {
  id: string;
  /** ISO 8601. */
  at: string;
  /** What was being played: "main-speed", "practice", or a session mode. Groups the stats. */
  modeKey: string;
  /** What the player would call it: a challenge title or a session label. */
  label: string;
  score: number;
  elapsedMs: number;
  /** A single run is complete by definition when it lands here; a sprint only when nothing was skipped. */
  completed: boolean;
  /** Challenges finished inside this run: 1 for a single, up to N for a session. */
  tasksCompleted: number;
  isNewRecord: boolean;
};

export type ProfileModeStats = {
  bestScore: number;
  /** The fastest fully completed run. An abandoned run cannot hold the time record. */
  bestElapsedMs: number | null;
  runs: number;
};

export type ProfileState = {
  /** Newest first, capped at HISTORY_LIMIT. */
  entries: RunHistoryEntry[];
  totalRuns: number;
  totalTasksCompleted: number;
  byMode: Record<string, ProfileModeStats>;
};

export function emptyProfile(): ProfileState {
  return { entries: [], totalRuns: 0, totalTasksCompleted: 0, byMode: {} };
}

/**
 * Pure fold of one finished run into the profile. The entry list is capped, but the totals and
 * per-mode bests are updated first, so nothing the player has earned is lost when old rows fall
 * off the end.
 */
export function recordRun(profile: ProfileState, entry: RunHistoryEntry): ProfileState {
  const existing = profile.byMode[entry.modeKey] ?? {
    bestScore: 0,
    bestElapsedMs: null,
    runs: 0,
  };

  const bestElapsedMs = entry.completed
    ? existing.bestElapsedMs === null
      ? entry.elapsedMs
      : Math.min(existing.bestElapsedMs, entry.elapsedMs)
    : existing.bestElapsedMs;

  return {
    entries: [entry, ...profile.entries].slice(0, HISTORY_LIMIT),
    totalRuns: profile.totalRuns + 1,
    totalTasksCompleted: profile.totalTasksCompleted + entry.tasksCompleted,
    byMode: {
      ...profile.byMode,
      [entry.modeKey]: {
        bestScore: Math.max(existing.bestScore, entry.score),
        bestElapsedMs,
        runs: existing.runs + 1,
      },
    },
  };
}

function isEntry(value: unknown): value is RunHistoryEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<RunHistoryEntry>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.at === "string" &&
    typeof candidate.modeKey === "string" &&
    typeof candidate.label === "string" &&
    typeof candidate.score === "number" &&
    typeof candidate.elapsedMs === "number" &&
    typeof candidate.completed === "boolean" &&
    typeof candidate.tasksCompleted === "number" &&
    typeof candidate.isNewRecord === "boolean"
  );
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

/** Untrusted, as always: broken entries are dropped, broken totals fall back to zero. */
export function readProfile(storage: JsonStorage): ProfileState {
  const raw = storage.read<unknown>(RUN_HISTORY_KEY, null);

  if (typeof raw !== "object" || raw === null) {
    return emptyProfile();
  }

  const candidate = raw as Partial<ProfileState>;
  const entries = Array.isArray(candidate.entries)
    ? candidate.entries.filter(isEntry).slice(0, HISTORY_LIMIT)
    : [];

  const byMode: Record<string, ProfileModeStats> = {};

  if (typeof candidate.byMode === "object" && candidate.byMode !== null) {
    for (const [key, value] of Object.entries(candidate.byMode)) {
      if (isModeStats(value)) {
        byMode[key] = value;
      }
    }
  }

  return {
    entries,
    totalRuns: typeof candidate.totalRuns === "number" ? candidate.totalRuns : 0,
    totalTasksCompleted:
      typeof candidate.totalTasksCompleted === "number" ? candidate.totalTasksCompleted : 0,
    byMode,
  };
}

export function writeProfile(storage: JsonStorage, profile: ProfileState): void {
  storage.write(RUN_HISTORY_KEY, profile);
}

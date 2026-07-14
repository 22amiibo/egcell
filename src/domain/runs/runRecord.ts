import type {
  Challenge,
  ChallengeDifficulty,
  ChallengeMode,
} from "@/domain/challenges/challengeTypes";
import type { SkillFamily } from "@/domain/mastery/masteryTypes";
import type { RouteComparison } from "@/domain/routes/compareRoute";
import {
  SESSION_PLANS,
  sessionModeLabel,
  type SessionMode,
  type SessionResult,
} from "@/domain/sessions/sessionTypes";
import { categoryIdForMode, type PerformanceCategoryId } from "@/domain/stats/categories";

export const RUN_LOG_KEY = "excel-speed-trainer:v1:run-log";

/** 1 = migrated from `run-history:v1`; 2 = written by this version. Eligibility reads it (§5.6). */
export const RUN_RECORD_VERSION = 2;

/** The Recent Runs display window. Enforced in the selector, never in a component (§5.5). */
export const RECENT_RUNS_LIMIT = 20;

/** Storage guard. Beyond this the oldest runs fold into daily rollups — built in Phase 10 (§9.7). */
export const RUN_LOG_LIMIT = 5_000;

export type RunAssist = "none" | "revealed";

/**
 * Did the run reach its natural end and get graded? Not the same question as `completed`, which
 * asks whether every task in it was finished — a skipped-through sprint is `outcome: "completed"`,
 * `completed: false`, and belongs on the graph (§1a.11). Nothing writes "failed" or "expired" until
 * Phase 6/7 logs its first abandoned run; the field exists now so the schema never has to change.
 */
export type RunOutcome = "completed" | "failed" | "expired";

export type RunIntegrity = "ok" | "suspect";

export type RunRecord = {
  schemaVersion: 1 | 2;
  id: string;
  /** Epoch milliseconds — sorting, bucketing, arithmetic. */
  atMs: number;
  /** ISO 8601 — display only. */
  at: string;

  /** "main-speed" | "practice" | "hotkey" | a SessionMode. Stringly typed: the log outlives modes. */
  modeKey: string;
  /** Denormalised at write time. Null for a mode no category claims — kept, never guessed (§9.2). */
  categoryId: PerformanceCategoryId | null;
  label: string;
  challengeId: string | null;
  challengeVersion: string | null;
  templateId: string | null;
  /** Retires ProfilePanel's title-lookup hack. Null for sessions, which are cross-family by design. */
  family: SkillFamily | null;
  difficulty: ChallengeDifficulty | null;
  seed: string | null;

  outcome: RunOutcome;
  completed: boolean;
  tasksCompleted: number;
  taskCount: number;

  score: number;
  elapsedMs: number;
  /** Enables the pace index. Null for sessions (no single target) and for legacy records. */
  targetMs: number | null;
  correctness: number;
  accuracy: number;

  // Route fields. Null until Phase 5 computes them; the schema holds their shape now.
  actions: number | null;
  keyboardActions: number | null;
  shortcutActions: number | null;
  optimalActions: number | null;
  routeEfficiency: number | null;
  keyboardShare: number | null;
  routeId: string | null;

  assist: RunAssist;
  integrity: RunIntegrity;
  isNewRecord: boolean;
  /** Retries before this completion, within one mount. */
  attempts: number;
  eventDigest: string | null;
};

/**
 * Everything a caller supplies. The store stamps the rest: `id`, `at`/`atMs` (the moment of
 * recording), `schemaVersion`, and `categoryId` (derived from `modeKey`, never passed in).
 */
export type NewRunRecord = Omit<RunRecord, "id" | "at" | "atMs" | "schemaVersion" | "categoryId">;

/** `ChallengeFamily` and `SkillFamily` differ by one name. One mapping, in one place. */
export function skillFamilyOf(family: Challenge["family"]): SkillFamily {
  switch (family) {
    case "navigation":
    case "selection":
    case "formatting":
    case "sort-filter":
      return family;
    case "formula":
      return "formulas";
    case "mixed":
      return "mixed";
  }
}

/** The route fields when there is nothing to say: a session, or a run recorded without a comparison. */
const NO_ROUTE = {
  actions: null,
  keyboardActions: null,
  shortcutActions: null,
  optimalActions: null,
  routeEfficiency: null,
  keyboardShare: null,
  routeId: null,
} as const;

type RouteFields = Pick<
  RunRecord,
  | "actions"
  | "keyboardActions"
  | "shortcutActions"
  | "optimalActions"
  | "routeEfficiency"
  | "keyboardShare"
  | "routeId"
>;

/**
 * The route half of a record, from the comparison the result card computed.
 *
 * A `confidence: "low"` comparison writes only the counts it is sure of. `optimalActions` and
 * `routeEfficiency` are claims about *the route the player walked*, and a run whose events carry no
 * commands has no such route to speak of — a number there would put a guess in the permanent log,
 * where Phase 9's trends would later plot it as though it had been measured.
 */
export function routeFieldsFrom(comparison: RouteComparison | undefined): RouteFields {
  if (comparison === undefined) {
    return NO_ROUTE;
  }

  const known = comparison.confidence === "high";

  return {
    actions: comparison.playerActions,
    keyboardActions: comparison.keyboardActions,
    shortcutActions: comparison.shortcutActions,
    keyboardShare: comparison.keyboardShare,
    optimalActions: known ? comparison.optimalActions : null,
    routeEfficiency: known ? comparison.efficiency : null,
    routeId: comparison.matchedRouteId,
  };
}

export type ChallengeRunInput = {
  challenge: Challenge;
  mode: ChallengeMode;
  score: number;
  elapsedMs: number;
  correctness: number;
  accuracy: number;
  isComplete: boolean;
  isNewRecord: boolean;
  eventDigest: string | null;
  assist?: RunAssist;
  attempts?: number;
  /** How the run compared to the fastest route. Absent leaves every route field null (§5.4). */
  comparison?: RouteComparison;
};

/** One finished single-challenge run → one record. Keeps the mapping out of the components. */
export function runRecordForChallenge(input: ChallengeRunInput): NewRunRecord {
  const { challenge, mode, isComplete } = input;

  return {
    modeKey: mode,
    label: challenge.title,
    challengeId: challenge.id,
    challengeVersion: challenge.version,
    // A generated variant carries its template; a classic has none. Neither is an error.
    templateId: "templateId" in challenge ? (challenge.templateId as string) : null,
    family: skillFamilyOf(challenge.family),
    difficulty: challenge.difficulty,
    seed: challenge.seed,

    outcome: isComplete ? "completed" : "failed",
    completed: isComplete,
    tasksCompleted: isComplete ? 1 : 0,
    taskCount: 1,

    score: input.score,
    elapsedMs: input.elapsedMs,
    targetMs: challenge.scoring.targetSeconds * 1000,
    correctness: input.correctness,
    accuracy: input.accuracy,

    ...routeFieldsFrom(input.comparison),

    assist: input.assist ?? "none",
    integrity: "ok",
    isNewRecord: input.isNewRecord,
    attempts: input.attempts ?? 0,
    eventDigest: input.eventDigest,
  };
}

export type SessionRunInput = {
  mode: SessionMode;
  result: SessionResult;
  isNewRecord: boolean;
  assist?: RunAssist;
};

/**
 * One finished session → one record. A session always reaches its natural end — a sprint the player
 * skipped through, and a timed run whose clock expired, both finished normally — so `outcome` is
 * always "completed", and `completed` alone carries "was every task done" (§1a.11).
 *
 * `completed` keeps the exact meaning v1 gave it, per session kind: a sprint is complete when
 * nothing was skipped, and a timed run is complete by having run its full course — the clock
 * expiring mid-task is how a timed run *ends*, not a way for it to fail.
 */
export function runRecordForSession(input: SessionRunInput): NewRunRecord {
  const { mode, result } = input;
  const completed =
    SESSION_PLANS[mode].kind === "task-count"
      ? result.tasksCompleted === result.taskCount
      : true;

  return {
    modeKey: mode,
    label: sessionModeLabel(mode),
    challengeId: null,
    challengeVersion: null,
    templateId: null,
    // A session draws across families by design; claiming one would be a guess.
    family: null,
    difficulty: null,
    seed: null,

    outcome: "completed",
    completed,
    tasksCompleted: result.tasksCompleted,
    taskCount: result.taskCount,

    score: result.totalScore,
    elapsedMs: result.totalElapsedMs,
    // No single target time exists for a session, so it has no pace index. Excluded, not faked.
    targetMs: null,
    correctness: result.completionPercent,
    accuracy: result.accuracy,

    ...NO_ROUTE,

    assist: input.assist ?? "none",
    integrity: "ok",
    isNewRecord: input.isNewRecord,
    attempts: 0,
    eventDigest: null,
  };
}

function isNullableNumber(value: unknown): boolean {
  return value === null || typeof value === "number";
}

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === "string";
}

/**
 * Untrusted, as always (`storage.ts:12`). A row that fails this is dropped, not repaired: a record
 * missing `score` has no honest value to substitute, and one bad row must not take the log with it.
 */
export function isRunRecord(value: unknown): value is RunRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<RunRecord>;

  return (
    (candidate.schemaVersion === 1 || candidate.schemaVersion === 2) &&
    typeof candidate.id === "string" &&
    typeof candidate.atMs === "number" &&
    Number.isFinite(candidate.atMs) &&
    typeof candidate.at === "string" &&
    typeof candidate.modeKey === "string" &&
    isNullableString(candidate.categoryId) &&
    typeof candidate.label === "string" &&
    isNullableString(candidate.challengeId) &&
    isNullableString(candidate.challengeVersion) &&
    isNullableString(candidate.templateId) &&
    isNullableString(candidate.family) &&
    isNullableNumber(candidate.difficulty) &&
    isNullableString(candidate.seed) &&
    (candidate.outcome === "completed" ||
      candidate.outcome === "failed" ||
      candidate.outcome === "expired") &&
    typeof candidate.completed === "boolean" &&
    typeof candidate.tasksCompleted === "number" &&
    typeof candidate.taskCount === "number" &&
    typeof candidate.score === "number" &&
    typeof candidate.elapsedMs === "number" &&
    isNullableNumber(candidate.targetMs) &&
    typeof candidate.correctness === "number" &&
    typeof candidate.accuracy === "number" &&
    isNullableNumber(candidate.actions) &&
    isNullableNumber(candidate.keyboardActions) &&
    isNullableNumber(candidate.shortcutActions) &&
    isNullableNumber(candidate.optimalActions) &&
    isNullableNumber(candidate.routeEfficiency) &&
    isNullableNumber(candidate.keyboardShare) &&
    isNullableString(candidate.routeId) &&
    (candidate.assist === "none" || candidate.assist === "revealed") &&
    (candidate.integrity === "ok" || candidate.integrity === "suspect") &&
    typeof candidate.isNewRecord === "boolean" &&
    typeof candidate.attempts === "number" &&
    isNullableString(candidate.eventDigest)
  );
}

/** Stamps the fields only the store knows: identity, the moment, the schema, and the category. */
export function stampRunRecord(entry: NewRunRecord, atMs: number, id: string): RunRecord {
  return {
    ...entry,
    schemaVersion: RUN_RECORD_VERSION,
    id,
    atMs,
    at: new Date(atMs).toISOString(),
    categoryId: categoryIdForMode(entry.modeKey),
  };
}

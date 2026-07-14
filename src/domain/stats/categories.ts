import type { RunRecord } from "@/domain/runs/runRecord";
import { SESSION_MODES, sessionModeLabel } from "@/domain/sessions/sessionTypes";

/**
 * The graph's category axis. Each id owns a disjoint set of `modeKey`s, so a run belongs to exactly
 * one category or to none — never to two. A new mode becomes a graph category by adding one entry
 * here; no component may contain a mode string, and a test asserts it.
 */
export type PerformanceCategoryId =
  | "speed"
  | "practice"
  | "hotkey"
  | "sprint-5"
  | "sprint-10"
  | "timed-30"
  | "timed-60";

export type PerformanceMetricId = "score" | "paceIndex" | "tasksCompleted" | "keyboardShare";

export type PerformanceCategory = {
  id: PerformanceCategoryId;
  label: string;
  /** The `modeKey`s in the log that belong here. Disjoint across every category. */
  modeKeys: string[];
  /** `[0]` is the default metric for this category. */
  metrics: PerformanceMetricId[];
  minimumDataPoints: number;
  /** Beyond global eligibility. Hotkey demands a pure-keyboard route; Phase 7 enforces it. */
  requires?: { keyboardPure?: boolean };
  /** Above this many points, bucket by local day before plotting. */
  aggregateAbove: number;
};

const AGGREGATE_ABOVE = 400;

/**
 * `METRICS` (§5.8 of the plan) is deliberately absent until Phase 9: its `value(run)` projections
 * read route fields that stay null until Phase 5, and nothing consumes them until the chart exists
 * (§1a.11). The registry itself ships now, because Phase 3 denormalises `categoryId` at write time.
 */
export const PERFORMANCE_CATEGORIES: PerformanceCategory[] = [
  {
    id: "speed",
    label: "Speed",
    modeKeys: ["main-speed"],
    metrics: ["score", "paceIndex", "keyboardShare"],
    minimumDataPoints: 3,
    aggregateAbove: AGGREGATE_ABOVE,
  },
  {
    id: "practice",
    label: "Practice",
    modeKeys: ["practice"],
    metrics: ["score", "paceIndex", "keyboardShare"],
    minimumDataPoints: 3,
    aggregateAbove: AGGREGATE_ABOVE,
  },
  {
    id: "hotkey",
    label: "Hotkey",
    modeKeys: ["hotkey"],
    metrics: ["score", "paceIndex", "keyboardShare"],
    minimumDataPoints: 3,
    // A Hotkey run that reached for the mouse is still a run, and still appears in Recent Runs.
    // It is this clause — not `getRunEligibility` — that keeps it off the Hotkey chart (§5.6).
    requires: { keyboardPure: true },
    aggregateAbove: AGGREGATE_ABOVE,
  },
  {
    id: "sprint-5",
    label: sessionModeLabel("sprint-5"),
    modeKeys: ["sprint-5"],
    metrics: ["score", "tasksCompleted"],
    minimumDataPoints: 3,
    aggregateAbove: AGGREGATE_ABOVE,
  },
  {
    id: "sprint-10",
    label: sessionModeLabel("sprint-10"),
    modeKeys: ["sprint-10"],
    metrics: ["score", "tasksCompleted"],
    minimumDataPoints: 3,
    aggregateAbove: AGGREGATE_ABOVE,
  },
  {
    id: "timed-30",
    label: sessionModeLabel("timed-30"),
    modeKeys: ["timed-30"],
    metrics: ["score", "tasksCompleted"],
    minimumDataPoints: 3,
    aggregateAbove: AGGREGATE_ABOVE,
  },
  {
    id: "timed-60",
    label: sessionModeLabel("timed-60"),
    modeKeys: ["timed-60"],
    metrics: ["score", "tasksCompleted"],
    minimumDataPoints: 3,
    aggregateAbove: AGGREGATE_ABOVE,
  },
];

/** Every session mode is its own category. Adding a session mode without one is a type error. */
export const SESSION_CATEGORY_IDS: PerformanceCategoryId[] = SESSION_MODES.map(
  (mode) => mode satisfies PerformanceCategoryId,
);

const CATEGORY_BY_MODE_KEY = new Map<string, PerformanceCategoryId>(
  PERFORMANCE_CATEGORIES.flatMap((category) =>
    category.modeKeys.map((modeKey) => [modeKey, category.id] as const),
  ),
);

/**
 * The category a run's `modeKey` belongs to, denormalised into the record at write time (§5.4).
 *
 * Null for a `modeKey` no category claims — a hand-edited storage blob, or a mode a later release
 * removed. Such a run is **kept in the log and shown in Recent Runs, and excluded from every
 * chart** (§9.2). Excluded, never guessed into a category it might not belong to.
 */
export function modeLabel(modeKey: string): string {
  const category = PERFORMANCE_CATEGORIES.find((candidate) =>
    candidate.modeKeys.includes(modeKey),
  );

  // A mode no category claims still has to be shown — Recent Runs shows every run there is. It is
  // shown under its raw key rather than under a guess, and it appears on no chart (§9.2).
  return category?.label ?? modeKey;
}

export function categoryIdForMode(modeKey: string): PerformanceCategoryId | null {
  return CATEGORY_BY_MODE_KEY.get(modeKey) ?? null;
}

export function performanceCategory(id: PerformanceCategoryId): PerformanceCategory {
  const category = PERFORMANCE_CATEGORIES.find((candidate) => candidate.id === id);

  if (category === undefined) {
    throw new Error(`No performance category ${id}.`);
  }

  return category;
}

export type PerformanceMetric = {
  id: PerformanceMetricId;
  label: string;
  /** What to plot for a run, or null when this run cannot answer the question. */
  value: (run: RunRecord) => number | null;
  /** How to render it on the axis and in the hidden data table. */
  format: (value: number) => string;
  /**
   * True when a smaller number is a better number, which inverts the axis. Pace index is the only
   * one today: it is elapsed time over the challenge's target, so 0.8 means "twenty percent inside
   * target" and is a result to be proud of.
   */
  lowerIsBetter?: boolean;
};

/**
 * What can be plotted (§5.8).
 *
 * Every projection may return null, and that is not a formality: `keyboardShare` is null for a run
 * recorded before the route fields existed, and `paceIndex` is meaningless for a session, which has
 * no single target to be measured against. A null is dropped from the series rather than coerced to
 * zero — a zero would draw a point on the chart, and the player would read it as a catastrophic run
 * they never had.
 */
export const METRICS: Record<PerformanceMetricId, PerformanceMetric> = {
  score: {
    id: "score",
    label: "Score",
    value: (run) => run.score,
    format: (value) => Math.round(value).toLocaleString("en-US"),
  },
  paceIndex: {
    id: "paceIndex",
    label: "Pace",
    // Elapsed over target: comparable across challenges whose targets differ, which raw seconds are
    // not. A run with no target — a session, which is many challenges under one clock — has no pace
    // to speak of, and is dropped from the series rather than being given a made-up one.
    value: (run) =>
      run.targetMs === null || run.targetMs <= 0 ? null : run.elapsedMs / run.targetMs,
    format: (value) => `${value.toFixed(2)}×`,
    lowerIsBetter: true,
  },
  tasksCompleted: {
    id: "tasksCompleted",
    label: "Tasks",
    value: (run) => run.tasksCompleted,
    format: (value) => String(Math.round(value)),
  },
  keyboardShare: {
    id: "keyboardShare",
    label: "Keyboard",
    value: (run) => run.keyboardShare,
    format: (value) => `${Math.round(value * 100)}%`,
  },
};

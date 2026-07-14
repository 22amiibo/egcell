import type { RunLog } from "@/domain/runs/runLog";
import { selectEligibleForStats } from "@/domain/runs/runLog";
import type { RunRecord } from "@/domain/runs/runRecord";
import {
  METRICS,
  PERFORMANCE_CATEGORIES,
  type PerformanceCategory,
  type PerformanceCategoryId,
  type PerformanceMetricId,
} from "@/domain/stats/categories";

export type SeriesPoint = {
  /** Epoch milliseconds. A bucketed point carries the first run of its day. */
  atMs: number;
  value: number;
  /** The rolling mean through this point. What the eye actually follows. */
  average: number;
  /** A personal best *within this series*: the best value seen up to and including this point. */
  isRecord: boolean;
  /** How many runs this point stands for. One, unless the series was folded by day. */
  runs: number;
};

export type PerformanceSeries = {
  categoryId: PerformanceCategoryId;
  metricId: PerformanceMetricId;
  points: SeriesPoint[];
  /** True when the series was folded by day because there were too many runs to plot honestly. */
  bucketed: boolean;
  /** How many eligible runs stand behind the series, folded or not. */
  runCount: number;
  /** Below the category's minimum, the chart says "not enough yet" rather than drawing a line. */
  hasEnough: boolean;
  lowerIsBetter: boolean;
};

/** The window of the rolling mean: wide enough to absorb one bad run, short enough to still move. */
const ROLLING_WINDOW = 5;

/**
 * The trailing mean over the last `window` values.
 *
 * Trailing, not centred. A centred average would let a run the player has not had yet lift the line
 * under a run they already have — the chart would appear to know the future, and the shape a player
 * reads as "I was improving here" would be partly made of runs from tomorrow.
 */
export function rollingAverage(values: number[], window: number = ROLLING_WINDOW): number[] {
  const averages: number[] = [];
  let sum = 0;

  for (const [index, value] of values.entries()) {
    sum += value;

    if (index >= window) {
      sum -= values[index - window];
    }

    averages.push(sum / Math.min(index + 1, window));
  }

  return averages;
}

/** The local day a run happened on, which is the unit a player actually thinks in. */
function localDay(atMs: number): string {
  const date = new Date(atMs);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

function categoryFor(categoryId: PerformanceCategoryId): PerformanceCategory {
  const found = PERFORMANCE_CATEGORIES.find((candidate) => candidate.id === categoryId);

  if (found === undefined) {
    throw new Error(`No performance category ${categoryId}.`);
  }

  return found;
}

type Projected = { atMs: number; value: number; runs: number };

/**
 * Folds a long series by local day, so a player with four hundred runs sees a trend rather than a
 * smear. A day becomes its mean — the honest summary of a day's play, where the best of the day
 * would flatter and the last of the day would be arbitrary.
 */
function bucketByDay(points: Projected[]): Projected[] {
  const days = new Map<string, { atMs: number; total: number; runs: number }>();

  for (const point of points) {
    const key = localDay(point.atMs);
    const day = days.get(key);

    if (day === undefined) {
      days.set(key, { atMs: point.atMs, total: point.value, runs: 1 });
      continue;
    }

    day.total += point.value;
    day.runs += 1;
  }

  return [...days.values()].map((day) => ({
    atMs: day.atMs,
    value: day.total / day.runs,
    runs: day.runs,
  }));
}

function isRecordAt(values: number[], index: number, lowerIsBetter: boolean): boolean {
  const value = values[index];

  for (let earlier = 0; earlier < index; earlier += 1) {
    const better = lowerIsBetter ? values[earlier] <= value : values[earlier] >= value;

    if (better) {
      return false;
    }
  }

  return true;
}

/**
 * The trend for one category and one metric (§9.2).
 *
 * Filter, project, sort, fold if it is long, average, mark the records. Every step is ordinary, and
 * the one that matters is not here at all: `selectEligibleForStats` owns the filter, so an assisted
 * run is off this chart for exactly the reason it is off the leaderboard — decided once, in the
 * policy, rather than re-argued by every surface (§5.6).
 *
 * A run that cannot answer the metric is **dropped, never zeroed**: a session has no pace index, and
 * a run recorded before the route fields existed has no keyboard share. A zero would draw a point on
 * the chart, and the player would read a catastrophic run they never had.
 */
export function buildSeries(
  log: RunLog,
  categoryId: PerformanceCategoryId,
  metricId: PerformanceMetricId,
): PerformanceSeries {
  const category = categoryFor(categoryId);
  const metric = METRICS[metricId];
  const lowerIsBetter = metric.lowerIsBetter === true;

  const eligible: RunRecord[] = selectEligibleForStats(log, categoryId);
  const projected: Projected[] = eligible
    .map((run) => {
      const value = metric.value(run);

      return value === null ? null : { atMs: run.atMs, value, runs: 1 };
    })
    .filter((point): point is Projected => point !== null)
    .sort((left, right) => left.atMs - right.atMs);

  const bucketed = projected.length > category.aggregateAbove;
  const points = bucketed ? bucketByDay(projected) : projected;
  const values = points.map((point) => point.value);
  const averages = rollingAverage(values);

  return {
    categoryId,
    metricId,
    points: points.map((point, index) => ({
      atMs: point.atMs,
      value: point.value,
      average: averages[index],
      isRecord: isRecordAt(values, index, lowerIsBetter),
      runs: point.runs,
    })),
    bucketed,
    runCount: projected.reduce((sum, point) => sum + point.runs, 0),
    hasEnough: projected.length >= category.minimumDataPoints,
    lowerIsBetter,
  };
}

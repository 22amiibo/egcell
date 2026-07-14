import { METRICS, PERFORMANCE_CATEGORIES } from "@/domain/stats/categories";
import type { PerformanceSeries } from "@/domain/stats/performanceSeries";
import { formatDateTime } from "@/lib/format";

const WIDTH = 640;
const HEIGHT = 220;
const PADDING = { top: 12, right: 12, bottom: 20, left: 12 };

type Scaled = { x: number; y: number; averageY: number };

/**
 * Where each point sits. The vertical axis **inverts** when a lower number is the better number —
 * pace index is elapsed over target, so 0.8 is a run to be proud of. Inverting it means "up" always
 * means "better", and a chart that means the opposite thing for one metric than for another is a
 * chart that has to be read twice before it can be trusted once.
 */
function scale(series: PerformanceSeries): Scaled[] {
  const values = series.points.flatMap((point) => [point.value, point.average]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const lastIndex = Math.max(series.points.length - 1, 1);

  const y = (value: number) => {
    const fraction = (value - min) / span;
    const better = series.lowerIsBetter ? 1 - fraction : fraction;

    return PADDING.top + (1 - better) * plotHeight;
  };

  return series.points.map((point, index) => ({
    x: PADDING.left + (index / lastIndex) * plotWidth,
    y: y(point.value),
    averageY: y(point.average),
  }));
}

function categoryLabel(series: PerformanceSeries): string {
  return (
    PERFORMANCE_CATEGORIES.find((category) => category.id === series.categoryId)?.label ??
    series.categoryId
  );
}

/**
 * The trend (§9.3): a dot per run, a line for the rolling average, a larger glyph on each personal
 * best.
 *
 * It is `role="img"` with a real caption, and it is followed by the same numbers as a table that is
 * visually hidden but fully present to a screen reader. The table is not a consolation prize — it is
 * the same data in the form that survives being read aloud, and a chart nobody can read is not a
 * chart.
 */
export function PerformanceChart({ series }: { series: PerformanceSeries }) {
  const metric = METRICS[series.metricId];
  const label = categoryLabel(series);

  if (!series.hasEnough) {
    return (
      <p
        className="rounded-lg border border-line px-3 py-6 text-center text-[12px] text-muted"
        data-testid="chart-empty"
      >
        {series.runCount === 0
          ? `No ${label} runs yet.`
          : `Not enough ${label} runs yet — a trend needs a few more.`}
      </p>
    );
  }

  const scaled = scale(series);
  const averagePath = scaled
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.averageY.toFixed(1)}`,
    )
    .join(" ");
  const caption = `${metric.label} over ${series.runCount} ${label} run${
    series.runCount === 1 ? "" : "s"
  }${series.bucketed ? ", averaged by day" : ""}.`;

  return (
    <figure className="flex flex-col gap-2">
      <svg
        role="img"
        aria-label={caption}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full rounded-lg border border-line bg-surface"
        data-testid="performance-chart"
      >
        <title>{caption}</title>

        <path
          d={averagePath}
          fill="none"
          stroke="var(--color-accent-strong)"
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {scaled.map((point, index) => (
          <circle
            key={series.points[index].atMs}
            cx={point.x}
            cy={point.y}
            r={series.points[index].isRecord ? 4 : 2.5}
            fill={
              series.points[index].isRecord
                ? "var(--color-accent-strong)"
                : "var(--color-text-muted)"
            }
          />
        ))}
      </svg>

      <figcaption className="text-[11px] text-muted">
        {caption}
        {series.bucketed && " Each dot is a day."}
      </figcaption>

      <table className="sr-only" data-testid="performance-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">When</th>
            <th scope="col">{metric.label}</th>
            <th scope="col">Rolling average</th>
            <th scope="col">Personal best</th>
          </tr>
        </thead>
        <tbody>
          {series.points.map((point) => (
            <tr key={point.atMs}>
              <td>{formatDateTime(new Date(point.atMs).toISOString())}</td>
              <td>{metric.format(point.value)}</td>
              <td>{metric.format(point.average)}</td>
              <td>{point.isRecord ? "Personal best" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

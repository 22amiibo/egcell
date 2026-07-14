"use client";

import {
  METRICS,
  PERFORMANCE_CATEGORIES,
  type PerformanceCategoryId,
  type PerformanceMetricId,
} from "@/domain/stats/categories";

/**
 * The category and metric pickers (§9.4).
 *
 * Not one mode string appears here. Both lists render from `PERFORMANCE_CATEGORIES` and from each
 * category's own `metrics`, so a new mode becomes a chart category by adding a single registry
 * entry — and a category that does not offer a metric cannot have it selected, because the button is
 * simply not there. A test asserts that no component contains a mode string; this is the component
 * that test was written for.
 */
export function CategorySelector({
  categoryId,
  metricId,
  onCategory,
  onMetric,
}: {
  categoryId: PerformanceCategoryId;
  metricId: PerformanceMetricId;
  onCategory: (id: PerformanceCategoryId) => void;
  onMetric: (id: PerformanceMetricId) => void;
}) {
  const category =
    PERFORMANCE_CATEGORIES.find((candidate) => candidate.id === categoryId) ??
    PERFORMANCE_CATEGORIES[0];

  return (
    <div className="flex flex-col gap-2">
      <div role="tablist" aria-label="Performance category" className="flex flex-wrap gap-1">
        {PERFORMANCE_CATEGORIES.map((candidate) => {
          const selected = candidate.id === category.id;

          return (
            <button
              key={candidate.id}
              type="button"
              role="tab"
              aria-selected={selected}
              // Roving tabindex: the group is one tab stop and the selected tab is the one that
              // holds it, which is the pattern the rest of the app's tablists already use.
              tabIndex={selected ? 0 : -1}
              onClick={() => onCategory(candidate.id)}
              className={[
                "rounded border px-2 py-1 text-[12px] font-medium transition-colors",
                selected
                  ? "border-accent bg-accent/15 text-ink"
                  : "border-line text-muted hover:bg-surface-raised hover:text-ink",
              ].join(" ")}
            >
              {candidate.label}
            </button>
          );
        })}
      </div>

      <div role="group" aria-label="Metric" className="flex flex-wrap gap-1">
        {category.metrics.map((candidate) => {
          const selected = candidate === metricId;

          return (
            <button
              key={candidate}
              type="button"
              aria-pressed={selected}
              onClick={() => onMetric(candidate)}
              className={[
                "rounded border px-2 py-0.5 text-[11px] transition-colors",
                selected ? "border-accent-strong text-ink" : "border-line text-muted hover:text-ink",
              ].join(" ")}
            >
              {METRICS[candidate].label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

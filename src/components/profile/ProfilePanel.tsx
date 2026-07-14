"use client";

import Link from "next/link";

import { CategorySelector } from "@/components/profile/CategorySelector";
import { MasteryPanel } from "@/components/profile/MasteryPanel";
import { PerformanceChart } from "@/components/profile/PerformanceChart";
import { RecentRuns } from "@/components/profile/RecentRuns";
import { calculateMastery } from "@/domain/mastery/calculateMastery";
import type { MasteryRun } from "@/domain/mastery/masteryTypes";
import { selectByMode, selectRecentRuns, selectTotals } from "@/domain/runs/runLog";
import type { RunRecord } from "@/domain/runs/runRecord";
import {
  PERFORMANCE_CATEGORIES,
  modeLabel,
  type PerformanceCategoryId,
  type PerformanceMetricId,
} from "@/domain/stats/categories";
import { buildSeries } from "@/domain/stats/performanceSeries";
import { useRunLog } from "@/hooks/useRunLog";
import { useSettings } from "@/hooks/useSettings";
import { formatElapsed, formatScore } from "@/lib/format";


/**
 * The title-lookup hack this used to need is gone: a record carries its own `family`, and a session
 * carries none (it draws across families by design) and falls to "mixed", exactly as before.
 */
function masteryRun(run: RunRecord): MasteryRun {
  return {
    family: run.family ?? "mixed",
    score: run.score,
    accuracy: run.completed ? 1 : 0,
    // The real number, now that a run carries one. A run recorded before the route fields existed
    // has none, and gets a 0 rather than a flattering guess: mastery should read what happened.
    shortcutEfficiency: run.keyboardShare === null ? 0 : Math.round(run.keyboardShare * 100),
  };
}

/**
 * The local book of everything played on this device. It lives on its own page so the run screen
 * stays a game surface; nothing here is required to play, and none of it leaves the machine.
 */
/**
 * The chart's selection, coerced back to something that exists. A settings blob can name a category
 * a later release removed, or a metric this category does not offer — in both cases the answer is
 * the category's own default, never a crash and never an empty chart the player cannot explain.
 */
function chartSelection(storedCategory: string, storedMetric: string) {
  const category =
    PERFORMANCE_CATEGORIES.find((candidate) => candidate.id === storedCategory) ??
    PERFORMANCE_CATEGORIES[0];
  const metric = category.metrics.includes(storedMetric as PerformanceMetricId)
    ? (storedMetric as PerformanceMetricId)
    : category.metrics[0];

  return { categoryId: category.id as PerformanceCategoryId, metricId: metric };
}

export function ProfilePanel() {
  const { log } = useRunLog();
  const { settings, setSettings } = useSettings();
  const { categoryId, metricId } = chartSelection(
    settings.stats.categoryId,
    settings.stats.metricId,
  );
  const series = buildSeries(log, categoryId, metricId);

  const selectCategory = (id: PerformanceCategoryId) => {
    // Switching category re-picks the metric only when the new category cannot answer the old one.
    setSettings((current) => ({ ...current, stats: { ...current.stats, categoryId: id } }));
  };

  const selectMetric = (id: PerformanceMetricId) => {
    setSettings((current) => ({ ...current, stats: { ...current.stats, metricId: id } }));
  };
  const totals = selectTotals(log);
  const modes = Object.entries(selectByMode(log));
  // No limit passed: the selector's own 20 is the limit, and the footer says so. The 50-row list
  // this page used to show was the v1 store's cap leaking into the UI (§1a.11).
  const recent = selectRecentRuns(log);
  const mastery = calculateMastery(recent.map(masteryRun));

  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-6 border-b border-line px-6 py-3">
        <span className="text-[13px] font-semibold tracking-tight text-ink">
          Excel Speed Trainer
        </span>
        <Link
          href="/"
          className="rounded border border-line px-2 py-1 text-[12px] font-medium text-muted transition-colors hover:bg-surface-raised hover:text-ink"
        >
          Back to the game
        </Link>
      </header>

      <div className="flex flex-1 justify-center px-6 py-10">
        <div className="flex w-full max-w-3xl flex-col gap-8">
          <div className="flex items-baseline justify-between">
            <h1 className="text-xl font-semibold tracking-tight text-ink">Profile</h1>
            <span className="text-[12px] text-muted">stored on this device only</span>
          </div>

          <div className="flex gap-4">
            <div className="flex-1 rounded-lg border border-line bg-surface p-4">
              <p className="text-3xl font-semibold tabular-nums text-ink" data-testid="total-runs">
                {formatScore(totals.runs)}
              </p>
              <p className="mt-1 text-[12px] text-muted">total runs</p>
            </div>
            <div className="flex-1 rounded-lg border border-line bg-surface p-4">
              <p
                className="text-3xl font-semibold tabular-nums text-ink"
                data-testid="total-completed"
              >
                {formatScore(totals.tasksCompleted)}
              </p>
              <p className="mt-1 text-[12px] text-muted">challenges completed</p>
            </div>
          </div>

          <MasteryPanel mastery={mastery} />

          <section className="flex flex-col gap-3">
            <h2 className="text-[11px] font-medium tracking-widest text-muted uppercase">
              Bests by mode
            </h2>

            {modes.length === 0 ? (
              <p className="text-[13px] text-muted">Nothing yet. Play a run and come back.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full text-[13px]" data-testid="bests-by-mode">
                  <thead>
                    <tr className="border-b border-line bg-surface-raised text-left text-[11px] tracking-widest text-muted uppercase">
                      <th className="px-3 py-2 font-medium">Mode</th>
                      <th className="px-3 py-2 text-right font-medium">Best score</th>
                      <th className="px-3 py-2 text-right font-medium">Best time</th>
                      <th className="px-3 py-2 text-right font-medium">Runs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modes.map(([key, stats]) => (
                      <tr key={key} className="border-b border-line last:border-b-0">
                        <td className="px-3 py-2 text-ink">{modeLabel(key)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-ink">
                          {formatScore(stats.bestScore)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-ink">
                          {stats.bestElapsedMs === null ? "—" : formatElapsed(stats.bestElapsedMs)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted">
                          {stats.runs}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3" data-testid="performance">
            <h2 className="text-[13px] font-semibold text-ink">Performance</h2>

            <CategorySelector
              categoryId={categoryId}
              metricId={metricId}
              onCategory={selectCategory}
              onMetric={selectMetric}
            />

            <PerformanceChart series={series} />
          </section>

          <RecentRuns runs={recent} totalRuns={totals.runs} />
        </div>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";

import {
  calculateLiveRunStats,
  type LiveRunStatsInput,
} from "@/domain/stats/liveRunStats";

type LiveStatsBarProps = Omit<LiveRunStatsInput, "elapsedMs"> & {
  /** Epoch milliseconds, or null before the run clock starts. */
  startedAt: number | null;
  /** Stops the live calculation at the final run time. */
  frozenElapsedMs: number | null;
  enabled?: boolean;
};

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div
      data-testid="live-stat-cell"
      className="flex min-w-20 flex-col gap-0.5 border-r border-line px-3 last:border-r-0"
    >
      <dt className="text-[10px] font-medium tracking-widest text-muted uppercase">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}

function formatProgress(completedTasks: number, totalTasks: number): string {
  if (totalTasks === 0) {
    return String(Math.floor(completedTasks));
  }

  if (!Number.isInteger(completedTasks)) {
    return `${Math.round((completedTasks / totalTasks) * 100)}%`;
  }

  return `${completedTasks} / ${totalTasks}`;
}

/** A self-ticking display so the clock updates do not rerender the spreadsheet grid. */
export function LiveStatsBar({
  startedAt,
  frozenElapsedMs,
  enabled = true,
  ...input
}: LiveStatsBarProps) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!enabled || startedAt === null || frozenElapsedMs !== null) {
      return;
    }

    let frame = requestAnimationFrame(function tick() {
      setElapsedMs(Date.now() - startedAt);
      frame = requestAnimationFrame(tick);
    });

    return () => cancelAnimationFrame(frame);
  }, [enabled, startedAt, frozenElapsedMs]);

  if (!enabled) {
    return null;
  }

  const stats = calculateLiveRunStats({
    ...input,
    elapsedMs: frozenElapsedMs ?? elapsedMs,
  });

  return (
    <dl
      aria-label="Live run stats"
      data-testid="live-stats-bar"
      className="flex w-fit rounded-md border border-line bg-surface py-2 shadow-sm"
    >
      <StatCell label="EPM" value={String(stats.epm)} />
      <StatCell label="Accuracy" value={`${stats.accuracy}%`} />
      <StatCell label="Shortcuts" value={`${stats.shortcutEfficiency}%`} />
      <StatCell
        label="Progress"
        value={formatProgress(stats.completedTasks, stats.totalTasks)}
      />
    </dl>
  );
}

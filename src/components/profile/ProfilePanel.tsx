"use client";

import Link from "next/link";

import { MasteryPanel } from "@/components/profile/MasteryPanel";
import { calculateMastery } from "@/domain/mastery/calculateMastery";
import type { MasteryRun } from "@/domain/mastery/masteryTypes";
import { HISTORY_LIMIT } from "@/domain/profile/runHistory";
import { selectByMode, selectRecentRuns, selectTotals } from "@/domain/runs/runLog";
import type { RunRecord } from "@/domain/runs/runRecord";
import { SESSION_MODES, sessionModeLabel, type SessionMode } from "@/domain/sessions/sessionTypes";
import { useRunLog } from "@/hooks/useRunLog";
import { formatDateTime, formatElapsed, formatScore } from "@/lib/format";

function modeLabel(modeKey: string): string {
  if (modeKey === "main-speed") {
    return "Speed";
  }

  if (modeKey === "practice") {
    return "Practice";
  }

  if ((SESSION_MODES as string[]).includes(modeKey)) {
    return sessionModeLabel(modeKey as SessionMode);
  }

  return modeKey;
}

/**
 * The title-lookup hack this used to need is gone: a record carries its own `family`, and a session
 * carries none (it draws across families by design) and falls to "mixed", exactly as before.
 */
function masteryRun(run: RunRecord): MasteryRun {
  return {
    family: run.family ?? "mixed",
    score: run.score,
    // Route metrics land in Phase 5. Until a run carries one, completion is still the only honest
    // accuracy signal, and no shortcut credit is inferred from a title or a mode.
    accuracy: run.completed ? 1 : 0,
    shortcutEfficiency: 0,
  };
}

/**
 * The local book of everything played on this device. It lives on its own page so the run screen
 * stays a game surface; nothing here is required to play, and none of it leaves the machine.
 */
export function ProfilePanel() {
  const { log } = useRunLog();
  const totals = selectTotals(log);
  const modes = Object.entries(selectByMode(log));
  // The 50 rows this page has always shown. Phase 8 swaps in `RecentRuns`, which takes the
  // selector's real 20-row window and its "latest 20 of N" footer (§1a.11).
  const recent = selectRecentRuns(log, HISTORY_LIMIT);
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
                <table className="w-full text-[13px]">
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

          <section className="flex flex-col gap-3">
            <h2 className="text-[11px] font-medium tracking-widest text-muted uppercase">
              Recent runs
            </h2>

            {recent.length === 0 ? (
              <p className="text-[13px] text-muted">No runs recorded yet.</p>
            ) : (
              <ol data-testid="run-history" className="flex flex-col rounded-lg border border-line">
                {recent.map((run) => (
                  <li
                    key={run.id}
                    className="flex items-baseline justify-between gap-4 border-b border-line px-3 py-2 text-[13px] last:border-b-0"
                  >
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="truncate text-ink">{run.label}</span>
                      <span className="shrink-0 text-[11px] text-muted">
                        {modeLabel(run.modeKey)}
                      </span>
                      {run.isNewRecord && (
                        <span className="shrink-0 text-[11px] font-semibold text-accent-strong">
                          PR
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted">
                      {formatScore(run.score)} pts · {formatElapsed(run.elapsedMs)} ·{" "}
                      {formatDateTime(run.at)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

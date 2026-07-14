import { RECENT_RUNS_LIMIT, type RunRecord } from "@/domain/runs/runRecord";
import { SESSION_MODES, sessionModeLabel, type SessionMode } from "@/domain/sessions/sessionTypes";
import { formatDateTime, formatElapsed, formatScore } from "@/lib/format";

const MODE_LABELS: Record<string, string> = {
  "main-speed": "Speed",
  practice: "Practice",
  hotkey: "Hotkey",
};

function modeLabel(modeKey: string): string {
  const known = MODE_LABELS[modeKey];

  if (known !== undefined) {
    return known;
  }

  return (SESSION_MODES as string[]).includes(modeKey)
    ? sessionModeLabel(modeKey as SessionMode)
    : modeKey;
}

/** What the run was, in the player's words: "selection · d2", or "5 tasks" for a session. */
function describeRun(run: RunRecord): string {
  if (run.family === null) {
    return `${run.taskCount} task${run.taskCount === 1 ? "" : "s"}`;
  }

  return run.difficulty === null ? run.family : `${run.family} · d${run.difficulty}`;
}

function Badge({ label, tone }: { label: string; tone: "record" | "warning" | "muted" }) {
  const classes = {
    record: "border-accent-strong/40 bg-accent/10 text-accent-strong",
    warning: "border-warning/40 bg-warning/10 text-warning",
    muted: "border-line bg-surface-raised text-muted",
  }[tone];

  return (
    <span className={`rounded border px-1 py-0.5 text-[10px] font-medium ${classes}`}>{label}</span>
  );
}

function Flags({ run }: { run: RunRecord }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      {run.isNewRecord && <Badge label="PR" tone="record" />}
      {run.assist === "revealed" && <Badge label="Assisted" tone="warning" />}
      {run.outcome !== "completed" && <Badge label="Failed" tone="warning" />}
      {/* Pure means the run never touched a pointer — the thing Hotkey Mode is actually about. */}
      {run.keyboardShare === 1 && <Badge label="Pure" tone="muted" />}
    </span>
  );
}

/**
 * The latest runs (§7.7).
 *
 * It renders what it is handed and nothing else: the twenty-row cap lives in `selectRecentRuns`, so
 * this component *cannot* show a twenty-first row — it is never given one. The footer is the point
 * of the whole component. Without it, a player with four hundred runs sees twenty and concludes the
 * rest were thrown away. They were not, and they still count toward everything that matters.
 */
export function RecentRuns({ runs, totalRuns }: { runs: RunRecord[]; totalRuns: number }) {
  if (runs.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] font-semibold text-ink">Recent runs</h2>
        <p className="text-[12px] text-muted">No runs yet. Play one.</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[13px] font-semibold text-ink">Recent runs</h2>

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full border-collapse text-left text-[12px]" data-testid="recent-runs">
          <thead className="text-[11px] uppercase tracking-wide text-muted">
            <tr className="border-b border-line">
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Mode</th>
              <th className="px-3 py-2 font-medium">Challenge</th>
              <th className="px-3 py-2 font-medium">Result</th>
              <th className="px-3 py-2 font-medium">Time</th>
              <th className="px-3 py-2 font-medium">Accuracy</th>
              <th className="px-3 py-2 font-medium">Flags</th>
            </tr>
          </thead>

          <tbody>
            {runs.map((run) => (
              <tr key={run.id} className="border-b border-line/60 last:border-0">
                <td className="px-3 py-2 whitespace-nowrap text-muted">{formatDateTime(run.at)}</td>
                <td className="px-3 py-2 whitespace-nowrap text-ink">{modeLabel(run.modeKey)}</td>
                <td className="px-3 py-2 text-ink">{describeRun(run)}</td>
                <td className="px-3 py-2 whitespace-nowrap tabular-nums text-ink">
                  {run.outcome === "completed" ? `${formatScore(run.score)} pts` : "—"}
                </td>
                <td className="px-3 py-2 whitespace-nowrap tabular-nums text-muted">
                  {/* An assisted run's time is not a time anyone should be comparing against. */}
                  {run.assist === "revealed" ? "—" : formatElapsed(run.elapsedMs)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap tabular-nums text-muted">
                  {`${Math.round(run.accuracy * 100)}%`}
                </td>
                <td className="px-3 py-2">
                  <Flags run={run} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalRuns > runs.length && (
        <p className="text-[11px] text-muted" data-testid="recent-runs-footer">
          {`Showing the latest ${Math.min(RECENT_RUNS_LIMIT, runs.length)} of ${totalRuns} runs. Older runs still count toward your trends.`}
        </p>
      )}
    </section>
  );
}

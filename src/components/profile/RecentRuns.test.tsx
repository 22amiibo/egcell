import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RecentRuns } from "@/components/profile/RecentRuns";
import type { RunLog } from "@/domain/runs/runLog";
import { selectRecentRuns } from "@/domain/runs/runLog";
import type { RunRecord } from "@/domain/runs/runRecord";

function run(index: number, overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    id: `run-${index}`,
    schemaVersion: 2,
    at: `2026-07-13T14:${String(index).padStart(2, "0")}:00.000Z`,
    atMs: 1_760_000_000_000 + index * 60_000,
    modeKey: "main-speed",
    categoryId: "speed",
    label: "Select the Revenue column",
    challengeId: "selection.revenue-column",
    challengeVersion: "v1",
    templateId: null,
    family: "selection",
    difficulty: 2,
    seed: "seed",
    outcome: "completed",
    completed: true,
    tasksCompleted: 1,
    taskCount: 1,
    score: 1420,
    elapsedMs: 6410,
    targetMs: 8000,
    correctness: 1,
    accuracy: 1,
    actions: 5,
    keyboardActions: 5,
    shortcutActions: 5,
    optimalActions: 5,
    routeEfficiency: 1,
    keyboardShare: 1,
    routeId: "route-a",
    peakTier: null,
    wpm: null,
    keystrokeAccuracy: null,
    peakComboStreak: null,
    comboBreakCount: null,
    comboOpportunityCount: null,
    assist: "none",
    integrity: "ok",
    isNewRecord: false,
    attempts: 0,
    eventDigest: null,
    ...overrides,
  };
}

function logOf(runs: RunRecord[]): RunLog {
  return {
    version: 2,
    priorTotals: { runs: 0, tasksCompleted: 0 },
    priorByMode: {},
    rollups: [],
    runs,
  };
}

describe("RecentRuns", () => {
  it("shows twenty rows of twenty-one runs, and says the rest still count", () => {
    // The cap is not enforced here, and could not be: the selector hands over twenty, so the table
    // *cannot* render a twenty-first row. The footer is the whole point of the component — without
    // it, a player with hundreds of runs sees twenty and concludes the rest were thrown away.
    const all = Array.from({ length: 21 }, (_, index) => run(index));

    render(<RecentRuns runs={selectRecentRuns(logOf(all))} totalRuns={21} />);

    // Twenty runs, plus the header row.
    expect(within(screen.getByTestId("recent-runs")).getAllByRole("row")).toHaveLength(21);
    expect(screen.getByTestId("recent-runs-footer")).toHaveTextContent(
      "Showing the latest 20 of 21 runs. Older runs still count toward your trends.",
    );
  });

  it("says nothing about a window that is not a window", () => {
    render(<RecentRuns runs={[run(0)]} totalRuns={1} />);

    expect(screen.queryByTestId("recent-runs-footer")).not.toBeInTheDocument();
  });

  it("shows an assisted run with no time, because its time means nothing", () => {
    render(<RecentRuns runs={[run(0, { assist: "revealed", elapsedMs: 4200 })]} totalRuns={1} />);

    const row = within(screen.getByTestId("recent-runs")).getAllByRole("row")[1];

    expect(within(row).getByText("Assisted")).toBeVisible();
    expect(within(row).queryByText("4.20s")).not.toBeInTheDocument();
  });

  it("badges a failed run, and gives it no result", () => {
    render(
      <RecentRuns
        runs={[run(0, { outcome: "failed", completed: false, score: 0 })]}
        totalRuns={1}
      />,
    );

    const row = within(screen.getByTestId("recent-runs")).getAllByRole("row")[1];

    expect(within(row).getByText("Failed")).toBeVisible();
  });

  it("badges a keyboard-pure run, which is what Hotkey Mode is actually about", () => {
    render(<RecentRuns runs={[run(0, { keyboardShare: 1 })]} totalRuns={1} />);

    expect(screen.getByText("Pure")).toBeVisible();
  });

  it("reads the challenge from the record, never from a lookup on its title", () => {
    // The title-lookup hack this replaces guessed a run's family by matching its label against a
    // table of known titles. A record carries its own family and difficulty now.
    render(<RecentRuns runs={[run(0, { family: "sort-filter", difficulty: 4 })]} totalRuns={1} />);

    expect(screen.getByTestId("recent-runs")).toHaveTextContent("sort-filter · d4");
  });

  it("calls a session by its task count, because it has no single family", () => {
    render(
      <RecentRuns
        runs={[run(0, { modeKey: "sprint-5", family: null, difficulty: null, taskCount: 5 })]}
        totalRuns={1}
      />,
    );

    const table = screen.getByTestId("recent-runs");

    expect(table).toHaveTextContent("Sprint 5");
    expect(table).toHaveTextContent("5 tasks");
  });
});

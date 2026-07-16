import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { GameShell } from "@/components/game/GameShell";
import { buildSessionQueue } from "@/data/challenges/queue";
import { COMMAND_STATS_KEY, type CommandStatsStore } from "@/domain/mastery/commandMastery";
import { scoreRun } from "@/domain/scoring/scoreRun";
import { solveChallengeDom } from "@/test/solveVariantDom";

/**
 * The shell reads a session seed from the URL once per page load. Setting it before the first
 * render pins the queue, so these tests can compute exactly which generated tasks the sprint will
 * deal and drive each one through the DOM.
 */
const SEED = "sprint-component-seed";

const sprintQueue = () => buildSessionQueue("sprint-5", SEED);

const startSprintFive = () => userEvent.click(screen.getByRole("button", { name: "Sprint 5" }));

function completeAllFiveTasks() {
  for (const task of sprintQueue().tasks) {
    solveChallengeDom(task.variant);
  }
}

describe("sprint mode", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, "", `/?sessionSeed=${SEED}`);
  });

  it("starts at task 1 of 5 with no challenge picker, on the seeded queue's first task", async () => {
    render(<GameShell />);

    await startSprintFive();

    expect(screen.getByText(/task 1 of 5/)).toBeVisible();
    expect(screen.queryByLabelText("Challenge")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: sprintQueue().tasks[0].variant.prompt }),
    ).toBeVisible();
  });

  it("advances through the queue as tasks complete, then shows the session result", async () => {
    render(<GameShell />);

    await startSprintFive();

    const queue = sprintQueue();

    solveChallengeDom(queue.tasks[0].variant);

    // No per-task result card: the next task is already up.
    expect(screen.queryByTestId("result-card")).not.toBeInTheDocument();
    expect(screen.getByText(/task 2 of 5/)).toBeVisible();

    for (const task of queue.tasks.slice(1)) {
      solveChallengeDom(task.variant);
    }

    expect(screen.getByTestId("session-result-card")).toBeVisible();
    expect(screen.getByTestId("session-tasks")).toHaveTextContent("5 of 5");
    expect(screen.getByTestId("session-pr-line")).toHaveTextContent(
      "First personal record for this mode.",
    );
  });

  it("lets the player skip a task, and the skip costs completion", async () => {
    render(<GameShell />);

    await startSprintFive();

    for (let index = 0; index < 5; index += 1) {
      await userEvent.click(screen.getByRole("button", { name: "Skip task" }));
    }

    expect(screen.getByTestId("session-result-card")).toBeVisible();
    expect(screen.getByTestId("session-tasks")).toHaveTextContent("0 of 5");
    expect(screen.getByTestId("session-score")).toHaveTextContent("0 points");
  });

  it("restarts the sprint from task 1 on retry, re-racing the same pinned queue", async () => {
    render(<GameShell />);

    await startSprintFive();
    completeAllFiveTasks();

    expect(screen.getByTestId("session-result-card")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(screen.queryByTestId("session-result-card")).not.toBeInTheDocument();
    expect(screen.getByText(/task 1 of 5/)).toBeVisible();
    // The seed is pinned by the URL, so retry faces the same first task.
    expect(
      screen.getByRole("heading", { name: sprintQueue().tasks[0].variant.prompt }),
    ).toBeVisible();
  });

  it("keeps the sprint record apart from single-challenge records", async () => {
    render(<GameShell />);

    // Bank a single-challenge record first.
    await userEvent.click(screen.getByRole("button", { name: "Speed" }));
    await userEvent.selectOptions(
      screen.getByLabelText("Challenge"),
      "selection.revenue-column",
    );
    await userEvent.click(screen.getByRole("button", { name: "Select column C" }));
    expect(screen.getByTestId("best-time")).toHaveTextContent("best");

    await startSprintFive();

    // A fresh sprint book: the single-challenge record must not leak in.
    expect(screen.getByTestId("best-time")).toHaveTextContent("no record yet");

    completeAllFiveTasks();

    expect(screen.getByTestId("best-time")).toHaveTextContent("pts");

    // And back in speed mode the per-challenge record is still a time.
    await userEvent.click(screen.getByRole("button", { name: "Speed" }));
    expect(screen.getByTestId("best-time")).toHaveTextContent("best");
    expect(screen.getByTestId("best-time")).not.toHaveTextContent("pts");
  });

  it("scores the second task with the combo multiplier after a clean, instant first clear", async () => {
    render(<GameShell />);

    await startSprintFive();

    const queue = sprintQueue();

    // Every DOM-solved task in this seeded queue walks a route with zero extra actions
    // (`compareRoute` confidence "high", `extraActions: 0`), so the first clear is clean and the
    // streak advances to 1 entering task two. `completeAllFiveTasks` drives the whole sprint so
    // the result card — the only place a per-task score renders — has something to show.
    completeAllFiveTasks();

    expect(screen.getByTestId("session-result-card")).toBeVisible();

    fireEvent.click(screen.getByText("Task breakdown"));

    const details = screen.getByText("Task breakdown").closest("details");

    if (details === null) {
      throw new Error("Expected a details element around the task breakdown.");
    }

    const rows = details.querySelectorAll("li");
    const secondRowText = rows[1]?.textContent ?? "";
    const scoreMatch = secondRowText.match(/([\d,]+) pts$/);

    if (scoreMatch === null) {
      throw new Error(`No score found in the second breakdown row: "${secondRowText}"`);
    }

    const secondTaskScore = Number(scoreMatch[1].replace(/,/g, ""));
    const secondTask = queue.tasks[1].variant;

    // Both tasks finish in a handful of synchronous milliseconds, well under `scoreRun`'s 0.5s
    // fastest-credited floor, so a bare (no-combo) run at the same target and base points has the
    // identical speed component — the only thing left for the multiplier to move is the 1.1x.
    const bareScore = scoreRun({
      elapsedMs: 0,
      correctness: 1,
      completionPercent: 1,
      accuracy: 1,
      basePoints: secondTask.scoring.basePoints,
      targetSeconds: secondTask.scoring.targetSeconds,
      comboMultiplier: 1,
    }).score;

    expect(secondTaskScore).toBe(Math.round(bareScore * 1.1));
  });

  it("feeds the per-command stats store as each task in the sprint completes", async () => {
    render(<GameShell />);

    await startSprintFive();
    completeAllFiveTasks();

    expect(screen.getByTestId("session-result-card")).toBeVisible();

    // No spy here — SessionRun has no dedicated component-test harness of its own (unlike
    // AscentRun), so this proves the same wiring end to end: five real tasks solved through the
    // DOM leave real counts in the real `localStorage`-backed store, through `GameShell`'s actual
    // `useCommandStats` instance rather than an injected mock.
    const raw = window.localStorage.getItem(COMMAND_STATS_KEY);

    expect(raw).not.toBeNull();

    const stored = JSON.parse(raw as string) as CommandStatsStore;
    const totalUses = Object.values(stored).reduce((sum, stat) => sum + (stat?.uses ?? 0), 0);

    expect(totalUses).toBeGreaterThan(0);
  });
});

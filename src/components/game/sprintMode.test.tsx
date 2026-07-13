import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { GameShell } from "@/components/game/GameShell";
import { buildSessionQueue } from "@/data/challenges/queue";
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
});

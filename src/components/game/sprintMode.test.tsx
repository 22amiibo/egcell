import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { GameShell } from "@/components/game/GameShell";

const startSprintFive = () => userEvent.click(screen.getByRole("button", { name: "Sprint 5" }));

/** The five deterministic Sprint 5 tasks, each done by its fastest route. */
async function completeAllFiveTasks() {
  // 1. Select the Revenue column.
  await userEvent.click(screen.getByRole("button", { name: "Select column C" }));

  // 2. Go to the last Revenue cell.
  await userEvent.click(screen.getByRole("button", { name: "C7" }));

  // 3. Select the header row.
  await userEvent.click(screen.getByRole("button", { name: "Select row 1" }));

  // 4. Select the whole table.
  fireEvent.keyDown(screen.getByRole("grid"), { key: "a", metaKey: true });

  // 5. Bold the header row.
  await userEvent.click(screen.getByRole("button", { name: "Select row 1" }));
  await userEvent.click(screen.getByRole("button", { name: "Bold" }));
}

describe("sprint mode", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts at task 1 of 5 with no challenge picker", async () => {
    render(<GameShell />);

    await startSprintFive();

    expect(screen.getByText(/task 1 of 5/)).toBeVisible();
    expect(screen.queryByLabelText("Challenge")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Select the Revenue column." })).toBeVisible();
  });

  it("advances through the queue as tasks complete, then shows the session result", async () => {
    render(<GameShell />);

    await startSprintFive();
    await userEvent.click(screen.getByRole("button", { name: "Select column C" }));

    // No per-task result card: the next task is already up.
    expect(screen.queryByTestId("result-card")).not.toBeInTheDocument();
    expect(screen.getByText(/task 2 of 5/)).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "C7" }));
    await userEvent.click(screen.getByRole("button", { name: "Select row 1" }));
    fireEvent.keyDown(screen.getByRole("grid"), { key: "a", metaKey: true });
    await userEvent.click(screen.getByRole("button", { name: "Select row 1" }));
    await userEvent.click(screen.getByRole("button", { name: "Bold" }));

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

  it("restarts the whole sprint from task 1 on retry", async () => {
    render(<GameShell />);

    await startSprintFive();
    await completeAllFiveTasks();

    expect(screen.getByTestId("session-result-card")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(screen.queryByTestId("session-result-card")).not.toBeInTheDocument();
    expect(screen.getByText(/task 1 of 5/)).toBeVisible();
    expect(screen.getByRole("heading", { name: "Select the Revenue column." })).toBeVisible();
  });

  it("keeps the sprint record apart from single-challenge records", async () => {
    render(<GameShell />);

    // Bank a single-challenge record first.
    await userEvent.click(screen.getByRole("button", { name: "Select column C" }));
    expect(screen.getByTestId("best-time")).toHaveTextContent("best");

    await startSprintFive();

    // A fresh sprint book: the single-challenge record must not leak in.
    expect(screen.getByTestId("best-time")).toHaveTextContent("no record yet");

    await completeAllFiveTasks();

    expect(screen.getByTestId("best-time")).toHaveTextContent("pts");

    // And back in speed mode the per-challenge record is still a time.
    await userEvent.click(screen.getByRole("button", { name: "Speed" }));
    expect(screen.getByTestId("best-time")).toHaveTextContent("best");
    expect(screen.getByTestId("best-time")).not.toHaveTextContent("pts");
  });
});

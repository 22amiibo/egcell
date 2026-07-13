import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GameShell } from "@/components/game/GameShell";
import { buildSessionQueue } from "@/data/challenges/queue";
import { solveChallengeDom, solveChallengePartDom } from "@/test/solveVariantDom";

/**
 * Fake timers stand in for the 30-second clock, so these tests cover the full timed lifecycle in
 * milliseconds of real time. Only `setTimeout` and `Date` are faked: faking the full set would
 * also fake the primitives React schedules its own work with. Interactions use `fireEvent`, which
 * is synchronous and has no timer interplay at all — including the queue solver.
 */
const SEED = Array.from({ length: 200 }, (_, index) => `timed-mixed-${index}`).find((seed) =>
  buildSessionQueue("timed-30", seed).tasks[0]?.variant.validation.kind === "composite"
);

if (SEED === undefined) {
  throw new Error("No deterministic timed seed starts with a mixed challenge.");
}

const timedQueue = () => buildSessionQueue("timed-30", SEED);

describe("timed mode", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, "", `/?sessionSeed=${SEED}`);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const click = (name: string) => {
    fireEvent.click(screen.getByRole("button", { name }));
  };

  const letClockRunOut = () => {
    act(() => {
      vi.advanceTimersByTime(61_000);
    });
  };

  it("ends the run by itself when the clock hits zero", () => {
    render(<GameShell />);

    click("30s");

    expect(screen.queryByTestId("session-result-card")).not.toBeInTheDocument();

    letClockRunOut();

    expect(screen.getByTestId("session-result-card")).toBeVisible();
    expect(screen.getByText("Time's up")).toBeVisible();
  });

  it("counts completed tasks and grades the interrupted one as attempted", () => {
    render(<GameShell />);

    click("30s");

    // Two quick completions from the seeded queue, then the buzzer lands mid-third-task.
    const queue = timedQueue();

    solveChallengeDom(queue.tasks[0].variant);
    solveChallengeDom(queue.tasks[1].variant);

    letClockRunOut();

    expect(screen.getByTestId("session-result-card")).toBeVisible();
    // Two completed out of three attempted: the expired third counts against completion.
    expect(screen.getByTestId("session-tasks")).toHaveTextContent("2 of 3");
    expect(screen.getByTestId("session-final-time")).toHaveTextContent("2 tasks");
    expect(screen.getByTestId("session-pr-line")).toHaveTextContent(
      "First personal record for this mode.",
    );
  });

  it("banks partial credit and names unfinished subgoals when the buzzer interrupts a chain", () => {
    render(<GameShell />);

    click("30s");

    const first = timedQueue().tasks[0].variant;

    expect(first.validation.kind).toBe("composite");
    solveChallengePartDom(first, 0);

    letClockRunOut();

    expect(screen.getByTestId("session-result-card")).toBeVisible();
    expect(screen.getByTestId("session-score")).not.toHaveTextContent("0 points");

    fireEvent.click(screen.getByText("Task breakdown"));

    if (first.validation.kind !== "composite") {
      throw new Error("Expected a composite challenge.");
    }

    expect(screen.getByText(`${first.validation.partLabels?.[0]} — done`)).toBeVisible();
    expect(screen.getByText(`${first.validation.partLabels?.[1]} — unfinished`)).toBeVisible();
  });

  it("keeps the queue going after a skip instead of ending the session", () => {
    render(<GameShell />);

    click("30s");
    click("Skip task");

    // Still running: the skip moved to task 2, it did not end the session.
    expect(screen.queryByTestId("session-result-card")).not.toBeInTheDocument();
    expect(screen.getByText(/task 2/)).toBeVisible();

    letClockRunOut();

    // A run of skips buys nothing: no task completed, no points.
    expect(screen.getByTestId("session-result-card")).toBeVisible();
    expect(screen.getByTestId("session-score")).toHaveTextContent("0 points");
  });

  it("ends the session when a completion lands past the deadline but before the timer fires", () => {
    render(<GameShell />);

    click("30s");

    // 29 seconds pass normally. Then the wall clock slips past the deadline without the pending
    // setTimeout firing, which is exactly what main-thread jitter does to a timer.
    act(() => {
      vi.advanceTimersByTime(29_000);
    });
    vi.setSystemTime(Date.now() + 1_500);

    // The player completes the task in that gap. The session must end, not advance to task 2.
    solveChallengeDom(timedQueue().tasks[0].variant);

    expect(screen.getByTestId("session-result-card")).toBeVisible();
    expect(screen.getByText("Time's up")).toBeVisible();
    expect(screen.getByTestId("session-tasks")).toHaveTextContent("1 of 1");
  });

  it("keeps 30-second and 60-second records apart", () => {
    render(<GameShell />);

    click("30s");
    solveChallengeDom(timedQueue().tasks[0].variant);

    letClockRunOut();

    expect(screen.getByTestId("session-result-card")).toBeVisible();
    expect(screen.getByTestId("best-time")).toHaveTextContent("pts");

    click("60s");

    expect(screen.getByTestId("best-time")).toHaveTextContent("no record yet");
  });
});

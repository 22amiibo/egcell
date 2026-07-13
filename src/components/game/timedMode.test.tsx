import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GameShell } from "@/components/game/GameShell";

/**
 * Fake timers stand in for the 30-second clock, so these tests cover the full timed lifecycle in
 * milliseconds of real time. Only `setTimeout` and `Date` are faked: faking the full set would
 * also fake the primitives React schedules its own work with. Interactions use `fireEvent`, which
 * is synchronous and has no timer interplay at all.
 */
describe("timed mode", () => {
  beforeEach(() => {
    window.localStorage.clear();
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

    // Two quick completions, then the buzzer lands mid-third-task.
    click("Select column C");
    click("C7");

    letClockRunOut();

    expect(screen.getByTestId("session-result-card")).toBeVisible();
    // Two completed out of three attempted: the expired third counts against completion.
    expect(screen.getByTestId("session-tasks")).toHaveTextContent("2 of 3");
    expect(screen.getByTestId("session-final-time")).toHaveTextContent("2 tasks");
    expect(screen.getByTestId("session-pr-line")).toHaveTextContent(
      "First personal record for this mode.",
    );
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

  it("keeps 30-second and 60-second records apart", () => {
    render(<GameShell />);

    click("30s");
    click("Select column C");

    letClockRunOut();

    expect(screen.getByTestId("session-result-card")).toBeVisible();
    expect(screen.getByTestId("best-time")).toHaveTextContent("pts");

    click("60s");

    expect(screen.getByTestId("best-time")).toHaveTextContent("no record yet");
  });
});

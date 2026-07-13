import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { ProfilePanel } from "@/components/profile/ProfilePanel";
import { RUN_HISTORY_KEY, type ProfileState } from "@/domain/profile/runHistory";

function seedProfile(profile: ProfileState) {
  window.localStorage.setItem(RUN_HISTORY_KEY, JSON.stringify(profile));
}

describe("the profile panel", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows an honest empty state before anything has been played", () => {
    render(<ProfilePanel />);

    expect(screen.getByTestId("total-runs")).toHaveTextContent("0");
    expect(screen.getByText("No runs recorded yet.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to the game" })).toBeVisible();
  });

  it("renders totals, per-mode bests, and the recent list from storage", () => {
    seedProfile({
      entries: [
        {
          id: "a",
          at: "2026-07-13T14:05:00.000Z",
          modeKey: "sprint-5",
          label: "Sprint 5",
          score: 4200,
          elapsedMs: 41_000,
          completed: true,
          tasksCompleted: 5,
          isNewRecord: true,
        },
        {
          id: "b",
          at: "2026-07-13T14:00:00.000Z",
          modeKey: "main-speed",
          label: "Select the Revenue column",
          score: 980,
          elapsedMs: 2_140,
          completed: true,
          tasksCompleted: 1,
          isNewRecord: false,
        },
      ],
      totalRuns: 12,
      totalTasksCompleted: 31,
      byMode: {
        "main-speed": { bestScore: 1450, bestElapsedMs: 1_820, runs: 9 },
        "sprint-5": { bestScore: 4200, bestElapsedMs: 41_000, runs: 3 },
      },
    });

    render(<ProfilePanel />);

    expect(screen.getByTestId("total-runs")).toHaveTextContent("12");
    expect(screen.getByTestId("total-completed")).toHaveTextContent("31");

    // Bests by mode, with human labels.
    expect(screen.getByRole("cell", { name: "Speed" })).toBeVisible();
    expect(screen.getByRole("cell", { name: "1,450" })).toBeVisible();
    expect(screen.getByRole("cell", { name: "1.82s" })).toBeVisible();

    // Recent runs, newest first, with the PR marker.
    const history = screen.getByTestId("run-history");
    expect(history).toHaveTextContent("Sprint 5");
    expect(history).toHaveTextContent("Select the Revenue column");
    expect(history).toHaveTextContent("PR");
  });

  it("places mastery and a focused practice recommendation above recent runs", () => {
    seedProfile({
      entries: [
        {
          id: "selection-run",
          at: "2026-07-13T14:00:00.000Z",
          modeKey: "main-speed",
          label: "Select the Revenue column",
          score: 900,
          elapsedMs: 3000,
          completed: true,
          tasksCompleted: 1,
          isNewRecord: false,
        },
      ],
      totalRuns: 1,
      totalTasksCompleted: 1,
      byMode: {
        "main-speed": { bestScore: 900, bestElapsedMs: 3000, runs: 1 },
      },
    });

    render(<ProfilePanel />);

    const mastery = screen.getByRole("heading", { name: "Mastery" });
    const recent = screen.getByRole("heading", { name: "Recent runs" });

    expect(screen.getByText(/recommended practice: selection/i)).toBeVisible();
    expect(screen.getByText("Navigation")).toBeVisible();
    expect(screen.getByText("Mixed Workflows")).toBeVisible();
    expect(mastery.compareDocumentPosition(recent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

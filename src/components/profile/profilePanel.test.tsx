import { render, screen, within } from "@testing-library/react";
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
    expect(screen.getByText("No runs yet. Play one.")).toBeVisible();
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

    // Bests by mode, with human labels. Scoped to its own table: "Speed" is now a mode label in the
    // recent-runs table too, and an unscoped query would match both.
    const bests = within(screen.getByTestId("bests-by-mode"));

    expect(bests.getByRole("cell", { name: "Speed" })).toBeVisible();
    expect(bests.getByRole("cell", { name: "1,450" })).toBeVisible();
    expect(bests.getByRole("cell", { name: "1.82s" })).toBeVisible();

    // Recent runs, newest first, with the PR badge. The challenge column now reads the record's own
    // family and difficulty rather than looking the title up in a table (§8.3).
    const history = screen.getByTestId("recent-runs");
    expect(history).toHaveTextContent("Sprint 5");
    expect(history).toHaveTextContent("selection");
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

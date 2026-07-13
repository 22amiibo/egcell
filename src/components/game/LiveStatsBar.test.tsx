import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LiveStatsBar } from "@/components/game/LiveStatsBar";

const props = {
  startedAt: null,
  frozenElapsedMs: 30_000,
  actions: 25,
  shortcutActions: 20,
  mistakes: 2,
  completedTasks: 10,
  totalTasks: 10,
  pbMs: 32_000,
};

describe("LiveStatsBar", () => {
  it("shows fixed live pace, accuracy, shortcut efficiency, and progress cells", () => {
    render(<LiveStatsBar {...props} />);

    expect(screen.getByTestId("live-stats-bar")).toBeInTheDocument();
    expect(screen.getByText("EPM").nextElementSibling).toHaveTextContent("20");
    expect(screen.getByText("Accuracy").nextElementSibling).toHaveTextContent("92%");
    expect(screen.getByText("Shortcuts").nextElementSibling).toHaveTextContent("80%");
    expect(screen.getByText("Progress").nextElementSibling).toHaveTextContent("10 / 10");

    for (const cell of screen.getAllByTestId("live-stat-cell")) {
      expect(cell).toHaveClass("min-w-20");
    }
  });

  it("renders nothing when live stats are disabled", () => {
    render(<LiveStatsBar {...props} enabled={false} />);

    expect(screen.queryByTestId("live-stats-bar")).not.toBeInTheDocument();
  });
});

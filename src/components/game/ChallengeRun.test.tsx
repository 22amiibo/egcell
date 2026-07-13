import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChallengeRun } from "@/components/game/ChallengeRun";
import { TaskProgressRail } from "@/components/game/TaskProgressRail";
import { formattingBoldHeaderChallenge } from "@/data/challenges";
import type { PersonalRecord } from "@/domain/records/recordTypes";
import type { LocalPersonalRecords } from "@/hooks/useLocalPersonalRecords";

const records: LocalPersonalRecords = {
  records: {},
  getBest: vi.fn(() => undefined),
  submit: vi.fn((candidate: PersonalRecord) => ({
    previousBest: undefined,
    currentBest: candidate,
    isNewRecord: true,
  })),
};

describe("ChallengeRun practice frame", () => {
  it("keeps the prompt, stats, grid, and toolbar in a stable game-first hierarchy", () => {
    render(
      <ChallengeRun
        challenge={formattingBoldHeaderChallenge}
        mode="main-speed"
        records={records}
        onNext={vi.fn()}
      />,
    );

    const frame = screen.getByTestId("practice-frame");
    const prompt = screen.getByTestId("prompt-rail");
    const stats = screen.getByTestId("live-stats-bar");
    const grid = screen.getByTestId("spreadsheet-grid");
    const toolbar = screen.getByRole("toolbar", { name: "Spreadsheet tools" });
    const timer = screen.getByTestId("timer");

    expect(frame).toContainElement(prompt);
    expect(frame).toContainElement(stats);
    expect(frame).toContainElement(grid);
    expect(frame).toContainElement(toolbar);
    expect(timer).toHaveClass("min-w-24", "text-right");
    expect(prompt.compareDocumentPosition(stats)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(stats.compareDocumentPosition(grid)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(grid.compareDocumentPosition(toolbar)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("turns keyboard run events into shortcut and combo feedback without leaving the grid stage", () => {
    render(
      <ChallengeRun
        challenge={formattingBoldHeaderChallenge}
        mode="main-speed"
        records={records}
        onNext={vi.fn()}
      />,
    );

    const grid = screen.getByTestId("spreadsheet-grid");
    const layer = screen.getByTestId("run-feedback-layer");

    expect(layer).toHaveAttribute("data-event", "taskAppear");
    expect(screen.getByTestId("grid-stage")).toContainElement(layer);

    fireEvent.keyDown(grid, { key: "ArrowDown" });

    expect(layer).toHaveAttribute("data-event", "shortcut");
    expect(screen.getByTestId("shortcut-flash")).toHaveTextContent("Arrow key");

    fireEvent.keyDown(grid, { key: "ArrowRight" });

    expect(screen.getByTestId("combo-indicator")).toHaveTextContent("2 streak");
  });
});

describe("TaskProgressRail", () => {
  it("announces fixed task progress without changing width", () => {
    render(<TaskProgressRail currentTask={2} completedTasks={1} totalTasks={5} />);

    expect(screen.getByTestId("task-progress-rail")).toHaveClass("min-w-44");
    expect(screen.getByRole("progressbar", { name: "Session progress" })).toHaveAttribute(
      "aria-valuenow",
      "1",
    );
    expect(screen.getByText("Task 2 / 5")).toBeVisible();
  });
});

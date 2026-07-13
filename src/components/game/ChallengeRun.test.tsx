import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChallengeRun } from "@/components/game/ChallengeRun";
import { TaskProgressRail } from "@/components/game/TaskProgressRail";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
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

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it("plays a synthesized cue only after sound is enabled", async () => {
    const oscillator = {
      type: "sine" as OscillatorType,
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    const gain = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };
    const AudioContextMock = vi.fn(function MockAudioContext() {
      return {
        state: "running",
        currentTime: 0,
        destination: {},
        createOscillator: () => oscillator,
        createGain: () => gain,
        resume: vi.fn(),
      };
    });

    vi.stubGlobal("AudioContext", AudioContextMock);

    render(
      <>
        <SettingsPanel />
        <ChallengeRun
          challenge={formattingBoldHeaderChallenge}
          mode="main-speed"
          records={records}
          onNext={vi.fn()}
        />
      </>,
    );

    await userEvent.click(screen.getByRole("tab", { name: "Sound" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Sound" }));
    fireEvent.keyDown(screen.getByTestId("spreadsheet-grid"), { key: "ArrowDown" });

    await waitFor(() => expect(AudioContextMock).toHaveBeenCalledOnce());
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

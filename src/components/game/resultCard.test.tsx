import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ResultCard } from "@/components/game/ResultCard";
import { SessionResultCard } from "@/components/game/SessionResultCard";
import { defaultChallenge } from "@/data/challenges";
import { buildRunResult } from "@/domain/runs/runResult";
import { scoreRun } from "@/domain/scoring/scoreRun";
import type { SessionResult } from "@/domain/sessions/sessionTypes";
import type { FinishedRun } from "@/hooks/useGameRun";

function finishedRun(overrides: Partial<FinishedRun> = {}): FinishedRun {
  const score = scoreRun({
    elapsedMs: 3000,
    correctness: 1,
    completionPercent: 1,
    accuracy: 1,
    basePoints: 1000,
    targetSeconds: 8,
  });

  return {
    validation: {
      isComplete: true,
      correctness: 1,
      completionPercent: 1,
      accuracy: 1,
      messages: [],
    },
    assist: "none",
    score,
    elapsedMs: 3000,
    previousBest: undefined,
    isNewRecord: false,
    submission: buildRunResult({
      challengeId: defaultChallenge.id,
      challengeVersion: defaultChallenge.version,
      seed: defaultChallenge.seed,
      mode: "main-speed",
      score: score.score,
      correctness: 1,
      completionPercent: 1,
      accuracy: 1,
      startedAtMs: 1_000_000,
      finishedAtMs: 1_003_000,
      // Every event carries the command that produced it, as every live input path has minted since
      // Phase 1. Without one the card cannot compare a route, and says so instead of guessing.
      events: [
        {
          atMs: 250,
          inputMethod: "pointer",
          via: "grid",
          command: "CLICK_CELL",
          action: { kind: "select-cell", cell: { row: 1, col: 1 } },
        },
        {
          atMs: 800,
          inputMethod: "keyboard",
          via: "shortcut",
          command: "MOVE_RIGHT",
          action: { kind: "select-cell", cell: { row: 1, col: 2 } },
        },
        {
          atMs: 1200,
          inputMethod: "keyboard",
          via: "shortcut",
          command: "SELECT_COLUMN",
          action: { kind: "select-column", col: 2, usedRangeOnly: true },
        },
      ],
    }),
    ...overrides,
  };
}

function sessionResult(): SessionResult {
  return {
    mode: "sprint-5",
    totalScore: 4200,
    totalElapsedMs: 41_000,
    tasksCompleted: 5,
    taskCount: 5,
    completionPercent: 1,
    accuracy: 1,
    finishedAt: "2026-07-13T00:00:00.000Z",
    tasks: [
      {
        challengeId: defaultChallenge.id,
        challengeVersion: defaultChallenge.version,
        title: defaultChallenge.title,
        outcome: "completed",
        elapsedMs: 4000,
        score: 900,
        correctness: 1,
        completionPercent: 1,
        accuracy: 1,
      },
    ],
  };
}

describe("the single-run result card", () => {
  it("shows replay-driving metrics, the fastest path, and leaves retry focused", () => {
    render(
      <ResultCard
        challenge={defaultChallenge}
        mode="main-speed"
        run={finishedRun({
          previousBest: {
            challengeId: defaultChallenge.id,
            mode: "main-speed",
            bestScore: 1000,
            bestElapsedMs: 3500,
            bestCorrectness: 1,
            achievedAt: "2026-07-01T00:00:00.000Z",
            seed: defaultChallenge.seed,
          },
        })}
        onRetry={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    expect(screen.getByText("EPM")).toBeVisible();
    expect(screen.getByText("Shortcut efficiency")).toBeVisible();
    expect(screen.getByText("PB delta")).toBeVisible();
    // What used to be a guessed "Retry focused: replace pointer actions with shortcuts" is now the
    // solver's answer: the actual fastest route for this drill, and how this run compared to it.
    expect(screen.getByTestId("fastest-path")).toBeVisible();
    expect(screen.getByText("Optimal actions")).toBeVisible();
    expect(screen.getByRole("button", { name: /retry/i })).toHaveFocus();
  });

  it("wears the badge on a new record, and only then", () => {
    const { rerender } = render(
      <ResultCard
        challenge={defaultChallenge}
        mode="main-speed"
        run={finishedRun({ isNewRecord: true })}
        onRetry={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    expect(screen.getByTestId("pr-badge")).toBeVisible();

    rerender(
      <ResultCard
        challenge={defaultChallenge}
        mode="main-speed"
        run={finishedRun({ isNewRecord: false })}
        onRetry={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("pr-badge")).not.toBeInTheDocument();
  });

  it("keeps the two-second read above the fold: time, score, correctness, accuracy", () => {
    render(
      <ResultCard
        challenge={defaultChallenge}
        mode="main-speed"
        run={finishedRun()}
        onRetry={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    expect(screen.getByTestId("final-time")).toBeVisible();
    expect(screen.getByTestId("score")).toBeVisible();
    expect(screen.getByText("Correctness")).toBeVisible();
    expect(screen.getByText("Accuracy")).toBeVisible();

    // The deep numbers stay behind the disclosure.
    expect(screen.getByText("Speed multiplier")).not.toBeVisible();
    expect(screen.getByText("Run digest")).not.toBeVisible();
  });
});

describe("the record line", () => {
  it("never claims a time beat when the record fell to a higher score on a slower run", () => {
    render(
      <ResultCard
        challenge={defaultChallenge}
        mode="main-speed"
        run={finishedRun({
          isNewRecord: true,
          elapsedMs: 5000,
          previousBest: {
            challengeId: defaultChallenge.id,
            mode: "main-speed",
            bestScore: 500,
            bestElapsedMs: 2000,
            bestCorrectness: 1,
            achievedAt: "2026-07-01T00:00:00.000Z",
            seed: defaultChallenge.seed,
          },
        })}
        onRetry={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    const line = screen.getByTestId("pr-line");

    expect(line).toHaveTextContent("points beats the old");
    expect(line.textContent).not.toContain("-");
  });

  it("describes a tiebreak session record as a tiebreak, not a zero-point beat", () => {
    render(
      <SessionResultCard
        result={sessionResult()}
        previousBest={{
          mode: "sprint-5",
          difficulty: 2,
          bestScore: 4200,
          bestElapsedMs: 45_000,
          bestTasksCompleted: 5,
          achievedAt: "2026-07-01T00:00:00.000Z",
        }}
        isNewRecord={true}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByTestId("session-pr-line")).toHaveTextContent("won on the tiebreak");
  });
});

describe("the session result card", () => {
  it("shows pace, shortcut efficiency, and the slowest task before the breakdown", () => {
    render(
      <SessionResultCard
        result={{
          ...sessionResult(),
          totalElapsedMs: 9000,
          tasks: [
            sessionResult().tasks[0],
            {
              ...sessionResult().tasks[0],
              challengeId: "formatting.currency.v1",
              title: "Format currency",
              elapsedMs: 5000,
              score: 700,
            },
          ],
          tasksCompleted: 2,
          taskCount: 2,
        }}
        previousBest={undefined}
        isNewRecord={false}
        liveStats={{
          elapsedMs: 9000,
          epm: 13,
          accuracy: 90,
          shortcutEfficiency: 75,
          combo: 4,
          mistakes: 1,
          completedTasks: 2,
          totalTasks: 2,
          pbDeltaMs: null,
        }}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("Average task")).toBeVisible();
    expect(screen.getByText("Fastest task")).toBeVisible();
    expect(screen.getByText("Shortcut efficiency")).toBeVisible();
    expect(screen.getByText(/slowest task: format currency/i)).toBeVisible();
  });

  it("wears the badge on a new session record", () => {
    render(
      <SessionResultCard
        result={sessionResult()}
        previousBest={undefined}
        isNewRecord={true}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByTestId("pr-badge")).toBeVisible();
    expect(screen.getByTestId("session-final-time")).toBeVisible();
    expect(screen.getByTestId("session-score")).toBeVisible();

    // The per-task breakdown is there, behind the disclosure.
    expect(screen.getByText(`1. ${defaultChallenge.title}`)).not.toBeVisible();
  });

  it("names completed and unfinished subgoals in the task breakdown", () => {
    render(
      <SessionResultCard
        result={{
          ...sessionResult(),
          mode: "timed-30",
          tasksCompleted: 0,
          taskCount: 1,
          completionPercent: 0.5,
          tasks: [
            {
              ...sessionResult().tasks[0],
              outcome: "expired",
              completionPercent: 0.5,
              subgoals: [
                { label: "Sort Revenue", isComplete: true, completionPercent: 1 },
                { label: "Bold the headers", isComplete: false, completionPercent: 0 },
              ],
            },
          ],
        }}
        previousBest={undefined}
        isNewRecord={false}
        onRetry={vi.fn()}
      />,
    );

    screen.getByText("Task breakdown").click();

    expect(screen.getByText("Sort Revenue — done")).toBeVisible();
    expect(screen.getByText("Bold the headers — unfinished")).toBeVisible();
  });
});

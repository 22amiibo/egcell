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
      events: [],
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

describe("the session result card", () => {
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
});

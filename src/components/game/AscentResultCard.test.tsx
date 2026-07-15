import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AscentResultCard } from "@/components/game/AscentResultCard";
import type { AscentResult } from "@/domain/ascent/ascentResult";
import type { AscentRecord } from "@/domain/records/ascentRecords";

function result(overrides: Partial<AscentResult> = {}): AscentResult {
  return {
    durationSeconds: 90,
    totalScore: 12_400,
    tasksCompleted: 18,
    peakTier: 4,
    overdriveRungs: 2,
    wpm: 62,
    keystrokeAccuracy: 0.97,
    finishedAt: "2026-07-14T00:00:00.000Z",
    ...overrides,
  };
}

function record(overrides: Partial<AscentRecord> = {}): AscentRecord {
  return {
    durationSeconds: 90,
    bestScore: 10_000,
    peakTierAtBest: 3,
    bestTasksCompleted: 15,
    bestPeakTier: 3,
    achievedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("AscentResultCard", () => {
  it("headlines the peak tier and tasks, with the score right under it", () => {
    render(
      <AscentResultCard
        result={result()}
        previousBest={undefined}
        isNewRecord={false}
        bestStreak={3}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByTestId("ascent-result-card")).toBeVisible();
    expect(screen.getByText("Peak tier")).toBeVisible();
    expect(screen.getByTestId("ascent-peak-tier")).toHaveTextContent("4");
    expect(screen.getByTestId("ascent-tasks")).toHaveTextContent("18 tasks completed");
    expect(screen.getByTestId("ascent-score")).toHaveTextContent("12,400 points");
    expect(screen.getByText("Best streak")).toBeVisible();
  });

  it("shows WPM and accuracy when the climb typed", () => {
    render(
      <AscentResultCard
        result={result({ wpm: 62, keystrokeAccuracy: 0.97 })}
        previousBest={undefined}
        isNewRecord={false}
        bestStreak={0}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("WPM")).toBeVisible();
    expect(screen.getByText("Accuracy")).toBeVisible();
    expect(screen.getByText("62")).toBeVisible();
    expect(screen.getByText("97%")).toBeVisible();
  });

  it("hides the WPM and accuracy rows entirely for a climb that never typed", () => {
    render(
      <AscentResultCard
        result={result({ wpm: null, keystrokeAccuracy: null })}
        previousBest={undefined}
        isNewRecord={false}
        bestStreak={0}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.queryByText("WPM")).not.toBeInTheDocument();
    expect(screen.queryByText("Accuracy")).not.toBeInTheDocument();
  });

  it("wears the badge and names a first record when there is no previous best", () => {
    render(
      <AscentResultCard
        result={result()}
        previousBest={undefined}
        isNewRecord={true}
        bestStreak={5}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByTestId("pr-badge")).toBeVisible();
    expect(screen.getByTestId("ascent-pr-line")).toHaveTextContent("First personal record");
  });

  it("wears the badge and beats the old score when a previous best falls", () => {
    render(
      <AscentResultCard
        result={result()}
        previousBest={record({ bestScore: 9_000 })}
        isNewRecord={true}
        bestStreak={5}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByTestId("pr-badge")).toBeVisible();
    expect(screen.getByTestId("ascent-pr-line")).toHaveTextContent("Beat 9,000 points");
  });

  it("names the book's best and wears no badge when this run did not win", () => {
    render(
      <AscentResultCard
        result={result({ totalScore: 1_000, peakTier: 2 })}
        previousBest={record({ bestScore: 10_000, bestPeakTier: 5 })}
        isNewRecord={false}
        bestStreak={0}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("pr-badge")).not.toBeInTheDocument();
    // The book's number, not this run's — a weaker climb still says what it would take to win.
    expect(screen.getByTestId("ascent-pr-line")).toHaveTextContent("T5");
    expect(screen.getByTestId("ascent-pr-line")).toHaveTextContent("10,000 points");
    // And this run's own (lower) peak is still what the headline reports.
    expect(screen.getByTestId("ascent-peak-tier")).toHaveTextContent("2");
  });

  it("shows nothing beyond the badge on a duration's first-ever climb", () => {
    render(
      <AscentResultCard
        result={result()}
        previousBest={undefined}
        isNewRecord={false}
        bestStreak={0}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("ascent-pr-line")).not.toBeInTheDocument();
    expect(screen.queryByTestId("pr-badge")).not.toBeInTheDocument();
  });

  it("calls onRetry from a focused retry button", () => {
    const onRetry = vi.fn();

    render(
      <AscentResultCard
        result={result()}
        previousBest={undefined}
        isNewRecord={false}
        bestStreak={0}
        onRetry={onRetry}
      />,
    );

    const button = screen.getByRole("button", { name: /retry/i });

    expect(button).toHaveFocus();
    button.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

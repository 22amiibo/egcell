import { describe, expect, it } from "vitest";

import { buildSessionResult } from "@/domain/sessions/sessionResult";
import type { SessionTaskResult } from "@/domain/sessions/sessionTypes";

function task(overrides: Partial<SessionTaskResult> = {}): SessionTaskResult {
  return {
    challengeId: "selection.revenue-column",
    challengeVersion: "v1",
    title: "Select the Revenue column",
    outcome: "completed",
    elapsedMs: 3000,
    score: 1000,
    correctness: 1,
    completionPercent: 1,
    accuracy: 1,
    ...overrides,
  };
}

describe("buildSessionResult", () => {
  it("sums scores and counts completed tasks", () => {
    const result = buildSessionResult({
      mode: "sprint-5",
      tasks: [
        task({ score: 1000 }),
        task({ score: 800 }),
        task({ score: 1200 }),
        task({ score: 900 }),
        task({ score: 1100 }),
      ],
      totalElapsedMs: 42_000,
      finishedAtMs: Date.UTC(2026, 6, 13),
    });

    expect(result.totalScore).toBe(5000);
    expect(result.tasksCompleted).toBe(5);
    expect(result.taskCount).toBe(5);
    expect(result.completionPercent).toBe(1);
    expect(result.totalElapsedMs).toBe(42_000);
  });

  it("counts a skipped task against completion, and pays only its partial score", () => {
    const result = buildSessionResult({
      mode: "sprint-5",
      tasks: [
        task(),
        task(),
        task({ outcome: "skipped", score: 120, correctness: 0.4, completionPercent: 0.4 }),
        task(),
        task(),
      ],
      totalElapsedMs: 50_000,
      finishedAtMs: Date.UTC(2026, 6, 13),
    });

    expect(result.tasksCompleted).toBe(4);
    expect(result.taskCount).toBe(5);
    expect(result.totalScore).toBe(4120);
    // Four full tasks and one at 0.4, over the planned five.
    expect(result.completionPercent).toBeCloseTo(4.4 / 5);
  });

  it("judges a sprint against its planned length even when it somehow holds fewer rows", () => {
    const result = buildSessionResult({
      mode: "sprint-10",
      tasks: [task(), task()],
      totalElapsedMs: 9_000,
      finishedAtMs: Date.UTC(2026, 6, 13),
    });

    expect(result.taskCount).toBe(10);
    expect(result.completionPercent).toBeCloseTo(0.2);
  });

  it("judges a timed run against what was actually attempted", () => {
    const result = buildSessionResult({
      mode: "timed-30",
      tasks: [task(), task(), task({ outcome: "expired", score: 0, completionPercent: 0 })],
      totalElapsedMs: 30_000,
      finishedAtMs: Date.UTC(2026, 6, 13),
    });

    expect(result.taskCount).toBe(3);
    expect(result.tasksCompleted).toBe(2);
    expect(result.completionPercent).toBeCloseTo(2 / 3);
  });

  it("survives an empty timed run without dividing by zero", () => {
    const result = buildSessionResult({
      mode: "timed-30",
      tasks: [],
      totalElapsedMs: 30_000,
      finishedAtMs: Date.UTC(2026, 6, 13),
    });

    expect(result.taskCount).toBe(0);
    expect(result.completionPercent).toBe(0);
    expect(result.accuracy).toBe(1);
    expect(result.totalScore).toBe(0);
  });
});

import { describe, expect, it } from "vitest";

import { calculateLiveRunStats } from "@/domain/stats/liveRunStats";

describe("calculateLiveRunStats", () => {
  it("calculates pace, accuracy, shortcut efficiency, progress, and PB delta", () => {
    expect(
      calculateLiveRunStats({
        elapsedMs: 30_000,
        actions: 25,
        shortcutActions: 20,
        mistakes: 2,
        completedTasks: 10,
        totalTasks: 10,
        pbMs: 32_000,
        combo: 5,
      }),
    ).toMatchObject({
      elapsedMs: 30_000,
      epm: 20,
      accuracy: 92,
      shortcutEfficiency: 80,
      combo: 5,
      mistakes: 2,
      completedTasks: 10,
      totalTasks: 10,
      pbDeltaMs: -2_000,
    });
  });

  it("returns stable starting values before the first meaningful action", () => {
    expect(
      calculateLiveRunStats({
        elapsedMs: 0,
        actions: 0,
        shortcutActions: 0,
        mistakes: 0,
        completedTasks: 0,
        totalTasks: 1,
        pbMs: null,
        combo: 0,
      }),
    ).toEqual({
      elapsedMs: 0,
      epm: 0,
      accuracy: 100,
      shortcutEfficiency: 0,
      combo: 0,
      mistakes: 0,
      completedTasks: 0,
      totalTasks: 1,
      pbDeltaMs: null,
    });
  });

  it("clamps malformed counters to meaningful display ranges", () => {
    expect(
      calculateLiveRunStats({
        elapsedMs: -100,
        actions: 4,
        shortcutActions: 8,
        mistakes: 10,
        completedTasks: -2,
        totalTasks: -1,
        pbMs: -50,
        combo: -5,
      }),
    ).toMatchObject({
      elapsedMs: 0,
      epm: 0,
      accuracy: 0,
      shortcutEfficiency: 100,
      combo: 0,
      mistakes: 10,
      completedTasks: 0,
      totalTasks: 0,
      pbDeltaMs: null,
    });
  });

  it("passes the driver's streak through instead of deriving one", () => {
    const stats = calculateLiveRunStats({
      elapsedMs: 10_000,
      actions: 12,
      shortcutActions: 8,
      mistakes: 1,
      completedTasks: 2,
      totalTasks: 5,
      pbMs: null,
      combo: 3,
    });

    expect(stats.combo).toBe(3);
  });
});

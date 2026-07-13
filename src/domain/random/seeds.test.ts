import { describe, expect, it } from "vitest";

import { createNewSessionSeed, dailySeed, queueSeed, taskSeed } from "@/domain/random/seeds";

describe("seed composition", () => {
  it("composes a queue seed as a stable canonical string", () => {
    expect(queueSeed("sprint-5", 2, "1732")).toBe("q:sprint-5:d2:1732");
  });

  it("derives task seeds from the queue seed, so one queue seed pins every task", () => {
    const queue = queueSeed("timed-30", 3, "abc");

    expect(taskSeed(queue, 0)).toBe("q:timed-30:d3:abc:t0");
    expect(taskSeed(queue, 7)).toBe("q:timed-30:d3:abc:t7");
  });

  it("gives each calendar date one daily seed", () => {
    expect(dailySeed("2026-07-13")).toBe("daily:2026-07-13");
  });

  it("uses a browser UUID when one is available", () => {
    expect(
      createNewSessionSeed({
        randomUUID: () => "123e4567-e89b-12d3-a456-426614174000",
        now: () => 1,
        random: () => 0.1,
      }),
    ).toBe("123e4567-e89b-12d3-a456-426614174000");
  });

  it("falls back to injected time and random values when UUID generation is unavailable", () => {
    expect(
      createNewSessionSeed({
        randomUUID: null,
        now: () => 1_783_976_400_000,
        random: () => 0.25,
      }),
    ).toBe("session:mrjphk00:9:9");
  });
});

import { describe, expect, it } from "vitest";

import { buildNormalSpeedQueue, NORMAL_SPEED_QUEUE_SIZE } from "@/data/challenges/queue";

describe("normal speed queue binding", () => {
  it("builds the same task sequence for the same explicit session seed", () => {
    const first = buildNormalSpeedQueue("abc");
    const second = buildNormalSpeedQueue("abc");

    expect(first).toEqual(second);
    expect(first.seed).toBe(`q:main-speed:d2:abc`);
    expect(first.tasks).toHaveLength(NORMAL_SPEED_QUEUE_SIZE);
  });

  it("builds different task sequences for different explicit session seeds", () => {
    const signature = (seed: string) =>
      buildNormalSpeedQueue(seed).tasks.map((task) => ({
        templateId: task.variant.templateId,
        prompt: task.variant.prompt,
        dimensions: task.variant.dimensions,
      }));

    expect(signature("abc")).not.toEqual(signature("def"));
  });

  it("the normal Speed queue spans at least three difficulties", () => {
    const queue = buildNormalSpeedQueue("run-seed");
    const difficulties = new Set(queue.tasks.map((task) => task.variant.difficulty));

    expect(difficulties.size).toBeGreaterThanOrEqual(3);
  });
});

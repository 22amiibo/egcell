import { describe, expect, it } from "vitest";

import { generatedTemplates } from "@/data/challenges/generated";
import { DATASET_THEMES } from "@/data/datasets/themes";
import { buildTaskQueue } from "@/domain/queue/buildTaskQueue";
import type { TaskQueue, TaskQueueRequest } from "@/domain/queue/queueTypes";

function build(request: Partial<TaskQueueRequest> & Pick<TaskQueueRequest, "mode" | "seed">): TaskQueue {
  return buildTaskQueue({
    request: { difficulty: 2, ...request },
    templates: generatedTemplates,
    themes: DATASET_THEMES,
  });
}

describe("buildTaskQueue", () => {
  it("returns the same queue for the same seed", () => {
    const a = build({ mode: "sprint", seed: "q:sprint-5:d2:det", taskCount: 10 });
    const b = build({ mode: "sprint", seed: "q:sprint-5:d2:det", taskCount: 10 });

    expect(a).toEqual(b);
  });

  it("returns different queues for different seeds", () => {
    const a = build({ mode: "sprint", seed: "q:sprint-5:d2:one", taskCount: 10 });
    const b = build({ mode: "sprint", seed: "q:sprint-5:d2:two", taskCount: 10 });

    expect(a.tasks.map((task) => task.variant.seed)).not.toEqual(
      b.tasks.map((task) => task.variant.seed),
    );
  });

  it("fills a sprint to exactly its task count", () => {
    expect(build({ mode: "sprint", seed: "count-5", taskCount: 5 }).tasks).toHaveLength(5);
    expect(build({ mode: "sprint", seed: "count-10", taskCount: 10 }).tasks).toHaveLength(10);
  });

  it("never repeats a template three times in a row", () => {
    for (let draw = 0; draw < 10; draw += 1) {
      const queue = build({ mode: "sprint", seed: `consecutive-${draw}`, taskCount: 10 });
      const ids = queue.tasks.map((task) => task.variant.templateId);

      for (let i = 2; i < ids.length; i += 1) {
        expect(ids[i] === ids[i - 1] && ids[i] === ids[i - 2]).toBe(false);
      }
    }
  });

  it("mixes families across a ten-task sprint", () => {
    for (let draw = 0; draw < 5; draw += 1) {
      const queue = build({ mode: "sprint", seed: `families-${draw}`, taskCount: 10 });
      const families = new Set(queue.tasks.map((task) => task.variant.family));

      expect(families.size).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps a session on at most two dataset themes", () => {
    for (let draw = 0; draw < 5; draw += 1) {
      const queue = build({ mode: "sprint", seed: `themes-${draw}`, taskCount: 10 });
      const themes = new Set(queue.tasks.map((task) => task.variant.dimensions.themeId));

      expect(themes.size).toBeLessThanOrEqual(2);
    }
  });

  it("gives a timed queue only tasks that fit the clock, with overshoot to spare", () => {
    const queue = build({ mode: "timed", seed: "timed-fit", durationSeconds: 30 });

    expect(queue.tasks.length).toBeGreaterThanOrEqual(Math.ceil(30 / 4));

    for (const task of queue.tasks) {
      expect(task.variant.scoring.targetSeconds).toBeLessThanOrEqual(12);
      expect(task.variant.timedEligible).toBe(true);
    }
  });

  it("respects a practice family restriction", () => {
    const queue = build({
      mode: "practice",
      seed: "practice-nav",
      taskCount: 6,
      families: ["navigation"],
    });

    expect(queue.tasks.length).toBeGreaterThan(0);

    for (const task of queue.tasks) {
      expect(task.variant.family).toBe("navigation");
    }
  });

  it("keeps total target time comparable across seeds at one difficulty", () => {
    const totals = Array.from({ length: 6 }, (_, draw) =>
      build({ mode: "sprint", seed: `band-${draw}`, taskCount: 5 }).tasks.reduce(
        (sum, task) => sum + task.variant.scoring.targetSeconds,
        0,
      ),
    );

    // A sprint score is comparable across draws only if the queues are comparable work. The band
    // is deliberately wide for now; Phase I tightens the per-template targets.
    for (const total of totals) {
      expect(total).toBeGreaterThanOrEqual(20);
      expect(total).toBeLessThanOrEqual(60);
    }

    expect(Math.max(...totals) - Math.min(...totals)).toBeLessThanOrEqual(25);
  });

  it("terminates and fills the queue even on a two-template pool", () => {
    const queue = buildTaskQueue({
      request: { mode: "sprint", seed: "tiny-pool", difficulty: 2, taskCount: 10 },
      templates: generatedTemplates.slice(0, 2),
      themes: DATASET_THEMES,
    });

    expect(queue.tasks).toHaveLength(10);
  });
});

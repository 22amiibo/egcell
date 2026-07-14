import { describe, expect, it } from "vitest";

import {
  SESSION_RECORDS_KEY,
  betterSessionRecord,
  readSessionRecords,
  updateSessionRecords,
  writeSessionRecords,
  type SessionRecord,
} from "@/domain/sessions/sessionRecords";
import { createMemoryJsonStorage } from "@/lib/storage";

function record(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    mode: "sprint-5",
    difficulty: 2,
    bestScore: 4000,
    bestElapsedMs: 40_000,
    bestTasksCompleted: 5,
    achievedAt: "2026-07-13T00:00:00.000Z",
    ...overrides,
  };
}

describe("SESSION_RECORDS_KEY", () => {
  it("moved to v3 when the combo changed the race", () => {
    expect(SESSION_RECORDS_KEY).toBe("excel-speed-trainer:v3:session-records");
  });
});

describe("betterSessionRecord", () => {
  it("prefers the higher score", () => {
    const incumbent = record({ bestScore: 4000 });
    const challenger = record({ bestScore: 4500, bestElapsedMs: 60_000 });

    expect(betterSessionRecord(incumbent, challenger)).toBe(challenger);
    expect(betterSessionRecord(challenger, incumbent)).toBe(challenger);
  });

  it("breaks a score tie toward more tasks completed, then toward the faster time", () => {
    const fewerTasks = record({ bestTasksCompleted: 4 });
    const moreTasks = record({ bestTasksCompleted: 5 });

    expect(betterSessionRecord(fewerTasks, moreTasks)).toBe(moreTasks);

    const slower = record({ bestElapsedMs: 50_000 });
    const faster = record({ bestElapsedMs: 45_000 });

    expect(betterSessionRecord(slower, faster)).toBe(faster);
  });

  it("keeps the incumbent on a full tie, so the achievedAt stamp does not churn", () => {
    const incumbent = record({ achievedAt: "2026-07-01T00:00:00.000Z" });
    const replay = record({ achievedAt: "2026-07-13T00:00:00.000Z" });

    expect(betterSessionRecord(incumbent, replay)).toBe(incumbent);
  });

  it("accepts the first record unconditionally", () => {
    const first = record({ bestScore: 1 });

    expect(betterSessionRecord(undefined, first)).toBe(first);
  });
});

describe("session record storage", () => {
  it("keeps each mode's record apart", () => {
    let store = updateSessionRecords({}, record({ mode: "sprint-5", bestScore: 4000 }));
    store = updateSessionRecords(store, record({ mode: "sprint-10", bestScore: 9000 }));

    expect(store["sprint-5:d2"]?.bestScore).toBe(4000);
    expect(store["sprint-10:d2"]?.bestScore).toBe(9000);

    // A weaker sprint-10 run must not disturb sprint-5.
    store = updateSessionRecords(store, record({ mode: "sprint-10", bestScore: 100 }));

    expect(store["sprint-10:d2"]?.bestScore).toBe(9000);
    expect(store["sprint-5:d2"]?.bestScore).toBe(4000);
  });

  it("round-trips through storage", () => {
    const storage = createMemoryJsonStorage();
    const store = updateSessionRecords({}, record());

    writeSessionRecords(storage, store);

    expect(readSessionRecords(storage)).toEqual(store);
  });

  it("drops entries that do not look like session records", () => {
    const storage = createMemoryJsonStorage({
      [SESSION_RECORDS_KEY]: {
        "sprint-5": record(),
        "sprint-10": { mode: "sprint-10", bestScore: "not a number" },
        garbage: 42,
        "timed-30": {
          mode: "no-such-mode",
          bestScore: 1,
          bestElapsedMs: 1,
          bestTasksCompleted: 1,
          achievedAt: "x",
        },
      },
    });

    const store = readSessionRecords(storage);

    expect(store["sprint-5:d2"]).toBeDefined();
    expect(store["sprint-10:d2"]).toBeUndefined();
    expect(store["timed-30:d2"]).toBeUndefined();
  });

  it("returns an empty store when the stored value is not an object", () => {
    const storage = createMemoryJsonStorage({ [SESSION_RECORDS_KEY]: [1, 2, 3] });

    expect(readSessionRecords(storage)).toEqual({});
  });
});

import { describe, expect, it } from "vitest";

import {
  HISTORY_LIMIT,
  RUN_HISTORY_KEY,
  emptyProfile,
  readProfile,
  recordRun,
  writeProfile,
  type ProfileState,
  type RunHistoryEntry,
} from "@/domain/profile/runHistory";
import { createMemoryJsonStorage } from "@/lib/storage";

function entry(overrides: Partial<RunHistoryEntry> = {}): RunHistoryEntry {
  return {
    id: "run-1",
    at: "2026-07-13T00:00:00.000Z",
    modeKey: "main-speed",
    label: "Select the Revenue column",
    score: 1000,
    elapsedMs: 3000,
    completed: true,
    tasksCompleted: 1,
    isNewRecord: false,
    ...overrides,
  };
}

describe("recordRun", () => {
  it("prepends the newest run and counts the totals", () => {
    let profile = recordRun(emptyProfile(), entry({ id: "a" }));
    profile = recordRun(profile, entry({ id: "b", tasksCompleted: 5, modeKey: "sprint-5" }));

    expect(profile.entries.map((row) => row.id)).toEqual(["b", "a"]);
    expect(profile.totalRuns).toBe(2);
    expect(profile.totalTasksCompleted).toBe(6);
  });

  it("caps the list but keeps counting past the cap", () => {
    let profile = emptyProfile();

    for (let index = 0; index < HISTORY_LIMIT + 10; index += 1) {
      profile = recordRun(profile, entry({ id: `run-${index}` }));
    }

    expect(profile.entries).toHaveLength(HISTORY_LIMIT);
    expect(profile.entries[0].id).toBe(`run-${HISTORY_LIMIT + 9}`);
    expect(profile.totalRuns).toBe(HISTORY_LIMIT + 10);
  });

  it("tracks the best score and the best completed time per mode", () => {
    let profile = recordRun(emptyProfile(), entry({ score: 800, elapsedMs: 4000 }));
    profile = recordRun(profile, entry({ score: 1200, elapsedMs: 5000 }));
    profile = recordRun(profile, entry({ score: 600, elapsedMs: 2500 }));

    expect(profile.byMode["main-speed"].bestScore).toBe(1200);
    expect(profile.byMode["main-speed"].bestElapsedMs).toBe(2500);
    expect(profile.byMode["main-speed"].runs).toBe(3);
  });

  it("never lets an unfinished run hold the time record", () => {
    let profile = recordRun(emptyProfile(), entry({ elapsedMs: 9000 }));
    profile = recordRun(
      profile,
      entry({ completed: false, elapsedMs: 1000, score: 50, modeKey: "main-speed" }),
    );

    expect(profile.byMode["main-speed"].bestElapsedMs).toBe(9000);
    // The abandoned run still counts as a run, and its score still competes.
    expect(profile.byMode["main-speed"].runs).toBe(2);
  });

  it("keeps modes apart", () => {
    let profile = recordRun(emptyProfile(), entry({ modeKey: "main-speed", score: 900 }));
    profile = recordRun(profile, entry({ modeKey: "sprint-5", score: 4000 }));

    expect(profile.byMode["main-speed"].bestScore).toBe(900);
    expect(profile.byMode["sprint-5"].bestScore).toBe(4000);
  });
});

describe("profile storage", () => {
  it("round-trips", () => {
    const storage = createMemoryJsonStorage();
    const profile = recordRun(emptyProfile(), entry());

    writeProfile(storage, profile);

    expect(readProfile(storage)).toEqual(profile);
  });

  it("drops entries and mode stats that do not parse, and zeroes broken totals", () => {
    const storage = createMemoryJsonStorage({
      [RUN_HISTORY_KEY]: {
        entries: [entry(), { id: 42 }, "junk"],
        totalRuns: "many",
        totalTasksCompleted: 7,
        byMode: {
          "main-speed": { bestScore: "high" },
          "sprint-5": { bestScore: 1, bestElapsedMs: null, runs: 1 },
        },
      } as unknown as ProfileState,
    });

    const profile = readProfile(storage);

    expect(profile.entries).toHaveLength(1);
    expect(profile.totalRuns).toBe(0);
    expect(profile.totalTasksCompleted).toBe(7);
    expect(profile.byMode["main-speed"]).toBeUndefined();
    expect(profile.byMode["sprint-5"]).toBeDefined();
  });

  it("returns an empty profile when nothing is stored", () => {
    expect(readProfile(createMemoryJsonStorage())).toEqual(emptyProfile());
  });
});

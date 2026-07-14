import { describe, expect, it } from "vitest";

import {
  RUN_HISTORY_KEY,
  type ProfileState,
  type RunHistoryEntry,
} from "@/domain/profile/runHistory";
import {
  appendRun,
  emptyLog,
  readRunLog,
  selectByMode,
  selectEligibleForStats,
  selectRecentRuns,
  selectTotals,
  writeRunLog,
  type RunLog,
} from "@/domain/runs/runLog";
import {
  RUN_LOG_KEY,
  stampRunRecord,
  type NewRunRecord,
  type RunRecord,
} from "@/domain/runs/runRecord";
import { createMemoryJsonStorage } from "@/lib/storage";

const DAY_ONE = Date.parse("2026-07-01T10:00:00.000Z");

function newRecord(overrides: Partial<NewRunRecord> = {}): NewRunRecord {
  return {
    modeKey: "main-speed",
    label: "Select the Revenue column",
    challengeId: "selection.revenue-column",
    challengeVersion: "v1",
    templateId: null,
    family: "selection",
    difficulty: 2,
    seed: "seed",
    outcome: "completed",
    completed: true,
    tasksCompleted: 1,
    taskCount: 1,
    score: 1000,
    elapsedMs: 5000,
    targetMs: 6000,
    correctness: 1,
    accuracy: 1,
    actions: null,
    keyboardActions: null,
    shortcutActions: null,
    optimalActions: null,
    routeEfficiency: null,
    keyboardShare: null,
    routeId: null,
    assist: "none",
    integrity: "ok",
    isNewRecord: false,
    attempts: 0,
    eventDigest: null,
    ...overrides,
  };
}

function record(index: number, overrides: Partial<NewRunRecord> = {}): RunRecord {
  return stampRunRecord(newRecord(overrides), DAY_ONE + index * 60_000, `run-${index}`);
}

function logOf(...runs: RunRecord[]): RunLog {
  return { ...emptyLog(), runs };
}

function v1Entry(overrides: Partial<RunHistoryEntry> = {}): RunHistoryEntry {
  return {
    id: "old-1",
    at: "2026-07-01T10:00:00.000Z",
    modeKey: "main-speed",
    label: "Select the Revenue column",
    score: 900,
    elapsedMs: 7000,
    completed: true,
    tasksCompleted: 1,
    isNewRecord: true,
    ...overrides,
  };
}

function v1Profile(overrides: Partial<ProfileState> = {}): ProfileState {
  return {
    entries: [v1Entry()],
    totalRuns: 1,
    totalTasksCompleted: 1,
    byMode: {},
    ...overrides,
  };
}

describe("selectRecentRuns", () => {
  it("returns exactly 20 of 21, newest first — and the 21st is still in the log", () => {
    const log = logOf(...Array.from({ length: 21 }, (_, index) => record(index)));
    const recent = selectRecentRuns(log);

    expect(recent).toHaveLength(20);
    expect(recent[0].id).toBe("run-20");
    expect(recent.at(-1)?.id).toBe("run-1");
    // The row left the display window, not the log: the totals still see it.
    expect(log.runs).toHaveLength(21);
    expect(selectTotals(log).runs).toBe(21);
  });

  it("keeps assisted and failed runs, and drops only suspect ones", () => {
    const log = logOf(
      record(0),
      record(1, { assist: "revealed" }),
      record(2, { outcome: "failed", completed: false }),
      record(3, { integrity: "suspect" }),
    );

    expect(selectRecentRuns(log).map((run) => run.id)).toEqual(["run-2", "run-1", "run-0"]);
  });
});

describe("selectEligibleForStats", () => {
  it("excludes assisted, failed, and suspect runs, and includes legacy ones", () => {
    const legacy: RunRecord = { ...record(4), schemaVersion: 1 };
    const log = logOf(
      record(0),
      record(1, { assist: "revealed" }),
      record(2, { outcome: "failed", completed: false }),
      record(3, { integrity: "suspect" }),
      legacy,
    );

    expect(selectEligibleForStats(log, "speed").map((run) => run.id)).toEqual(["run-0", "run-4"]);
  });

  it("keeps the categories apart: a sprint never appears in the speed series", () => {
    const log = logOf(record(0), record(1, { modeKey: "sprint-5" }));

    expect(selectEligibleForStats(log, "speed").map((run) => run.id)).toEqual(["run-0"]);
    expect(selectEligibleForStats(log, "sprint-5").map((run) => run.id)).toEqual(["run-1"]);
  });
});

describe("selectTotals", () => {
  it("adds priorTotals, rollups, and runs with no double counting", () => {
    const log: RunLog = {
      version: 2,
      priorTotals: { runs: 87, tasksCompleted: 120 },
      priorByMode: {},
      rollups: [
        {
          day: "2026-06-01",
          categoryId: "speed",
          runs: 10,
          tasksCompleted: 10,
          meanScore: 900,
          bestScore: 1200,
        },
      ],
      runs: [record(0), record(1, { tasksCompleted: 5, taskCount: 5, modeKey: "sprint-5" })],
    };

    expect(selectTotals(log)).toEqual({ runs: 99, tasksCompleted: 136 });
  });

  it("counts an assisted run: how much you played is not what counts for a record", () => {
    expect(selectTotals(logOf(record(0), record(1, { assist: "revealed" }))).runs).toBe(2);
  });
});

describe("selectByMode", () => {
  it("carries v1's bests forward, so a record set by a run the 50-cap destroyed does not vanish", () => {
    // v1 folded `byMode` in as it went, so it outlived its own entry list: nine main-speed runs
    // were played, the best of them scoring 1450, and only one row survived the cap. Rebuilding the
    // table from the surviving rows alone would take that record away from the player.
    const storage = createMemoryJsonStorage({
      [RUN_HISTORY_KEY]: v1Profile({
        entries: [v1Entry({ id: "survivor", score: 980, elapsedMs: 2140 })],
        totalRuns: 9,
        totalTasksCompleted: 9,
        byMode: { "main-speed": { bestScore: 1450, bestElapsedMs: 1820, runs: 9 } },
      }),
    });

    const byMode = selectByMode(readRunLog(storage));

    expect(byMode["main-speed"]).toEqual({
      bestScore: 1450,
      bestElapsedMs: 1820,
      // Nine played, one of them now a row in the log: 8 carried + 1 folded. Never 10.
      runs: 9,
    });
  });

  it("keeps a best score per mode, and lets only a completed run hold the time record", () => {
    const log = logOf(
      record(0, { score: 1000, elapsedMs: 5000 }),
      record(1, { score: 1400, elapsedMs: 9000 }),
      record(2, { score: 200, elapsedMs: 100, outcome: "failed", completed: false }),
      record(3, { modeKey: "practice", score: 700, elapsedMs: 4000 }),
    );

    expect(selectByMode(log)).toEqual({
      "main-speed": { bestScore: 1400, bestElapsedMs: 5000, runs: 3 },
      practice: { bestScore: 700, bestElapsedMs: 4000, runs: 1 },
    });
  });
});

describe("readRunLog", () => {
  it("migrates the v1 history on first read, and leaves the v1 key on disk", () => {
    const storage = createMemoryJsonStorage({ [RUN_HISTORY_KEY]: v1Profile() });
    const log = readRunLog(storage);

    expect(log.runs).toHaveLength(1);
    expect(log.runs[0].schemaVersion).toBe(1);
    expect(log.runs[0].label).toBe("Select the Revenue column");
    // The backup is the point: v1 is never rewritten and never removed here (§9.5).
    expect(storage.read(RUN_HISTORY_KEY, null)).not.toBeNull();
  });

  it("preserves the totals the v1 50-cap destroyed", () => {
    const entries = Array.from({ length: 50 }, (_, index) =>
      v1Entry({ id: `old-${index}`, tasksCompleted: 1 }),
    );
    const storage = createMemoryJsonStorage({
      [RUN_HISTORY_KEY]: v1Profile({ entries, totalRuns: 137, totalTasksCompleted: 137 }),
    });

    const log = readRunLog(storage);

    expect(log.runs).toHaveLength(50);
    expect(log.priorTotals).toEqual({ runs: 87, tasksCompleted: 87 });
    // 87 destroyed + 50 imported = the 137 the player actually played. Nothing lost, nothing doubled.
    expect(selectTotals(log)).toEqual({ runs: 137, tasksCompleted: 137 });
  });

  it("maps an unknown mode to a null category, keeping the run out of every chart but in the log", () => {
    const storage = createMemoryJsonStorage({
      [RUN_HISTORY_KEY]: v1Profile({ entries: [v1Entry({ modeKey: "some-removed-mode" })] }),
    });

    const log = readRunLog(storage);

    expect(log.runs[0].categoryId).toBeNull();
    expect(selectRecentRuns(log)).toHaveLength(1);
    expect(selectEligibleForStats(log, "speed")).toHaveLength(0);
  });

  it("drops a v1 row whose timestamp will not parse", () => {
    const storage = createMemoryJsonStorage({
      [RUN_HISTORY_KEY]: v1Profile({
        entries: [v1Entry({ id: "good" }), v1Entry({ id: "bad", at: "not a date" })],
        totalRuns: 2,
        totalTasksCompleted: 2,
      }),
    });

    const log = readRunLog(storage);

    expect(log.runs.map((run) => run.id)).toEqual(["good"]);
  });

  it("is a no-op on the second read: the log key is itself the already-migrated flag", () => {
    const storage = createMemoryJsonStorage({ [RUN_HISTORY_KEY]: v1Profile() });

    const first = readRunLog(storage);
    writeRunLog(storage, first);
    const second = readRunLog(storage);

    expect(second).toEqual(first);
    expect(second.runs).toHaveLength(1);
  });

  it("survives a malformed blob, a malformed row, and an absent history alike", () => {
    expect(readRunLog(createMemoryJsonStorage({ [RUN_LOG_KEY]: "nonsense" }))).toEqual(emptyLog());
    expect(readRunLog(createMemoryJsonStorage())).toEqual(emptyLog());

    const withBadRow = createMemoryJsonStorage({
      [RUN_LOG_KEY]: { ...emptyLog(), runs: [record(0), { id: "broken" }] },
    });

    expect(readRunLog(withBadRow).runs.map((run) => run.id)).toEqual(["run-0"]);
  });
});

describe("appendRun", () => {
  it("appends chronologically, so the newest run lands on the end", () => {
    const log = appendRun(appendRun(emptyLog(), record(0)), record(1));

    expect(log.runs.map((run) => run.id)).toEqual(["run-0", "run-1"]);
    expect(selectRecentRuns(log)[0].id).toBe("run-1");
  });
});

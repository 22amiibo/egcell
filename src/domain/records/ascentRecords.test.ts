import { describe, expect, it } from "vitest";

import {
  ASCENT_RECORDS_KEY,
  ascentRecordKey,
  isNewAscentRecord,
  readAscentRecords,
  updateAscentRecords,
  writeAscentRecords,
  type AscentRecord,
} from "@/domain/records/ascentRecords";
import { createMemoryJsonStorage } from "@/lib/storage";

function record(overrides: Partial<AscentRecord> = {}): AscentRecord {
  return {
    durationSeconds: 90,
    bestScore: 4000,
    peakTierAtBest: 3,
    bestTasksCompleted: 12,
    bestPeakTier: 3,
    achievedAt: "2026-07-14T00:00:00.000Z",
    ...overrides,
  };
}

describe("ASCENT_RECORDS_KEY", () => {
  it("is the versioned ascent-records storage key", () => {
    expect(ASCENT_RECORDS_KEY).toBe("excel-speed-trainer:v1:ascent-records");
  });
});

describe("ascentRecordKey", () => {
  it("keys by durationSeconds alone, so a future duration picker never mixes races", () => {
    expect(ascentRecordKey(90)).toBe("ascent:90");
    expect(ascentRecordKey(180)).toBe("ascent:180");
  });
});

describe("updateAscentRecords", () => {
  it("inserts a new key unconditionally", () => {
    const store = updateAscentRecords({}, record());

    expect(store["ascent:90"]).toEqual(record());
  });

  it("prefers the higher score", () => {
    let store = updateAscentRecords({}, record({ bestScore: 4000, achievedAt: "incumbent" }));
    store = updateAscentRecords(
      store,
      record({ bestScore: 5000, achievedAt: "challenger" }),
    );

    expect(store["ascent:90"]?.bestScore).toBe(5000);
    expect(store["ascent:90"]?.achievedAt).toBe("challenger");
  });

  it("keeps the incumbent when the candidate scores lower", () => {
    let store = updateAscentRecords({}, record({ bestScore: 5000, achievedAt: "incumbent" }));
    store = updateAscentRecords(store, record({ bestScore: 4000, achievedAt: "challenger" }));

    expect(store["ascent:90"]?.bestScore).toBe(5000);
    expect(store["ascent:90"]?.achievedAt).toBe("incumbent");
  });

  it("breaks a score tie toward more tasks completed", () => {
    let store = updateAscentRecords(
      {},
      record({ bestScore: 4000, bestTasksCompleted: 10, achievedAt: "incumbent" }),
    );
    store = updateAscentRecords(
      store,
      record({ bestScore: 4000, bestTasksCompleted: 12, achievedAt: "challenger" }),
    );

    expect(store["ascent:90"]?.bestTasksCompleted).toBe(12);
    expect(store["ascent:90"]?.achievedAt).toBe("challenger");
  });

  it("keeps the incumbent on a full tie, so the achievedAt stamp does not churn", () => {
    let store = updateAscentRecords(
      {},
      record({ bestScore: 4000, bestTasksCompleted: 10, achievedAt: "incumbent" }),
    );
    store = updateAscentRecords(
      store,
      record({ bestScore: 4000, bestTasksCompleted: 10, achievedAt: "challenger" }),
    );

    expect(store["ascent:90"]?.achievedAt).toBe("incumbent");
  });

  it("merges bestPeakTier independently: a lower-scoring run that touched a higher tier still raises the high-water mark", () => {
    let store = updateAscentRecords(
      {},
      record({ bestScore: 5000, bestPeakTier: 3, achievedAt: "incumbent" }),
    );
    store = updateAscentRecords(
      store,
      record({ bestScore: 1000, bestPeakTier: 5, achievedAt: "challenger" }),
    );

    // The score-defined record itself does not move to the weaker challenger...
    expect(store["ascent:90"]?.bestScore).toBe(5000);
    expect(store["ascent:90"]?.achievedAt).toBe("incumbent");
    // ...but the tier it touched is kept forever, like a PB surviving the log fold.
    expect(store["ascent:90"]?.bestPeakTier).toBe(5);
  });

  it("never lowers bestPeakTier when the winning run's own peak is smaller than history's", () => {
    let store = updateAscentRecords(
      {},
      record({ bestScore: 1000, bestPeakTier: 5, achievedAt: "incumbent" }),
    );
    store = updateAscentRecords(
      store,
      record({ bestScore: 5000, bestPeakTier: 2, achievedAt: "challenger" }),
    );

    expect(store["ascent:90"]?.bestScore).toBe(5000);
    expect(store["ascent:90"]?.bestPeakTier).toBe(5);
  });

  it("keeps each duration's record apart", () => {
    let store = updateAscentRecords({}, record({ durationSeconds: 90, bestScore: 4000 }));
    store = updateAscentRecords(store, record({ durationSeconds: 180, bestScore: 9000 }));

    expect(store["ascent:90"]?.bestScore).toBe(4000);
    expect(store["ascent:180"]?.bestScore).toBe(9000);

    // A weaker 180s run must not disturb the 90s record.
    store = updateAscentRecords(store, record({ durationSeconds: 180, bestScore: 100 }));

    expect(store["ascent:180"]?.bestScore).toBe(9000);
    expect(store["ascent:90"]?.bestScore).toBe(4000);
  });
});

describe("isNewAscentRecord", () => {
  it("is true when there is no previous best", () => {
    expect(isNewAscentRecord(undefined, record())).toBe(true);
  });

  it("is true when the candidate's score is strictly higher", () => {
    const previousBest = record({ bestScore: 4000 });
    const candidate = record({ bestScore: 5000 });

    expect(isNewAscentRecord(previousBest, candidate)).toBe(true);
  });

  it("is false when the candidate's score is strictly lower, even with more tasks completed", () => {
    const previousBest = record({ bestScore: 5000, bestTasksCompleted: 5 });
    const candidate = record({ bestScore: 4000, bestTasksCompleted: 20 });

    expect(isNewAscentRecord(previousBest, candidate)).toBe(false);
  });

  it("is true on a score tie with more tasks completed", () => {
    const previousBest = record({ bestScore: 4000, bestTasksCompleted: 10 });
    const candidate = record({ bestScore: 4000, bestTasksCompleted: 12 });

    expect(isNewAscentRecord(previousBest, candidate)).toBe(true);
  });

  it("is false on a full tie (score and tasks both equal)", () => {
    const previousBest = record({ bestScore: 4000, bestTasksCompleted: 10 });
    const candidate = record({ bestScore: 4000, bestTasksCompleted: 10 });

    expect(isNewAscentRecord(previousBest, candidate)).toBe(false);
  });

  it("is false when only the peak tier is higher and the score does not win: a new high-water mark alone is not a PR", () => {
    const previousBest = record({ bestScore: 5000, bestPeakTier: 3 });
    const candidate = record({ bestScore: 1000, bestPeakTier: 5 });

    expect(isNewAscentRecord(previousBest, candidate)).toBe(false);
  });
});

describe("ascent record storage", () => {
  it("round-trips through storage", () => {
    const storage = createMemoryJsonStorage();
    const store = updateAscentRecords({}, record());

    writeAscentRecords(storage, store);

    expect(readAscentRecords(storage)).toEqual(store);
  });

  it("drops entries that do not look like ascent records", () => {
    const storage = createMemoryJsonStorage({
      [ASCENT_RECORDS_KEY]: {
        "ascent:90": record(),
        "ascent:180": { durationSeconds: 180, bestScore: "not a number" },
        garbage: 42,
        "ascent:30": {
          durationSeconds: 30,
          bestScore: 1,
          // Missing peakTierAtBest, bestTasksCompleted, bestPeakTier, achievedAt.
        },
      },
    });

    const store = readAscentRecords(storage);

    expect(store["ascent:90"]).toBeDefined();
    expect(store["ascent:180"]).toBeUndefined();
    expect(store["ascent:30"]).toBeUndefined();
  });

  it("returns an empty store when the stored value is not an object", () => {
    const storage = createMemoryJsonStorage({ [ASCENT_RECORDS_KEY]: [1, 2, 3] });

    expect(readAscentRecords(storage)).toEqual({});
  });
});

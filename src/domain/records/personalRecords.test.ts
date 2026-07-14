import { describe, expect, it } from "vitest";

import { selectionRevenueColumnChallenge } from "@/data/challenges";
import {
  PERSONAL_RECORDS_KEY,
  betterRecord,
  isPersonalRecordEligible,
  readPersonalRecords,
  recordKey,
  updatePersonalRecords,
  writePersonalRecords,
} from "@/domain/records/personalRecords";
import type { PersonalRecord, PersonalRecordStore } from "@/domain/records/recordTypes";
import { createMemoryJsonStorage } from "@/lib/storage";

const challenge = selectionRevenueColumnChallenge;

function record(overrides: Partial<PersonalRecord> = {}): PersonalRecord {
  return {
    challengeId: challenge.id,
    mode: "main-speed",
    bestScore: 1000,
    bestElapsedMs: 8_000,
    bestCorrectness: 1,
    achievedAt: "2026-07-12T00:00:00.000Z",
    seed: challenge.seed,
    ...overrides,
  };
}

describe("recordKey", () => {
  it("separates the same challenge played in different modes", () => {
    expect(recordKey(challenge.id, "main-speed")).not.toBe(recordKey(challenge.id, "practice"));
  });
});

describe("isPersonalRecordEligible", () => {
  it("accepts a complete run that clears the challenge's correctness floor", () => {
    expect(isPersonalRecordEligible(challenge, { isComplete: true, correctness: 1 })).toBe(true);
  });

  it("rejects an incomplete run even when correctness is perfect", () => {
    expect(isPersonalRecordEligible(challenge, { isComplete: false, correctness: 1 })).toBe(false);
  });

  it("rejects a complete run below the challenge's correctness floor", () => {
    expect(isPersonalRecordEligible(challenge, { isComplete: true, correctness: 0.99 })).toBe(
      false,
    );
  });
});

describe("betterRecord", () => {
  it("takes the candidate when there is no existing record", () => {
    const candidate = record();

    expect(betterRecord(undefined, candidate)).toBe(candidate);
  });

  it("takes the higher score", () => {
    const existing = record({ bestScore: 900 });
    const candidate = record({ bestScore: 1200 });

    expect(betterRecord(existing, candidate)).toBe(candidate);
  });

  it("keeps the existing record when the new run scores lower", () => {
    const existing = record({ bestScore: 1200 });
    const candidate = record({ bestScore: 900 });

    expect(betterRecord(existing, candidate)).toBe(existing);
  });

  it("breaks a tied score with the faster time", () => {
    const existing = record({ bestScore: 1000, bestElapsedMs: 8_000 });
    const candidate = record({ bestScore: 1000, bestElapsedMs: 6_500 });

    expect(betterRecord(existing, candidate)).toBe(candidate);
  });

  it("keeps the existing record when the score ties and the time is no better", () => {
    const existing = record({ bestScore: 1000, bestElapsedMs: 6_500 });
    const candidate = record({ bestScore: 1000, bestElapsedMs: 6_500 });

    expect(betterRecord(existing, candidate)).toBe(existing);
  });
});

describe("updatePersonalRecords", () => {
  it("adds a record for a challenge that has never been played", () => {
    const next = updatePersonalRecords({}, record());

    expect(next[recordKey(challenge.id, "main-speed")]).toEqual(record());
  });

  it("does not mutate the store it was given", () => {
    const store: PersonalRecordStore = {};

    const next = updatePersonalRecords(store, record());

    expect(store).toEqual({});
    expect(next).not.toBe(store);
  });

  it("leaves a stronger existing record alone", () => {
    const store = updatePersonalRecords({}, record({ bestScore: 1500 }));

    const next = updatePersonalRecords(store, record({ bestScore: 800 }));

    expect(next[recordKey(challenge.id, "main-speed")].bestScore).toBe(1500);
  });

  it("keeps a practice record separate from a main-speed record", () => {
    const store = updatePersonalRecords({}, record({ mode: "main-speed", bestScore: 1500 }));

    const next = updatePersonalRecords(store, record({ mode: "practice", bestScore: 800 }));

    expect(next[recordKey(challenge.id, "main-speed")].bestScore).toBe(1500);
    expect(next[recordKey(challenge.id, "practice")].bestScore).toBe(800);
  });
});

describe("readPersonalRecords and writePersonalRecords", () => {
  it("round-trips a store through storage", () => {
    const storage = createMemoryJsonStorage();
    const store = updatePersonalRecords({}, record());

    writePersonalRecords(storage, store);

    expect(readPersonalRecords(storage)).toEqual(store);
  });

  it("returns an empty store when nothing has been saved", () => {
    expect(readPersonalRecords(createMemoryJsonStorage())).toEqual({});
  });

  it("returns an empty store rather than throwing when the saved value is corrupt", () => {
    const storage = createMemoryJsonStorage();
    storage.write(PERSONAL_RECORDS_KEY, "not a record store");

    expect(readPersonalRecords(storage)).toEqual({});
  });

  it("drops entries that are not shaped like a record", () => {
    const storage = createMemoryJsonStorage({
      [PERSONAL_RECORDS_KEY]: {
        [recordKey(challenge.id, "main-speed")]: record(),
        "junk:main-speed": { nonsense: true },
      },
    });

    const loaded = readPersonalRecords(storage);

    expect(Object.keys(loaded)).toEqual([recordKey(challenge.id, "main-speed")]);
  });
});

describe("a Hotkey record survives a reload", () => {
  it("is read back from storage rather than discarded as corrupt", () => {
    // The whole reason the type guard had to learn "hotkey" the same day the mode arrived. A guard
    // that does not recognise a mode reads its records as malformed and drops them silently — the
    // player would simply find their Hotkey book empty one morning, with nothing to blame and no
    // error to search for. This test is what makes that failure loud.
    const storage = createMemoryJsonStorage();
    const hotkey = record({ mode: "hotkey", bestScore: 1610 });

    writePersonalRecords(storage, { [recordKey(challenge.id, "hotkey")]: hotkey });

    expect(readPersonalRecords(storage)[recordKey(challenge.id, "hotkey")]).toEqual(hotkey);
  });

  it("keeps the Hotkey book apart from the Speed book", () => {
    // Records are keyed by mode, so a keyboard-only best can never be mistaken for a mouse-assisted
    // one — and a Speed best can never be beaten by a Hotkey run, or the other way round.
    const storage = createMemoryJsonStorage();

    writePersonalRecords(storage, {
      [recordKey(challenge.id, "main-speed")]: record({ bestScore: 900 }),
      [recordKey(challenge.id, "hotkey")]: record({ mode: "hotkey", bestScore: 1610 }),
    });

    const store = readPersonalRecords(storage);

    expect(store[recordKey(challenge.id, "main-speed")]?.bestScore).toBe(900);
    expect(store[recordKey(challenge.id, "hotkey")]?.bestScore).toBe(1610);
  });
});

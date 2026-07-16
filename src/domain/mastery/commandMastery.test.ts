import { describe, expect, it } from "vitest";

import {
  COMMAND_MASTERY_THRESHOLDS,
  COMMAND_STATS_KEY,
  commandMasteryLevel,
  foldCommandStats,
  readCommandStats,
  writeCommandStats,
  type CommandStat,
  type CommandStatsStore,
} from "@/domain/mastery/commandMastery";
import type { GridCommandId } from "@/domain/commands/commandTypes";
import type { RunEvent } from "@/domain/runs/runTypes";
import { createMemoryJsonStorage } from "@/lib/storage";

/** A minimal, validly-typed event. The action's content is irrelevant to this module. */
function event(atMs: number, command?: GridCommandId): RunEvent {
  return { atMs, action: { kind: "select-cell", cell: { row: 0, col: 0 } }, command };
}

function stat(uses: number, ewmaGapMs: number | null): CommandStat {
  return { uses, ewmaGapMs, lastUsedAt: "2026-07-14T00:00:00.000Z" };
}

describe("foldCommandStats", () => {
  it("counts a command's uses, and leaves an undefined-command event out of the count", () => {
    const events: RunEvent[] = [
      event(1000), // no command: advances the clock, is not counted
      event(1500, "MOVE_DOWN"),
    ];

    const next = foldCommandStats({}, events, "2026-07-14T00:00:00.000Z");

    expect(next.MOVE_DOWN?.uses).toBe(1);
    // The gap is measured against the previous *event*, including the uncounted one.
    expect(next.MOVE_DOWN?.ewmaGapMs).toBe(500);
  });

  it("sets ewmaGapMs to the first measured gap, then blends later gaps at alpha=0.2", () => {
    const events: RunEvent[] = [
      event(0, "MOVE_DOWN"),
      event(500, "MOVE_DOWN"), // first measured gap: 500 -> ewmaGapMs becomes exactly 500
      event(800, "MOVE_DOWN"), // second gap: 300 -> 500*0.8 + 300*0.2 = 460
    ];

    const next = foldCommandStats({}, events, "2026-07-14T00:00:00.000Z");

    expect(next.MOVE_DOWN?.uses).toBe(3);
    expect(next.MOVE_DOWN?.ewmaGapMs).toBe(460);
  });

  it("leaves ewmaGapMs null when there is no preceding event to gap against", () => {
    const next = foldCommandStats({}, [event(500, "MOVE_UP")], "2026-07-14T00:00:00.000Z");

    expect(next.MOVE_UP).toEqual({
      uses: 1,
      ewmaGapMs: null,
      lastUsedAt: "2026-07-14T00:00:00.000Z",
    });
  });

  it("tracks each command's use count and gap independently of the others", () => {
    const events: RunEvent[] = [
      event(0, "MOVE_DOWN"),
      event(100, "MOVE_UP"), // gap 100: MOVE_UP's first measured gap
      event(250, "MOVE_DOWN"), // gap 150: MOVE_DOWN's first measured gap (its own first use had none)
    ];

    const next = foldCommandStats({}, events, "2026-07-14T00:00:00.000Z");

    expect(next.MOVE_UP).toMatchObject({ uses: 1, ewmaGapMs: 100 });
    expect(next.MOVE_DOWN).toMatchObject({ uses: 2, ewmaGapMs: 150 });
  });

  it("folds onto an existing store without mutating it, carrying uses and ewma forward", () => {
    const store: CommandStatsStore = {
      MOVE_DOWN: { uses: 5, ewmaGapMs: 1000, lastUsedAt: "2026-01-01T00:00:00.000Z" },
    };

    const next = foldCommandStats(store, [event(500, "MOVE_DOWN")], "2026-07-14T00:00:00.000Z");

    // The fold's own first event has no preceding event, so this gap is null and the prior ewma
    // survives untouched — a fold never resets a command's history to zero.
    expect(next.MOVE_DOWN).toEqual({
      uses: 6,
      ewmaGapMs: 1000,
      lastUsedAt: "2026-07-14T00:00:00.000Z",
    });
    expect(store.MOVE_DOWN).toEqual({
      uses: 5,
      ewmaGapMs: 1000,
      lastUsedAt: "2026-01-01T00:00:00.000Z",
    });
  });
});

describe("commandMasteryLevel", () => {
  it("pins the threshold values themselves, not just the comparisons built on them", () => {
    // The tests below express boundaries relative to these constants (e.g. `.fluent - 1`), which
    // pins the comparison logic but not the numbers — this assertion is what would catch one of
    // them silently drifting.
    expect(COMMAND_MASTERY_THRESHOLDS).toEqual({
      learned: 15,
      fluent: 40,
      reflex: 80,
      fluentGapMs: 2500,
      reflexGapMs: 1200,
    });
  });

  it("is unknown for an undefined stat, and for a stat with zero uses", () => {
    expect(commandMasteryLevel(undefined)).toBe("unknown");
    expect(commandMasteryLevel(stat(0, null))).toBe("unknown");
  });

  it("is seen below the learned threshold, however fast the gap", () => {
    expect(commandMasteryLevel(stat(1, null))).toBe("seen");
    expect(commandMasteryLevel(stat(COMMAND_MASTERY_THRESHOLDS.learned - 1, 1))).toBe("seen");
  });

  it("becomes learned exactly at the learned threshold, and stays capped there below fluent's use count", () => {
    expect(commandMasteryLevel(stat(COMMAND_MASTERY_THRESHOLDS.learned, null))).toBe("learned");
    // One use short of fluent's use-count gate: an extremely fast gap still cannot promote it.
    expect(commandMasteryLevel(stat(COMMAND_MASTERY_THRESHOLDS.fluent - 1, 1))).toBe("learned");
  });

  it("becomes fluent only once both the use count and the gap clear their thresholds", () => {
    expect(
      commandMasteryLevel(stat(COMMAND_MASTERY_THRESHOLDS.fluent, COMMAND_MASTERY_THRESHOLDS.fluentGapMs - 1)),
    ).toBe("fluent");
    // Gap exactly at the threshold does not qualify: the comparison is strict.
    expect(
      commandMasteryLevel(stat(COMMAND_MASTERY_THRESHOLDS.fluent, COMMAND_MASTERY_THRESHOLDS.fluentGapMs)),
    ).toBe("learned");
    // Enough uses for reflex, but the gap only clears the (looser) fluent bar.
    expect(commandMasteryLevel(stat(COMMAND_MASTERY_THRESHOLDS.reflex - 1, 2000))).toBe("fluent");
  });

  it("becomes reflex only once both the use count and the gap clear the tightest thresholds", () => {
    expect(
      commandMasteryLevel(stat(COMMAND_MASTERY_THRESHOLDS.reflex, COMMAND_MASTERY_THRESHOLDS.reflexGapMs - 1)),
    ).toBe("reflex");
    // Gap exactly at the reflex threshold falls through to fluent, not reflex.
    expect(
      commandMasteryLevel(stat(COMMAND_MASTERY_THRESHOLDS.reflex, COMMAND_MASTERY_THRESHOLDS.reflexGapMs)),
    ).toBe("fluent");
  });

  it("treats a null ewmaGapMs as infinitely slow, capping the level at learned no matter the use count", () => {
    expect(commandMasteryLevel(stat(COMMAND_MASTERY_THRESHOLDS.reflex, null))).toBe("learned");
  });
});

describe("readCommandStats", () => {
  it("returns an empty store for a non-object, null, or array raw value, and for an absent key", () => {
    expect(readCommandStats(createMemoryJsonStorage({ [COMMAND_STATS_KEY]: "nonsense" }))).toEqual({});
    expect(readCommandStats(createMemoryJsonStorage({ [COMMAND_STATS_KEY]: null }))).toEqual({});
    expect(readCommandStats(createMemoryJsonStorage({ [COMMAND_STATS_KEY]: [1, 2, 3] }))).toEqual({});
    expect(readCommandStats(createMemoryJsonStorage())).toEqual({});
  });

  it("drops an entry missing a required field, and one with a wrong-typed field", () => {
    const storage = createMemoryJsonStorage({
      [COMMAND_STATS_KEY]: {
        MOVE_DOWN: { uses: 5, lastUsedAt: "2026-07-14T00:00:00.000Z" }, // missing ewmaGapMs
        MOVE_UP: { uses: "12", ewmaGapMs: null, lastUsedAt: "2026-07-14T00:00:00.000Z" }, // uses: wrong type
        JUMP_DOWN: { uses: 3, ewmaGapMs: 500, lastUsedAt: 12345 }, // lastUsedAt: wrong type
      },
    });

    expect(readCommandStats(storage)).toEqual({});
  });

  it("keeps a valid entry, including one whose ewmaGapMs is still null, alongside dropped ones", () => {
    const storage = createMemoryJsonStorage({
      [COMMAND_STATS_KEY]: {
        MOVE_DOWN: { uses: 5, ewmaGapMs: 320.5, lastUsedAt: "2026-07-14T00:00:00.000Z" },
        MOVE_UP: { uses: 1, ewmaGapMs: null, lastUsedAt: "2026-07-14T00:00:00.000Z" },
        broken: { uses: 5 },
      },
    });

    expect(readCommandStats(storage)).toEqual({
      MOVE_DOWN: { uses: 5, ewmaGapMs: 320.5, lastUsedAt: "2026-07-14T00:00:00.000Z" },
      MOVE_UP: { uses: 1, ewmaGapMs: null, lastUsedAt: "2026-07-14T00:00:00.000Z" },
    });
  });
});

describe("writeCommandStats", () => {
  it("writes under COMMAND_STATS_KEY, so readCommandStats reads back exactly what was folded", () => {
    const storage = createMemoryJsonStorage();
    const folded = foldCommandStats(
      {},
      [event(0, "MOVE_DOWN"), event(400, "MOVE_DOWN")],
      "2026-07-14T00:00:00.000Z",
    );

    writeCommandStats(storage, folded);

    expect(storage.read(COMMAND_STATS_KEY, null)).not.toBeNull();
    expect(readCommandStats(storage)).toEqual(folded);
  });
});

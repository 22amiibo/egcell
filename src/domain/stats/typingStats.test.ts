import { describe, expect, it } from "vitest";

import type { RunEvent } from "@/domain/runs/runTypes";
import { keystrokeAccuracy, typingCorrections, typingWpm } from "@/domain/stats/typingStats";

/** A pure navigation event: no keystrokes field at all, as a move or selection produces. */
const moveEvent: RunEvent = {
  atMs: 100,
  action: { kind: "select-cell", cell: { row: 0, col: 0 } },
};

function commitEventWith(keystrokes: { chars: number; corrections: number }): RunEvent {
  return {
    atMs: 200,
    action: { kind: "set-cell-value", cell: { row: 0, col: 0 }, value: { kind: "number", value: 42 } },
    keystrokes,
  };
}

describe("keystrokeAccuracy", () => {
  it("is null when no typing happened — a navigation run has no keystroke accuracy", () => {
    expect(keystrokeAccuracy([moveEvent, moveEvent])).toBeNull();
  });

  it("is null on an empty event list", () => {
    expect(keystrokeAccuracy([])).toBeNull();
  });

  it("charges corrections against accuracy", () => {
    const events = [commitEventWith({ chars: 6, corrections: 1 })];

    expect(keystrokeAccuracy(events)).toBeCloseTo(5 / 6);
  });

  it("sums keystrokes across multiple commits in the same run", () => {
    const events = [commitEventWith({ chars: 6, corrections: 1 }), commitEventWith({ chars: 4, corrections: 0 })];

    // (6 + 4 - 1) / (6 + 4) = 9/10
    expect(keystrokeAccuracy(events)).toBeCloseTo(9 / 10);
  });

  it("clamps at zero rather than going negative when corrections outnumber chars", () => {
    const events = [commitEventWith({ chars: 2, corrections: 5 })];

    expect(keystrokeAccuracy(events)).toBe(0);
  });

  it("is 1 when the run typed but every character it typed was corrected away to nothing", () => {
    const events = [commitEventWith({ chars: 0, corrections: 0 }), moveEvent];

    expect(keystrokeAccuracy(events)).toBe(1);
  });

  it("ignores navigation events mixed in alongside typing", () => {
    const events = [moveEvent, commitEventWith({ chars: 6, corrections: 1 }), moveEvent];

    expect(keystrokeAccuracy(events)).toBeCloseTo(5 / 6);
  });
});

describe("typingWpm", () => {
  it("computes WPM at five characters per word", () => {
    const events = [commitEventWith({ chars: 25, corrections: 0 })];

    expect(typingWpm(events, 30_000)).toBeCloseTo(10);
  });

  it("is null when no typing happened", () => {
    expect(typingWpm([moveEvent], 30_000)).toBeNull();
  });

  it("is null when elapsed time is zero", () => {
    const events = [commitEventWith({ chars: 25, corrections: 0 })];

    expect(typingWpm(events, 0)).toBeNull();
  });

  it("is null when elapsed time is negative", () => {
    const events = [commitEventWith({ chars: 25, corrections: 0 })];

    expect(typingWpm(events, -100)).toBeNull();
  });
});

describe("typingCorrections", () => {
  it("is zero when no event has keystrokes", () => {
    expect(typingCorrections([moveEvent, moveEvent])).toBe(0);
  });

  it("is zero on an empty event list", () => {
    expect(typingCorrections([])).toBe(0);
  });

  it("sums corrections across every typing event in the run", () => {
    const events = [commitEventWith({ chars: 6, corrections: 1 }), commitEventWith({ chars: 4, corrections: 2 })];

    expect(typingCorrections(events)).toBe(3);
  });
});

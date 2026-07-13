import { describe, expect, it } from "vitest";

import { canonicalEvents, eventDigest } from "@/domain/runs/eventDigest";
import {
  buildRunResult,
  serializeRunResult,
  type BuildRunResultInput,
} from "@/domain/runs/runResult";
import type { RunEvent } from "@/domain/runs/runTypes";

const START_MS = Date.parse("2026-07-12T10:00:00.000Z");

const events: RunEvent[] = [
  { atMs: 120, action: { kind: "select-cell", cell: { row: 3, col: 2 } } },
  { atMs: 900, action: { kind: "select-column", col: 2, usedRangeOnly: true } },
];

function input(overrides: Partial<BuildRunResultInput> = {}): BuildRunResultInput {
  return {
    challengeId: "selection.revenue-column",
    challengeVersion: "v1",
    seed: "revenue-column-v1",
    mode: "main-speed",
    score: 1000,
    correctness: 1,
    completionPercent: 1,
    accuracy: 1,
    startedAtMs: START_MS,
    finishedAtMs: START_MS + 4_200,
    events,
    ...overrides,
  };
}

describe("buildRunResult", () => {
  it("carries every field a leaderboard submission needs", () => {
    const result = buildRunResult(input());

    expect(result).toMatchObject({
      resultVersion: "v1",
      challengeId: "selection.revenue-column",
      challengeVersion: "v1",
      seed: "revenue-column-v1",
      mode: "main-speed",
      score: 1000,
      correctness: 1,
      completionPercent: 1,
      accuracy: 1,
      clientStartedAt: "2026-07-12T10:00:00.000Z",
      clientFinishedAt: "2026-07-12T10:00:04.200Z",
    });

    expect(result.eventDigest).toMatch(/^v2:[0-9a-f]{8}$/);
    expect(result.replayEvents).toEqual(events);
  });

  it("derives elapsed time from the timestamps, so a submission cannot contradict itself", () => {
    const result = buildRunResult(input({ finishedAtMs: START_MS + 7_500 }));

    expect(result.elapsedMs).toBe(7_500);
    expect(Date.parse(result.clientFinishedAt) - Date.parse(result.clientStartedAt)).toBe(
      result.elapsedMs,
    );
  });

  it("survives a JSON round trip unchanged", () => {
    const result = buildRunResult(input());

    expect(JSON.parse(serializeRunResult(result))).toEqual(result);
  });

  it("holds no UI state: every value is plain JSON", () => {
    const result = buildRunResult(input());

    for (const value of Object.values(result)) {
      expect(typeof value).not.toBe("function");
      expect(value).not.toBeInstanceOf(Date);
    }
  });
});

describe("eventDigest", () => {
  it("is stable for the same events", () => {
    expect(eventDigest(events)).toBe(eventDigest([...events]));
  });

  it("changes when an action changes", () => {
    const different: RunEvent[] = [
      events[0],
      { atMs: 900, action: { kind: "select-column", col: 3, usedRangeOnly: true } },
    ];

    expect(eventDigest(different)).not.toBe(eventDigest(events));
  });

  it("changes when the timing changes", () => {
    const later: RunEvent[] = [{ ...events[0], atMs: 121 }, events[1]];

    expect(eventDigest(later)).not.toBe(eventDigest(events));
  });

  it("changes when the order changes", () => {
    expect(eventDigest([events[1], events[0]])).not.toBe(eventDigest(events));
  });

  it("handles a run with no events", () => {
    expect(eventDigest([])).toMatch(/^v2:[0-9a-f]{8}$/);
  });

  it("does not depend on the key order of a format", () => {
    const boldFirst: RunEvent[] = [
      {
        atMs: 10,
        action: {
          kind: "set-format",
          range: { start: { row: 0, col: 0 }, end: { row: 0, col: 1 } },
          format: { bold: true, numberFormat: "currency" },
        },
      },
    ];

    const formatFirst: RunEvent[] = [
      {
        atMs: 10,
        action: {
          kind: "set-format",
          range: { start: { row: 0, col: 0 }, end: { row: 0, col: 1 } },
          format: { numberFormat: "currency", bold: true },
        },
      },
    ];

    expect(eventDigest(boldFirst)).toBe(eventDigest(formatFirst));
  });

  it("writes a canonical form a server could recompute", () => {
    // These fixture events predate the command layer, so the command slot is empty — canonicalised
    // as "", never guessed.
    expect(canonicalEvents(events)).toBe("120||select-cell:3,2;900||select-column:2:true");
  });

  it("changes when only the command differs, so two routes to the same action stay distinguishable", () => {
    const withCommand: RunEvent[] = [{ ...events[0], command: "MOVE_DOWN" }, events[1]];
    const withDifferentCommand: RunEvent[] = [{ ...events[0], command: "JUMP_DOWN" }, events[1]];

    expect(eventDigest(withCommand)).not.toBe(eventDigest(withDifferentCommand));
    expect(eventDigest(withCommand)).not.toBe(eventDigest(events));
  });
});

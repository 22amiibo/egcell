import { describe, expect, it } from "vitest";

import { chordLabel, matchChord, type ChordEvent } from "@/domain/commands/keymap";

function keydown(overrides: Partial<ChordEvent> & { key: string }): ChordEvent {
  return {
    code: undefined,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...overrides,
  };
}

describe("matchChord", () => {
  it("distinguishes one Ctrl/Cmd+Shift+ArrowDown from repeated Shift+ArrowDowns", () => {
    const repeated = matchChord(keydown({ key: "ArrowDown", shiftKey: true }));
    const single = matchChord(keydown({ key: "ArrowDown", ctrlKey: true, shiftKey: true }));

    expect(repeated?.command).toBe("EXTEND_DOWN");
    expect(single?.command).toBe("EXTEND_JUMP_DOWN");
    expect(repeated?.command).not.toBe(single?.command);
  });

  it("maps Ctrl and Cmd to the same command", () => {
    expect(matchChord(keydown({ key: "ArrowDown", ctrlKey: true }))?.command).toBe("JUMP_DOWN");
    expect(matchChord(keydown({ key: "ArrowDown", metaKey: true }))?.command).toBe("JUMP_DOWN");
  });

  it("returns null for a key with no bound chord", () => {
    expect(matchChord(keydown({ key: "Enter" }))).toBeNull();
  });

  it("returns null for a bare Space, and for Ctrl+Shift+Space — Ctrl+Space and Shift+Space each mean something else", () => {
    expect(matchChord(keydown({ key: " ", code: "Space" }))).toBeNull();
    expect(
      matchChord(keydown({ key: " ", code: "Space", ctrlKey: true, shiftKey: true })),
    ).toBeNull();
  });

  it("does not require Alt to be up on a chord that never declared it, matching today's shipped behaviour", () => {
    // No chord shipping today reads altKey. Requiring it up by default would silently regress
    // Alt+Arrow, which nothing tests today and which currently still moves the cursor.
    expect(matchChord(keydown({ key: "ArrowLeft", altKey: true }))?.command).toBe("MOVE_LEFT");
  });

  it("does not treat Cmd+Space as Ctrl+Space — Cmd+Space is Spotlight, an existing exception", () => {
    expect(matchChord(keydown({ key: " ", code: "Space", metaKey: true }))).toBeNull();
  });
});

describe("chordLabel", () => {
  it("normalizes Ctrl/Cmd to the same command while preserving platform-specific evidence", () => {
    expect(chordLabel("JUMP_DOWN", "windows")).toBe("Ctrl + ↓");
    expect(chordLabel("JUMP_DOWN", "mac")).toBe("Cmd + ↓");
  });

  it("keeps the currency/percent chords Ctrl-only on both platforms, since Cmd+Shift+4/5 are macOS screenshots", () => {
    expect(chordLabel("FORMAT_CURRENCY", "windows")).toBe("Ctrl + Shift + 4");
    expect(chordLabel("FORMAT_CURRENCY", "mac")).toBe("Ctrl + Shift + 4");
  });

  it("returns null for a command with no keyboard route yet", () => {
    expect(chordLabel("OPEN_FILTER_MENU", "windows")).toBeNull();
    expect(chordLabel("FORMAT_DATE", "mac")).toBeNull();
  });
});

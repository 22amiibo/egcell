import { describe, expect, it } from "vitest";

import {
  chordLabel,
  commandChordLabel,
  matchChord,
  type ChordEvent,
} from "@/domain/commands/keymap";

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

  it("prefers Alt+↓'s OPEN_FILTER_MENU over plain MOVE_DOWN's unconstrained alt (the §1a.2 specificity rule)", () => {
    const match = matchChord(keydown({ key: "ArrowDown", altKey: true }));

    expect(match?.command).toBe("OPEN_FILTER_MENU");
  });

  it("still fires MOVE_DOWN for a plain ArrowDown with no Alt held", () => {
    expect(matchChord(keydown({ key: "ArrowDown" }))?.command).toBe("MOVE_DOWN");
  });

  it("matches Ctrl+Shift+3 and Cmd+Shift+3 to FORMAT_DATE, by key or by code", () => {
    expect(matchChord(keydown({ key: "3", ctrlKey: true, shiftKey: true }))?.command).toBe(
      "FORMAT_DATE",
    );
    expect(matchChord(keydown({ key: "#", metaKey: true, shiftKey: true }))?.command).toBe(
      "FORMAT_DATE",
    );
  });

  it("matches mod+Shift+L to TOGGLE_FILTER", () => {
    expect(matchChord(keydown({ key: "l", ctrlKey: true, shiftKey: true }))?.command).toBe(
      "TOGGLE_FILTER",
    );
    expect(matchChord(keydown({ key: "l", metaKey: true, shiftKey: true }))?.command).toBe(
      "TOGGLE_FILTER",
    );
  });

  it("F2 starts an edit", () => {
    expect(matchChord(keydown({ key: "F2" }))).toEqual({ command: "START_EDIT", chord: "F2" });
  });
});

describe("chordLabel", () => {
  it("normalizes Ctrl/Cmd to the same command while preserving platform-specific evidence", () => {
    expect(chordLabel("JUMP_DOWN", "windows")).toBe("Ctrl + ↓");
    expect(chordLabel("JUMP_DOWN", "mac")).toBe("Cmd + ↓");
  });

  it("keeps the currency/percent/date chords Ctrl-only-labelled on both platforms, since Cmd+Shift+3/4/5 are macOS screenshots", () => {
    expect(chordLabel("FORMAT_CURRENCY", "windows")).toBe("Ctrl + Shift + 4");
    expect(chordLabel("FORMAT_CURRENCY", "mac")).toBe("Ctrl + Shift + 4");
    expect(chordLabel("FORMAT_DATE", "windows")).toBe("Ctrl + Shift + 3");
    expect(chordLabel("FORMAT_DATE", "mac")).toBe("Ctrl + Shift + 3");
  });

  it("labels OPEN_FILTER_MENU with Option on mac, Alt on windows", () => {
    expect(chordLabel("OPEN_FILTER_MENU", "windows")).toBe("Alt + ↓");
    expect(chordLabel("OPEN_FILTER_MENU", "mac")).toBe("Option + ↓");
  });

  it("returns null for a command with no top-level chord — menu-only commands included", () => {
    expect(chordLabel("SORT_ASC", "windows")).toBeNull();
    expect(chordLabel("CLEAR_FILTERS", "mac")).toBeNull();
  });
});

describe("commandChordLabel", () => {
  it("returns the direct chord label for a command that has one, same as chordLabel", () => {
    expect(commandChordLabel("JUMP_DOWN", "windows")).toBe("Ctrl + ↓");
    expect(commandChordLabel("JUMP_DOWN", "mac")).toBe("Cmd + ↓");
  });

  it("falls back to the filter-menu route for a FILTER_MENU_COMMANDS member, platform-labelled", () => {
    expect(commandChordLabel("SORT_ASC", "windows")).toBe("Alt + ↓, then choose");
    expect(commandChordLabel("SORT_ASC", "mac")).toBe("Option + ↓, then choose");
  });

  it("returns null for a pointer-only command with no keyboard route at all", () => {
    expect(commandChordLabel("CLICK_CELL", "windows")).toBeNull();
    expect(commandChordLabel("CLICK_CELL", "mac")).toBeNull();
  });
});

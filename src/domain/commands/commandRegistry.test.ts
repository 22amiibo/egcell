import { describe, expect, it } from "vitest";

import {
  COMMAND_REGISTRY,
  EDIT_COMMANDS,
  FILTER_MENU_COMMANDS,
  KEYBOARD_COMMANDS,
} from "@/domain/commands/commandRegistry";

describe("hotkeyEligible", () => {
  it("stays derived, never hand-set: true for a top-level chord, FILTER_MENU_COMMANDS membership, or EDIT_COMMANDS membership", () => {
    for (const definition of Object.values(COMMAND_REGISTRY)) {
      const expected =
        definition.chords.length > 0 ||
        FILTER_MENU_COMMANDS.has(definition.id) ||
        EDIT_COMMANDS.has(definition.id);

      expect(definition.hotkeyEligible).toBe(expected);
    }
  });

  it("is true for every FilterMenu-only command, despite chords: []", () => {
    for (const command of FILTER_MENU_COMMANDS) {
      expect(COMMAND_REGISTRY[command].chords).toEqual([]);
      expect(COMMAND_REGISTRY[command].hotkeyEligible).toBe(true);
    }
  });

  it("is false for pointer-origin commands with no menu route either", () => {
    expect(COMMAND_REGISTRY.APPLY_BOLD.hotkeyEligible).toBe(false);
    expect(COMMAND_REGISTRY.CLICK_CELL.hotkeyEligible).toBe(false);
  });

  it("is true for the new Phase 2 commands with real top-level chords", () => {
    expect(COMMAND_REGISTRY.FORMAT_DATE.hotkeyEligible).toBe(true);
    expect(COMMAND_REGISTRY.OPEN_FILTER_MENU.hotkeyEligible).toBe(true);
    expect(COMMAND_REGISTRY.TOGGLE_FILTER.hotkeyEligible).toBe(true);
  });
});

describe("KEYBOARD_COMMANDS", () => {
  it("is derived from hotkeyEligible minus EDIT_COMMANDS, not re-derived from chords.length — the two cannot drift apart", () => {
    const expected = Object.values(COMMAND_REGISTRY)
      .filter((definition) => definition.hotkeyEligible && !EDIT_COMMANDS.has(definition.id))
      .map((definition) => definition.id)
      .sort();

    expect([...KEYBOARD_COMMANDS].sort()).toEqual(expected);
  });

  it("includes every FilterMenu-only command", () => {
    for (const command of FILTER_MENU_COMMANDS) {
      expect(KEYBOARD_COMMANDS).toContain(command);
    }
  });

  it("excludes pointer-only commands", () => {
    expect(KEYBOARD_COMMANDS).not.toContain("APPLY_BOLD");
    expect(KEYBOARD_COMMANDS).not.toContain("CLICK_CELL");
  });

  it("edit commands are keyboard-eligible but never in the solver's search space", () => {
    expect(COMMAND_REGISTRY.START_EDIT.hotkeyEligible).toBe(true);
    expect(COMMAND_REGISTRY.COMMIT_EDIT.hotkeyEligible).toBe(true);
    expect(KEYBOARD_COMMANDS).not.toContain("COMMIT_EDIT");
    expect(KEYBOARD_COMMANDS).not.toContain("START_EDIT");
  });
});

describe("recordable", () => {
  it("only the commit is recordable", () => {
    expect(COMMAND_REGISTRY.START_EDIT.recordable).toBe(false);
    expect(COMMAND_REGISTRY.COMMIT_EDIT.recordable).toBe(true);
    expect(COMMAND_REGISTRY.CANCEL_EDIT.recordable).toBe(false);
  });
});

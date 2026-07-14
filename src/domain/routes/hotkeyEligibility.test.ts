import { describe, expect, it } from "vitest";

import { challenges } from "@/data/challenges";
import type { GridCommandId } from "@/domain/commands/commandTypes";
import {
  hotkeyVerdict,
  isHotkeyPlayable,
  isKeyboardPure,
  isShortcutPure,
} from "@/domain/routes/hotkeyEligibility";
import { getRoutes } from "@/domain/routes/routeCache";
import type { RunEvent } from "@/domain/runs/runTypes";

function event(command: GridCommandId, overrides: Partial<RunEvent> = {}): RunEvent {
  return {
    atMs: 0,
    action: { kind: "select-cell", cell: { row: 0, col: 0 } },
    inputMethod: "keyboard",
    via: "shortcut",
    command,
    chord: null,
    controlId: null,
    ...overrides,
  };
}

describe("keyboard purity", () => {
  it("counts a toolbar button reached with the keyboard as keyboard-pure", () => {
    // The heart of it. A player who tabs to Bold and presses Enter fired the same action a click
    // fires — and did it without touching the mouse. Judging purity from the *action* could not tell
    // those apart, and would lock a keyboard-only player out of the keyboard-only mode for using the
    // interface exactly as it was designed to be used (§6.6).
    const events = [
      event("MOVE_DOWN"),
      event("TOGGLE_BOLD", { inputMethod: "keyboard", via: "toolbar", controlId: "toolbar-bold" }),
    ];

    expect(isKeyboardPure(events)).toBe(true);

    // Pure, but not a *shortcut* — so the coaching still has something true to say.
    expect(isShortcutPure(events)).toBe(false);
  });

  it("counts one click as impure, however small", () => {
    expect(
      isKeyboardPure([
        event("MOVE_DOWN"),
        event("CLICK_CELL", { inputMethod: "pointer", via: "grid" }),
      ]),
    ).toBe(false);
  });
});

describe("hotkeyVerdict", () => {
  const clicked = [event("CLICK_CELL", { inputMethod: "pointer", via: "grid" })];

  it("encouraged: a click costs the coaching, never the record", () => {
    expect(hotkeyVerdict(clicked, "encouraged")).toEqual({
      ranked: true,
      blocksPointer: false,
      reason: null,
    });
  });

  it("strict: a click costs the record, and says why — but never the run", () => {
    const verdict = hotkeyVerdict(clicked, "strict");

    expect(verdict.ranked).toBe(false);
    expect(verdict.blocksPointer).toBe(false);
    expect(verdict.reason).toContain("not a Hotkey record");
  });

  it("ranked: the pointer is refused outright, so the question cannot arise", () => {
    expect(hotkeyVerdict([event("MOVE_DOWN")], "ranked")).toEqual({
      ranked: true,
      blocksPointer: true,
      reason: null,
    });
  });
});

describe("isHotkeyPlayable", () => {
  it("passes every shipped classic: Phase 2 left no drill the keyboard cannot finish", () => {
    for (const challenge of challenges) {
      expect(isHotkeyPlayable(getRoutes(challenge)), challenge.id).toBe(true);
    }
  });

  it("refuses a drill the solver could not solve, rather than trapping a player inside it", () => {
    expect(isHotkeyPlayable(null)).toBe(false);
    expect(isHotkeyPlayable([])).toBe(false);
  });
});

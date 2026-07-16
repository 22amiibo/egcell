import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CommandCodex } from "@/components/profile/CommandCodex";
import { COMMAND_REGISTRY } from "@/domain/commands/commandRegistry";
import type { GridCommandId } from "@/domain/commands/commandTypes";
import {
  COMMAND_MASTERY_THRESHOLDS,
  type CommandStatsStore,
} from "@/domain/mastery/commandMastery";

describe("CommandCodex", () => {
  it("renders exactly one row per registry command — the game's first global cheat sheet", () => {
    render(<CommandCodex stats={{}} platform="windows" />);

    const rows = screen.getAllByTestId("command-row");

    expect(rows).toHaveLength(Object.keys(COMMAND_REGISTRY).length);
    // Pins the registry's own size, not just a comparison built on it (commandMastery.test.ts's
    // own idiom for its threshold constants) — 38 is the number the §5.3 controller decision counted.
    expect(rows).toHaveLength(38);
  });

  it("covers every registry command exactly once — the group map's exhaustiveness/uniqueness guard", () => {
    render(<CommandCodex stats={{}} platform="windows" />);

    for (const id of Object.keys(COMMAND_REGISTRY) as GridCommandId[]) {
      // getAllByTestId throws if a command's row is missing; the length assertion catches a
      // command duplicated across two groups. Either failure names the offending command id.
      expect(screen.getAllByTestId(`command-mastery-${id}`)).toHaveLength(1);
    }
  });

  it("badges every mastery level from a stats fixture, including a command absent from stats", () => {
    const stats: CommandStatsStore = {
      MOVE_UP: { uses: 1, ewmaGapMs: null, lastUsedAt: "2026-07-14T00:00:00.000Z" },
      MOVE_DOWN: {
        uses: COMMAND_MASTERY_THRESHOLDS.learned,
        ewmaGapMs: null,
        lastUsedAt: "2026-07-14T00:00:00.000Z",
      },
      MOVE_LEFT: {
        uses: COMMAND_MASTERY_THRESHOLDS.fluent,
        ewmaGapMs: COMMAND_MASTERY_THRESHOLDS.fluentGapMs - 1,
        lastUsedAt: "2026-07-14T00:00:00.000Z",
      },
      MOVE_RIGHT: {
        uses: COMMAND_MASTERY_THRESHOLDS.reflex,
        ewmaGapMs: COMMAND_MASTERY_THRESHOLDS.reflexGapMs - 1,
        lastUsedAt: "2026-07-14T00:00:00.000Z",
      },
    };

    render(<CommandCodex stats={stats} platform="windows" />);

    expect(screen.getByTestId("command-mastery-JUMP_UP")).toHaveTextContent("Unknown");
    expect(screen.getByTestId("command-mastery-MOVE_UP")).toHaveTextContent("Seen");
    expect(screen.getByTestId("command-mastery-MOVE_DOWN")).toHaveTextContent("Learned");
    expect(screen.getByTestId("command-mastery-MOVE_LEFT")).toHaveTextContent("Fluent");
    expect(screen.getByTestId("command-mastery-MOVE_RIGHT")).toHaveTextContent("Reflex");
  });

  it("shows a direct chord label for a command that has one", () => {
    render(<CommandCodex stats={{}} platform="windows" />);

    expect(screen.getByTestId("command-chord-MOVE_DOWN")).toHaveTextContent("↓");
  });

  it("shows the filter-menu fallback, platform-labelled, for a FILTER_MENU_COMMANDS member", () => {
    const { rerender } = render(<CommandCodex stats={{}} platform="windows" />);

    expect(screen.getByTestId("command-chord-SORT_ASC")).toHaveTextContent(
      "Alt + ↓, then choose",
    );

    rerender(<CommandCodex stats={{}} platform="mac" />);

    expect(screen.getByTestId("command-chord-SORT_ASC")).toHaveTextContent(
      "Option + ↓, then choose",
    );
  });

  it("shows a dash for a pointer-only command, never keyed on label === null alone", () => {
    render(<CommandCodex stats={{}} platform="windows" />);

    expect(screen.getByTestId("command-chord-CLICK_CELL")).toHaveTextContent("—");
  });

  it("groups commands under the 8 headings, Pointer last, in the controller-decided order", () => {
    render(<CommandCodex stats={{}} platform="windows" />);

    const headings = screen
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);

    expect(headings).toEqual([
      "Movement",
      "Jump",
      "Extend",
      "Select",
      "Format",
      "Sort & Filter",
      "Edit",
      "Pointer",
    ]);
  });
});

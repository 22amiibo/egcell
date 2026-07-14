import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { chordLabelForEvent, RunFeedbackLayer } from "@/components/game/RunFeedbackLayer";
import type { RunEvent } from "@/domain/runs/runTypes";

const MOVE_DOWN: RunEvent = {
  atMs: 100,
  action: { kind: "select-cell", cell: { row: 1, col: 0 } },
  inputMethod: "keyboard",
  command: "MOVE_DOWN",
  via: "shortcut",
  chord: "ArrowDown",
  controlId: null,
};

describe("RunFeedbackLayer", () => {
  it("is a lane, not an overlay: it takes up space instead of floating over the grid", () => {
    // This used to assert `absolute inset-0` — the class list that pinned every cue to a corner of
    // the grid, landing CHECK INPUT squarely on the column headers. The contract is now the opposite
    // one: the layer sits in the flow, so there is no geometry in which it can cover a header, a
    // cell, or a filter caret, at any viewport.
    render(<RunFeedbackLayer event="success" reducedMotion />);

    const layer = screen.getByTestId("run-feedback-layer");

    expect(layer).toHaveAttribute("data-motion", "reduced");
    expect(layer).toHaveAttribute("data-event", "success");
    expect(layer).toHaveClass("pointer-events-none");
    expect(layer).not.toHaveClass("absolute");
    // Reserved height: the lane is the same size whether or not a cue is in it, so the grid cannot
    // jump when one appears. That is the one thing the overlay was genuinely good for.
    expect(layer).toHaveClass("h-8");
    expect(screen.getByText("Correct")).toBeVisible();
  });

  it.each([
    ["taskAppear", "Ready"],
    ["mistake", "Check input"],
    ["pbPace", "PB pace"],
    ["runFinished", "Run complete"],
  ] as const)("renders the %s state", (event, label) => {
    render(<RunFeedbackLayer event={event} reducedMotion={false} />);

    expect(screen.getByTestId("run-feedback-layer")).toHaveAttribute("data-motion", "full");
    expect(screen.getByText(label)).toBeVisible();
  });

  it("shows shortcut and combo details only when enabled", () => {
    const { rerender } = render(
      <RunFeedbackLayer
        event="shortcut"
        reducedMotion={false}
        shortcutLabel="Ctrl+Space"
        combo={4}
        showShortcut
        showCombo
      />,
    );

    expect(screen.getByTestId("shortcut-flash")).toHaveTextContent("Ctrl+Space");
    expect(screen.getByTestId("combo-indicator")).toHaveTextContent("4 streak");

    rerender(
      <RunFeedbackLayer
        event="combo"
        reducedMotion={false}
        shortcutLabel="Ctrl+Space"
        combo={4}
        showShortcut={false}
        showCombo={false}
      />,
    );

    expect(screen.queryByTestId("shortcut-flash")).not.toBeInTheDocument();
    expect(screen.queryByTestId("combo-indicator")).not.toBeInTheDocument();
  });
});

describe("chordLabelForEvent", () => {
  it("reads the chord from the command that fired, not a guess about the action", () => {
    expect(chordLabelForEvent(MOVE_DOWN, "windows")).toBe("↓");
  });

  it("never labels a pointer-origin event as a keyboard chord", () => {
    const toolbarClick: RunEvent = {
      ...MOVE_DOWN,
      inputMethod: "pointer",
      command: "TOGGLE_BOLD",
      via: "toolbar",
      chord: null,
      controlId: "toolbar-bold",
    };

    expect(chordLabelForEvent(toolbarClick, "windows")).toBeNull();
  });

  it("never labels an unknown-origin event as a verified keyboard action", () => {
    const unknownOrigin: RunEvent = { ...MOVE_DOWN, inputMethod: "unknown" };

    expect(chordLabelForEvent(unknownOrigin, "windows")).toBeNull();
  });

  it("returns null for a legacy event recorded before the command layer existed", () => {
    const legacy: RunEvent = {
      atMs: 100,
      action: { kind: "select-cell", cell: { row: 1, col: 0 } },
      inputMethod: "keyboard",
    };

    expect(chordLabelForEvent(legacy, "windows")).toBeNull();
  });

  it("returns null when there is no event yet", () => {
    expect(chordLabelForEvent(undefined, "windows")).toBeNull();
  });
});

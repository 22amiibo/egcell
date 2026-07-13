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
  it("uses a reduced-motion, pointer-transparent overlay without changing grid dimensions", () => {
    render(<RunFeedbackLayer event="success" reducedMotion />);

    const layer = screen.getByTestId("run-feedback-layer");

    expect(layer).toHaveAttribute("data-motion", "reduced");
    expect(layer).toHaveAttribute("data-event", "success");
    expect(layer).toHaveClass("absolute", "inset-0", "pointer-events-none");
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

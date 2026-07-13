import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RunFeedbackLayer } from "@/components/game/RunFeedbackLayer";

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

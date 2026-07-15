import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { GameShell } from "@/components/game/GameShell";

/**
 * Regression: the grid keeps its keyboard anchor in refs. Before retry remounted the grid, those
 * refs survived the reset and the first arrow after a retry moved from the previous run's last
 * cell instead of from A1.
 */
describe("keyboard state across retry", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts arrowing from A1 again after a retry", async () => {
    render(<GameShell />);

    await userEvent.click(screen.getByRole("button", { name: "Speed" }));
    await userEvent.selectOptions(screen.getByLabelText("Challenge"), [
      screen.getByRole("option", { name: "Go to the last Revenue cell" }),
    ]);

    // Finish the run down at C7, then retry.
    await userEvent.click(screen.getByRole("button", { name: "C7" }));
    expect(screen.getByTestId("result-card")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    // The first keystroke of the new run must move from the fresh grid's A1, not from C7.
    fireEvent.keyDown(screen.getByRole("grid"), { key: "ArrowDown" });

    expect(screen.getByRole("button", { name: "A2" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "C8" })).toHaveAttribute("aria-pressed", "false");
  });
});

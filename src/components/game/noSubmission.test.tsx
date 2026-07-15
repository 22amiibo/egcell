import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GameShell } from "@/components/game/GameShell";

const selectRevenueColumn = () =>
  userEvent.click(screen.getByRole("button", { name: "Select column C" }));

const chooseRevenueChallenge = () =>
  userEvent.selectOptions(screen.getByLabelText("Challenge"), "selection.revenue-column");

describe("a completed run", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, "", "/");
    vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds a leaderboard-shaped result and sends it precisely nowhere", async () => {
    render(<GameShell />);

    await userEvent.click(screen.getByRole("button", { name: "Speed" }));
    await chooseRevenueChallenge();
    await selectRevenueColumn();
    await userEvent.click(screen.getByText("Details"));

    // The submission exists: the run digest is read straight off it.
    expect(screen.getByText("Run digest")).toBeVisible();
    expect(screen.getByText(/^v2:[0-9a-f]{8}$/)).toBeVisible();

    // There is no leaderboard yet, and no accounts. Nothing about a run may leave the machine.
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("counts the moves the player actually made", async () => {
    render(<GameShell />);

    await userEvent.click(screen.getByRole("button", { name: "Speed" }));

    // A wrong column, then the right one. Two moves.
    await chooseRevenueChallenge();
    await userEvent.click(screen.getByRole("button", { name: "Select column D" }));
    await selectRevenueColumn();

    await userEvent.click(screen.getByText("Details"));

    expect(screen.getByText("Moves").parentElement).toHaveTextContent("2");
  });
});

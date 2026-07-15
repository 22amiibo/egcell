import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { GameShell } from "@/components/game/GameShell";
import { defaultChallenge } from "@/data/challenges";

const chooseRevenueChallenge = () =>
  userEvent.selectOptions(screen.getByLabelText("Challenge"), "selection.revenue-column");

const selectRevenueColumn = async () => {
  await chooseRevenueChallenge();
  await userEvent.click(screen.getByRole("button", { name: "Select column C" }));
};

const switchToPractice = () => userEvent.click(screen.getByRole("button", { name: "Practice" }));
const switchToSpeed = () => userEvent.click(screen.getByRole("button", { name: "Speed" }));

describe("practice mode", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("starts in ascent mode, the flagship default", () => {
    render(<GameShell />);

    expect(screen.getByRole("button", { name: "Ascent" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Speed" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Practice" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("shows no hint during an active practice run", async () => {
    render(<GameShell />);

    await switchToPractice();

    // The run is live. Nothing may tell the player how to do it.
    expect(screen.queryByTestId("practice-notes")).not.toBeInTheDocument();
    expect(screen.queryByText(defaultChallenge.practiceNotes[0].body)).not.toBeInTheDocument();
  });

  it("shows the route notes once a practice run is over", async () => {
    render(<GameShell />);

    await switchToPractice();
    await selectRevenueColumn();

    expect(screen.getByTestId("practice-notes")).toBeVisible();
    expect(screen.getByText(defaultChallenge.practiceNotes[0].body)).toBeVisible();
  });

  it("never shows route notes in speed mode, even after the run is over", async () => {
    render(<GameShell />);

    await switchToSpeed();
    await selectRevenueColumn();

    expect(screen.getByTestId("result-card")).toBeVisible();
    expect(screen.queryByTestId("practice-notes")).not.toBeInTheDocument();
  });

  it("grades a practice run with the same validator", async () => {
    render(<GameShell />);

    await switchToPractice();
    await chooseRevenueChallenge();

    await userEvent.click(screen.getByRole("button", { name: "Select column D" }));
    expect(screen.queryByTestId("result-card")).not.toBeInTheDocument();

    await selectRevenueColumn();
    expect(screen.getByTestId("result-card")).toBeVisible();
  });

  it("keeps a practice record apart from a speed record", async () => {
    render(<GameShell />);

    await switchToSpeed();
    await selectRevenueColumn();
    expect(screen.getByTestId("best-time")).toHaveTextContent("best");

    await switchToPractice();

    // The speed record must not follow the player into practice, or a practice time could later be
    // read as a speed time.
    expect(screen.getByTestId("best-time")).toHaveTextContent("no record yet");
  });

  it("starts a fresh run when the mode changes", async () => {
    render(<GameShell />);

    await switchToSpeed();
    await selectRevenueColumn();
    expect(screen.getByTestId("result-card")).toBeVisible();

    await switchToPractice();

    expect(screen.queryByTestId("result-card")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "C1" })).toHaveAttribute("aria-pressed", "false");
  });
});

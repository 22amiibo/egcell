import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { GameShell } from "@/components/game/GameShell";

async function chooseChallenge(title: string) {
  await userEvent.selectOptions(screen.getByLabelText("Challenge"), [
    screen.getByRole("option", { name: title }),
  ]);
}

const selectRevenueColumn = () =>
  userEvent.click(screen.getByRole("button", { name: "Select column C" }));

describe("GameShell", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("opens straight into the first challenge, with no result card", () => {
    render(<GameShell />);

    expect(screen.getByRole("heading", { name: "Select the Revenue column." })).toBeVisible();
    expect(screen.getByRole("grid", { name: "Spreadsheet" })).toBeVisible();
    expect(screen.queryByTestId("result-card")).not.toBeInTheDocument();
  });

  it("shows the result card once the Revenue column is selected", async () => {
    render(<GameShell />);

    await selectRevenueColumn();

    expect(screen.getByTestId("result-card")).toBeVisible();
    expect(screen.getByTestId("score")).toHaveTextContent("points");
    expect(screen.getByTestId("pr-line")).toHaveTextContent("First personal record.");
  });

  it("does not end the run when the wrong column is selected", async () => {
    render(<GameShell />);

    await userEvent.click(screen.getByRole("button", { name: "Select column D" }));

    expect(screen.queryByTestId("result-card")).not.toBeInTheDocument();
  });

  it("clears the result card and the selection on retry", async () => {
    render(<GameShell />);

    await selectRevenueColumn();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(screen.queryByTestId("result-card")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "C1" })).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps the details behind a disclosure rather than crowding the card", async () => {
    render(<GameShell />);

    await selectRevenueColumn();

    expect(screen.getByText("Seed")).not.toBeVisible();

    await userEvent.click(screen.getByText("Details"));

    expect(screen.getByText("Seed")).toBeVisible();
  });
});

describe("the toolbar", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("stays away from a selection challenge, which has no use for it", () => {
    render(<GameShell />);

    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
  });

  it("offers only formatting on a formatting challenge", async () => {
    render(<GameShell />);

    await chooseChallenge("Bold the header row");

    expect(screen.getByRole("toolbar")).toBeVisible();
    expect(screen.getByRole("button", { name: "Bold" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Sort high to low" })).not.toBeInTheDocument();
  });

  it("offers only sorting on a sort challenge", async () => {
    render(<GameShell />);

    await chooseChallenge("Sort Revenue high to low");

    expect(screen.getByRole("button", { name: "Sort high to low" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Bold" })).not.toBeInTheDocument();
  });
});

describe("playing each family through the real UI", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("completes the navigation challenge by landing on the target cell", async () => {
    render(<GameShell />);

    await chooseChallenge("Go to the last Revenue cell");
    await userEvent.click(screen.getByRole("button", { name: "C7" }));

    expect(screen.getByTestId("result-card")).toBeVisible();
  });

  it("completes the bold-header challenge by selecting the row and bolding it", async () => {
    render(<GameShell />);

    await chooseChallenge("Bold the header row");
    await userEvent.click(screen.getByRole("button", { name: "Select row 1" }));
    await userEvent.click(screen.getByRole("button", { name: "Bold" }));

    expect(screen.getByTestId("result-card")).toBeVisible();
  });

  it("completes the currency challenge by selecting the column and formatting it", async () => {
    render(<GameShell />);

    await chooseChallenge("Format Revenue as currency");
    await userEvent.click(screen.getByRole("button", { name: "Select column C" }));
    await userEvent.click(screen.getByRole("button", { name: "Format as currency" }));

    expect(screen.getByTestId("result-card")).toBeVisible();
  });

  it("completes the sort challenge, and sorting the wrong way does not finish it", async () => {
    render(<GameShell />);

    await chooseChallenge("Sort Revenue high to low");
    await userEvent.click(screen.getByRole("button", { name: "C2" }));

    await userEvent.click(screen.getByRole("button", { name: "Sort low to high" }));
    expect(screen.queryByTestId("result-card")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Sort high to low" }));
    expect(screen.getByTestId("result-card")).toBeVisible();
  });

  it("completes the filter challenge by filtering to the selected East cell", async () => {
    render(<GameShell />);

    await chooseChallenge("Show only the East region");

    // A2 holds "East".
    await userEvent.click(screen.getByRole("button", { name: "A2" }));
    await userEvent.click(screen.getByRole("button", { name: "Filter to the selected value" }));

    expect(screen.getByTestId("result-card")).toBeVisible();
  });
});

describe("moving between challenges", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("advances to the next challenge from the result card", async () => {
    render(<GameShell />);

    await selectRevenueColumn();
    await userEvent.click(screen.getByRole("button", { name: "Next challenge" }));

    expect(
      screen.getByRole("heading", { name: "Go to the last cell of the Revenue column." }),
    ).toBeVisible();
    expect(screen.queryByTestId("result-card")).not.toBeInTheDocument();
  });

  it("starts a fresh run when the challenge changes, rather than carrying the old one over", async () => {
    render(<GameShell />);

    await selectRevenueColumn();
    expect(screen.getByTestId("result-card")).toBeVisible();

    await chooseChallenge("Select the header row");

    expect(screen.queryByTestId("result-card")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Select the header row." })).toBeVisible();
  });

  it("tracks a personal record per challenge, not one for the whole game", async () => {
    render(<GameShell />);

    await selectRevenueColumn();
    expect(screen.getByTestId("best-time")).toHaveTextContent("best");

    await chooseChallenge("Select the header row");

    expect(screen.getByTestId("best-time")).toHaveTextContent("no record yet");
  });
});

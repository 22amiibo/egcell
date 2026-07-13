import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { GameShell } from "@/components/game/GameShell";

async function selectRevenueColumn() {
  await userEvent.click(screen.getByRole("button", { name: "Select column C" }));
}

describe("GameShell", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("opens straight into the challenge, with no result card", () => {
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
    expect(screen.getByTestId("final-time")).toHaveTextContent("s");
  });

  it("does not end the run when the wrong column is selected", async () => {
    render(<GameShell />);

    await userEvent.click(screen.getByRole("button", { name: "Select column D" }));

    expect(screen.queryByTestId("result-card")).not.toBeInTheDocument();
  });

  it("lets a player recover from a wrong selection and still finish", async () => {
    render(<GameShell />);

    await userEvent.click(screen.getByRole("button", { name: "Select column D" }));
    await selectRevenueColumn();

    expect(screen.getByTestId("result-card")).toBeVisible();
  });

  it("banks a first personal record and shows it in the top bar", async () => {
    render(<GameShell />);

    await selectRevenueColumn();

    expect(screen.getByTestId("pr-line")).toHaveTextContent("First personal record.");
    expect(screen.getByTestId("best-time")).toHaveTextContent("best");
  });

  it("keeps the details behind a disclosure rather than crowding the card", async () => {
    render(<GameShell />);

    await selectRevenueColumn();

    expect(screen.getByText("Seed")).not.toBeVisible();

    await userEvent.click(screen.getByText("Details"));

    expect(screen.getByText("Seed")).toBeVisible();
  });

  it("clears the result card and the selection on retry", async () => {
    render(<GameShell />);

    await selectRevenueColumn();
    expect(screen.getByTestId("result-card")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(screen.queryByTestId("result-card")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "C1" })).toHaveAttribute("aria-pressed", "false");
  });

  it("can be completed again after a retry", async () => {
    render(<GameShell />);

    await selectRevenueColumn();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await selectRevenueColumn();

    expect(screen.getByTestId("result-card")).toBeVisible();
  });
});

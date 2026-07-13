import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { LeaderboardShell } from "@/components/leaderboard/LeaderboardShell";

describe("the local leaderboard shell", () => {
  it("offers humane board views without pretending a global service exists", () => {
    render(<LeaderboardShell />);

    expect(screen.getByRole("tab", { name: /daily/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: /friends/i })).toBeVisible();
    expect(screen.getByRole("tab", { name: /global/i })).toBeVisible();
    expect(screen.getByText(/near me/i)).toBeVisible();
    expect(screen.getByText(/no live ranking service is connected/i)).toBeVisible();
    expect(screen.queryByText(/#1/)).not.toBeInTheDocument();
  });

  it("switches board context with accessible tabs", async () => {
    const user = userEvent.setup();

    render(<LeaderboardShell />);

    await user.click(screen.getByRole("tab", { name: /skills/i }));

    expect(screen.getByRole("tab", { name: /skills/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tabpanel")).toHaveTextContent(/skill-specific/i);
  });

  it("moves between tabs with arrow keys", async () => {
    const user = userEvent.setup();

    render(<LeaderboardShell />);

    const daily = screen.getByRole("tab", { name: /daily/i });
    daily.focus();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("tab", { name: /weekly/i })).toHaveFocus();
    expect(screen.getByRole("tab", { name: /weekly/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});

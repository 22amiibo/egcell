import { expect, test } from "@playwright/test";

import { buildSessionQueue } from "../src/data/challenges/queue";
import { solveChallenge } from "./helpers/solveVariant";

test.describe("the local profile", () => {
  test("a finished run shows up in the history and the totals", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Challenge").selectOption({ label: "Select the Revenue column" });

    // One quick completed run.
    await page.getByRole("button", { name: "Select column C", exact: true }).click();
    await expect(page.getByTestId("result-card")).toBeVisible();

    await page.getByRole("link", { name: "Profile" }).click();

    await expect(page.getByTestId("total-runs")).toContainText("1");
    await expect(page.getByTestId("total-completed")).toContainText("1");
    // The table names the challenge by the record's own family and difficulty now, not by looking
    // its title up in a table of known titles (§8.3).
    await expect(page.getByTestId("recent-runs")).toContainText("selection");
    // One run is not a window onto anything, so the "latest 20 of N" footer stays quiet.
    await expect(page.getByTestId("recent-runs-footer")).toHaveCount(0);
    await expect(page.getByTestId("bests-by-mode").getByRole("cell", { name: "Speed" })).toBeVisible();

    // It survives a reload: this is storage, not component state.
    await page.reload();

    await expect(page.getByTestId("total-runs")).toContainText("1");

    // And the way back to the game is one click.
    await page.getByRole("link", { name: "Back to the game" }).click();
    await expect(page.getByRole("grid", { name: "Spreadsheet" })).toBeVisible();
  });

  test("a sprint lands in the history as one run of five tasks", async ({ page }) => {
    const seed = "e2e-profile";
    const queue = buildSessionQueue("sprint-5", seed);

    await page.goto(`/?sessionSeed=${seed}`);
    await page.getByRole("button", { name: "Sprint 5", exact: true }).click();

    for (const task of queue.tasks) {
      await solveChallenge(page, task.variant);
    }

    await expect(page.getByTestId("session-result-card")).toBeVisible();

    await page.getByRole("link", { name: "Profile" }).click();

    await expect(page.getByTestId("total-runs")).toContainText("1");
    await expect(page.getByTestId("total-completed")).toContainText("5");
    await expect(page.getByTestId("recent-runs")).toContainText("Sprint 5");
    await expect(page.getByTestId("recent-runs")).toContainText("PR");
  });
});

import { expect, test, type Page } from "@playwright/test";

/**
 * The page reads `ascentSeed` and `ascentDuration` from the URL, so this spec races a short,
 * pinned climb: an 8-second clock is long enough to interact with and short enough that waiting it
 * out is the whole point — the clock is the only thing that ends an Ascent run.
 */
const SEED = "e2e-ascent";

const gotoSeeded = (page: Page) => page.goto(`/?ascentSeed=${SEED}&ascentDuration=8`);

test.describe("ascent mode", () => {
  test("climbs under a fixed clock and ends only when the clock runs out", async ({ page }) => {
    await gotoSeeded(page);

    // Ascent is the flagship default: a fresh context lands on it with no mode selection at all.
    await expect(page.getByRole("button", { name: "Ascent", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // The tier meter is the ladder at a glance; it is present from the first task.
    await expect(page.getByRole("status")).toBeVisible();
    await expect(page.getByRole("status")).toHaveAccessibleName(/^Tier 1, heat 0 of 3$/);

    // Skipping never ends the run — the climb is still going after two skips.
    await page.getByRole("button", { name: "Skip task", exact: true }).click();
    await page.getByRole("button", { name: "Skip task", exact: true }).click();
    await expect(page.getByTestId("ascent-result-card")).toHaveCount(0);

    // Wait out the clock: only its expiry freezes the run into the summary.
    const card = page.getByTestId("ascent-result-card");

    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card.getByText("Peak tier")).toBeVisible();
    await expect(page.getByTestId("ascent-tasks")).toContainText("task");
  });
});

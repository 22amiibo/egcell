import { expect, test, type Page } from "@playwright/test";

/**
 * The assisted run, end to end: the player asks for the fastest path, is told what it costs, takes
 * the trade, and the run carries that for the rest of its life. Hiding the panel does not buy the
 * ranking back — that is the one thing this flow must never allow.
 */

// The fastest-path assist is a single-challenge feature; Ascent is the flagship default, so these
// specs select Speed to reach the assisted run.
const openSpeed = async (page: Page) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Speed", exact: true }).click();
};

test("revealing the fastest path unranks the run, and says so", async ({ page }) => {
  await openSpeed(page);

  await page.getByTestId("help-control").click();

  // The confirmation is the only protection there is, because the trade cannot be undone.
  await expect(page.getByTestId("help-confirm")).toContainText("Unranks this run.");
  await expect(page.getByTestId("unranked-badge")).toHaveCount(0);

  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByTestId("help-confirm")).toHaveCount(0);
  await expect(page.getByTestId("unranked-badge")).toHaveCount(0);

  await page.getByTestId("help-control").click();
  await page.getByRole("button", { name: "Reveal" }).click();

  const panel = page.getByRole("complementary", { name: "Fastest path" }).first();

  await expect(panel).toBeVisible();
  await expect(panel).toContainText("1.");
  await expect(page.getByTestId("unranked-badge")).toBeVisible();

  // Hiding is a display toggle, never an undo.
  await page.getByRole("button", { name: "Hide fastest path" }).click();
  await expect(page.getByRole("complementary", { name: "Fastest path" })).toHaveCount(0);
  await expect(page.getByTestId("unranked-badge")).toBeVisible();
});

test("a fresh run is rankable again", async ({ page }) => {
  await openSpeed(page);

  await page.getByTestId("help-control").click();
  await page.getByRole("button", { name: "Reveal" }).click();
  await expect(page.getByTestId("unranked-badge")).toBeVisible();

  // A new run has taken no help. The assist lives on the attempt, not on the player. A reload boots
  // back to the flagship default, so Speed is selected again to return to the assisted run.
  await page.reload();
  await page.getByRole("button", { name: "Speed", exact: true }).click();

  await expect(page.getByTestId("unranked-badge")).toHaveCount(0);
  await expect(page.getByTestId("help-control")).toHaveText("Show fastest path");
});

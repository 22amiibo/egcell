import { expect, test } from "@playwright/test";

/**
 * Keyboard-only play. No cell is ever clicked in these tests: the grid takes focus when the
 * challenge mounts, and every move from there is a keystroke.
 */
test.describe("keyboard-only play", () => {
  test("completes the navigation challenge with keys alone", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Challenge").selectOption({ label: "Go to the last Revenue cell" });

    // A1 -> B1 -> C1, then jump to the bottom of the Revenue data.
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ControlOrMeta+ArrowDown");

    await expect(page.getByTestId("result-card")).toBeVisible();
  });

  test("bolds the header row with keys alone", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Challenge").selectOption({ label: "Bold the header row" });

    // Shift+Space selects row 1, the modifier plus B bolds it.
    await page.keyboard.press("Shift+Space");
    await page.keyboard.press("ControlOrMeta+b");

    await expect(page.getByTestId("result-card")).toBeVisible();
  });

  test("selects the whole table with one keystroke", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Challenge").selectOption({ label: "Select the whole table" });

    await page.keyboard.press("ControlOrMeta+a");

    await expect(page.getByTestId("result-card")).toBeVisible();
  });

  test("mouse selection still works after keyboard use", async ({ page }) => {
    await page.goto("/");

    await page.keyboard.press("ArrowDown");
    await page.getByRole("button", { name: "Select column C", exact: true }).click();

    await expect(page.getByTestId("result-card")).toBeVisible();
  });
});

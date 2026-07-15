import { expect, test, type Page } from "@playwright/test";

/**
 * Keyboard-only play. No cell is ever clicked in these tests: the grid takes focus when the
 * challenge mounts, and every move from there is a keystroke.
 */

// The challenge picker lives in single-challenge play; Ascent is the flagship default, so these
// specs select Speed before choosing a specific drill.
const open = async (page: Page) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Speed", exact: true }).click();
};

test.describe("keyboard-only play", () => {
  test("completes the navigation challenge with keys alone", async ({ page }) => {
    await open(page);
    await page.getByLabel("Challenge").selectOption({ label: "Go to the last Revenue cell" });
    await expect(page.getByRole("grid", { name: "Spreadsheet" })).toBeFocused();

    // A1 -> B1 -> C1, then jump to the bottom of the Revenue data.
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ControlOrMeta+ArrowDown");

    await expect(page.getByTestId("result-card")).toBeVisible();
  });

  test("bolds the header row with keys alone", async ({ page }) => {
    await open(page);
    await page.getByLabel("Challenge").selectOption({ label: "Bold the header row" });
    await expect(page.getByRole("grid", { name: "Spreadsheet" })).toBeFocused();

    // Shift+Space selects row 1, the modifier plus B bolds it.
    await page.keyboard.press("Shift+Space");
    await page.keyboard.press("ControlOrMeta+b");

    await expect(page.getByTestId("result-card")).toBeVisible();
  });

  test("selects the whole table with one keystroke", async ({ page }) => {
    await open(page);
    await page.getByLabel("Challenge").selectOption({ label: "Select the whole table" });
    await expect(page.getByRole("grid", { name: "Spreadsheet" })).toBeFocused();

    await page.keyboard.press("ControlOrMeta+a");

    await expect(page.getByTestId("result-card")).toBeVisible();
  });

  test("solves a sort-filter challenge with zero mouse events, via the FilterMenu", async ({
    page,
  }) => {
    await open(page);
    await page.getByLabel("Challenge").selectOption({ label: "Show only Complete rows" });
    await expect(page.getByRole("grid", { name: "Spreadsheet" })).toBeFocused();

    // A1 -> Status column, on a Complete row.
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");

    // Alt+↓ opens FilterMenu; Sort A-Z, Sort Z-A, then Filter to "Complete".
    await page.keyboard.press("Alt+ArrowDown");
    await expect(page.getByRole("listbox")).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    await expect(page.getByTestId("result-card")).toBeVisible();
  });

  test("mouse selection still works after keyboard use", async ({ page }) => {
    await open(page);
    await page.getByLabel("Challenge").selectOption({ label: "Select the Revenue column" });

    await page.keyboard.press("ArrowDown");
    await page.getByRole("button", { name: "Select column C", exact: true }).click();

    await expect(page.getByTestId("result-card")).toBeVisible();
  });
});

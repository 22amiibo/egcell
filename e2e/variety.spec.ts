import { expect, test, type Page } from "@playwright/test";

async function pickChallenge(page: Page, title: string) {
  await page.goto("/");
  await page.getByLabel("Challenge").selectOption({ label: title });
}

/** A representative of each new group, played by its intended route. */
test.describe("the expanded challenge pool", () => {
  test("finding Dara's Units rewards reading the table", async ({ page }) => {
    await pickChallenge(page, "Find Dara's Units");

    await page.getByRole("button", { name: "D5", exact: true }).click();

    await expect(page.getByTestId("result-card")).toBeVisible();
  });

  test("the header can be unbolded with the keyboard toggle", async ({ page }) => {
    await pickChallenge(page, "Unbold the header row");

    // Land on A1 as a selection, take the header run, toggle the bold off.
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ControlOrMeta+Shift+ArrowRight");
    await page.keyboard.press("ControlOrMeta+b");

    await expect(page.getByTestId("result-card")).toBeVisible();
  });

  test("the threshold filter keeps only the rows above the selected value", async ({ page }) => {
    await pickChallenge(page, "Show Units above Bruno's");

    // D3 holds Bruno's 201.
    await page.getByRole("button", { name: "D3", exact: true }).click();
    await page.getByRole("button", { name: "Filter above the selected value", exact: true }).click();

    await expect(page.getByTestId("result-card")).toBeVisible();
  });

  test("a mixed challenge needs both halves before it completes", async ({ page }) => {
    await pickChallenge(page, "Sort Revenue and bold the header");

    await page.getByRole("button", { name: "C2", exact: true }).click();
    await page.getByRole("button", { name: "Sort high to low", exact: true }).click();

    // Half done: no result yet.
    await expect(page.getByTestId("result-card")).not.toBeVisible();

    await page.getByRole("button", { name: "Select row 1", exact: true }).click();
    await page.getByRole("button", { name: "Bold", exact: true }).click();

    await expect(page.getByTestId("result-card")).toBeVisible();
  });

  test("a two-column data selection lands with keys alone", async ({ page }) => {
    await pickChallenge(page, "Select the Revenue and Units figures");

    // A1 -> C1 -> C2, then take the column of figures and widen one column.
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ControlOrMeta+Shift+ArrowDown");
    await page.keyboard.press("Shift+ArrowRight");

    await expect(page.getByTestId("result-card")).toBeVisible();
  });
});

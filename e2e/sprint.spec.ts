import { expect, test, type Page } from "@playwright/test";

const clickButton = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true }).click();

/** Tasks 1-5 of the deterministic queue, by their fastest routes. */
async function completeFirstFiveTasks(page: Page) {
  await clickButton(page, "Select column C");
  await clickButton(page, "C7");
  await clickButton(page, "Select row 1");
  await page.keyboard.press("ControlOrMeta+a");
  await clickButton(page, "Select row 1");
  await clickButton(page, "Bold");
}

/** Tasks 6-10: currency, sort, filter, then the first two of the expanded pool. */
async function completeTasksSixThroughTen(page: Page) {
  await clickButton(page, "Select column C");
  await clickButton(page, "Format as currency");

  await clickButton(page, "C2");
  await clickButton(page, "Sort high to low");

  await clickButton(page, "A2");
  await clickButton(page, "Filter to the selected value");

  // Go to the first Region entry.
  await clickButton(page, "A2");

  // Go to the last cell of the Status column.
  await clickButton(page, "E7");
}

test.describe("sprint mode", () => {
  test("a five-task sprint runs to a session result and banks a record", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Sprint 5", exact: true }).click();

    await expect(page.getByText(/task 1 of 5/)).toBeVisible();

    await completeFirstFiveTasks(page);

    const card = page.getByTestId("session-result-card");
    await expect(card).toBeVisible();
    await expect(page.getByTestId("session-tasks")).toContainText("5 of 5");
    await expect(page.getByTestId("session-pr-line")).toContainText(
      "First personal record for this mode.",
    );

    // The breakdown lists every task.
    await card.getByText("Task breakdown").click();
    await expect(card.getByText("1. Select the Revenue column")).toBeVisible();
    await expect(card.getByText("5. Bold the header row")).toBeVisible();
  });

  test("a ten-task sprint wraps around the challenge pool and completes", async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto("/");
    await page.getByRole("button", { name: "Sprint 10", exact: true }).click();

    await expect(page.getByText(/task 1 of 10/)).toBeVisible();

    await completeFirstFiveTasks(page);
    await completeTasksSixThroughTen(page);

    await expect(page.getByTestId("session-result-card")).toBeVisible();
    await expect(page.getByTestId("session-tasks")).toContainText("10 of 10");
  });

  test("skipping leaves partial credit and a completion below full", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Sprint 5", exact: true }).click();

    await clickButton(page, "Select column C");
    await clickButton(page, "Skip task");
    await clickButton(page, "Select row 1");
    await page.keyboard.press("ControlOrMeta+a");
    await clickButton(page, "Select row 1");
    await clickButton(page, "Bold");

    await expect(page.getByTestId("session-result-card")).toBeVisible();
    await expect(page.getByTestId("session-tasks")).toContainText("4 of 5");
  });

  test("a sprint record survives a reload, separately per sprint length", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Sprint 5", exact: true }).click();
    await completeFirstFiveTasks(page);
    await expect(page.getByTestId("session-result-card")).toBeVisible();
    await expect(page.getByTestId("best-time")).toContainText("pts");

    await page.reload();

    await page.getByRole("button", { name: "Sprint 5", exact: true }).click();
    await expect(page.getByTestId("best-time")).toContainText("pts");

    // Sprint 10 has its own empty book.
    await page.getByRole("button", { name: "Sprint 10", exact: true }).click();
    await expect(page.getByTestId("best-time")).toContainText("no record yet");
  });
});

import { expect, test } from "@playwright/test";

// Each test runs in its own browser context, so localStorage starts empty and "first personal
// record" means what it says. Do not clear storage with addInitScript: that script re-runs on every
// navigation, so it would wipe the record in the middle of the reload test below.

test("the app opens directly into the challenge", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Select the Revenue column." })).toBeVisible();
  await expect(page.getByRole("grid", { name: "Spreadsheet" })).toBeVisible();
  await expect(page.getByTestId("result-card")).toBeHidden();
});

test("the clock is already running before the player acts", async ({ page }) => {
  await page.goto("/");

  const timer = page.getByTestId("timer");
  const first = await timer.textContent();

  await expect.poll(async () => timer.textContent(), { timeout: 3000 }).not.toBe(first);
});

test("selecting the Revenue column completes the run and banks a first record", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Select column C" }).click();

  await expect(page.getByTestId("result-card")).toBeVisible();
  await expect(page.getByTestId("final-time")).toContainText("s");
  await expect(page.getByTestId("score")).toContainText("points");
  await expect(page.getByTestId("pr-line")).toContainText("First personal record.");
});

test("selecting the wrong column leaves the run going", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Select column D" }).click();

  await expect(page.getByTestId("result-card")).toBeHidden();

  // The player recovers and still finishes.
  await page.getByRole("button", { name: "Select column C" }).click();
  await expect(page.getByTestId("result-card")).toBeVisible();
});

test("the result card keeps its details behind a disclosure", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Select column C" }).click();

  await expect(page.getByText("Seed")).toBeHidden();

  await page.getByText("Details").click();

  await expect(page.getByText("Seed")).toBeVisible();
});

test("retry clears the result and starts a fresh run", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Select column C" }).click();
  await expect(page.getByTestId("result-card")).toBeVisible();

  await page.getByRole("button", { name: "Retry" }).click();

  await expect(page.getByTestId("result-card")).toBeHidden();
  await expect(page.getByRole("grid", { name: "Spreadsheet" })).toBeFocused();

  // Exact, or the accessible-name match would also catch C10, C11, and C12.
  await expect(page.getByRole("button", { name: "C1", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  // The new run is live: it can be completed again.
  await page.getByRole("button", { name: "Select column C" }).click();
  await expect(page.getByTestId("result-card")).toBeVisible();
});

test("a personal record survives a reload and is shown in the top bar", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Select column C" }).click();
  await expect(page.getByTestId("pr-line")).toContainText("First personal record.");
  await expect(page.getByTestId("best-time")).toContainText("best");

  await page.reload();

  await expect(page.getByTestId("best-time")).toContainText("best");

  // A second run is measured against the stored record rather than treated as the first.
  await page.getByRole("button", { name: "Select column C" }).click();
  await expect(page.getByTestId("pr-line")).not.toContainText("First personal record.");
});

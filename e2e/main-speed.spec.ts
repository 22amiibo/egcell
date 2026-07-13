import { expect, test, type Page } from "@playwright/test";

import { buildNormalSpeedQueue } from "../src/data/challenges/queue";

// Each test runs in its own browser context, so localStorage starts empty and "first personal
// record" means what it says. Do not clear storage with addInitScript: that script re-runs on every
// navigation, so it would wipe the record in the middle of the reload test below.

const MAIN_SEED = "e2e-main-speed";

async function gotoClassicRevenue(page: Page) {
  await page.goto(`/?sessionSeed=${MAIN_SEED}`);
  await page.getByLabel("Challenge").selectOption("selection.revenue-column");
}

test("the app opens directly into the explicit seeded normal queue", async ({ page }) => {
  const queue = buildNormalSpeedQueue(MAIN_SEED);

  await page.goto(`/?sessionSeed=${MAIN_SEED}`);

  await expect(page.getByRole("heading", { name: queue.tasks[0].variant.prompt })).toBeVisible();
  await expect(page.getByRole("grid", { name: "Spreadsheet" })).toBeVisible();
  await expect(page.getByTestId("result-card")).toBeHidden();
});

test("two unseeded normal starts use two injected browser seeds", async ({ page }) => {
  const firstQueue = buildNormalSpeedQueue("normal-e2e-1");
  const secondQueue = buildNormalSpeedQueue("normal-e2e-2");

  expect(firstQueue.tasks[0].variant.prompt).not.toBe(secondQueue.tasks[0].variant.prompt);

  await page.addInitScript(() => {
    const next = Number(window.sessionStorage.getItem("normal-seed-draw") ?? "0") + 1;

    window.sessionStorage.setItem("normal-seed-draw", String(next));
    Object.defineProperty(window.crypto, "randomUUID", {
      configurable: true,
      value: () => `normal-e2e-${next}`,
    });
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: firstQueue.tasks[0].variant.prompt })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: secondQueue.tasks[0].variant.prompt })).toBeVisible();
});

test("the clock is already running before the player acts", async ({ page }) => {
  await page.goto(`/?sessionSeed=${MAIN_SEED}`);

  const timer = page.getByTestId("timer");
  const first = await timer.textContent();

  await expect.poll(async () => timer.textContent(), { timeout: 3000 }).not.toBe(first);
});

test("selecting the Revenue column completes the run and banks a first record", async ({
  page,
}) => {
  await gotoClassicRevenue(page);

  await page.getByRole("button", { name: "Select column C" }).click();

  await expect(page.getByTestId("result-card")).toBeVisible();
  await expect(page.getByTestId("final-time")).toContainText("s");
  await expect(page.getByTestId("score")).toContainText("points");
  await expect(page.getByTestId("pr-line")).toContainText("First personal record.");
});

test("selecting the wrong column leaves the run going", async ({ page }) => {
  await gotoClassicRevenue(page);

  await page.getByRole("button", { name: "Select column D" }).click();

  await expect(page.getByTestId("result-card")).toBeHidden();

  // The player recovers and still finishes.
  await page.getByRole("button", { name: "Select column C" }).click();
  await expect(page.getByTestId("result-card")).toBeVisible();
});

test("the result card keeps its details behind a disclosure", async ({ page }) => {
  await gotoClassicRevenue(page);
  await page.getByRole("button", { name: "Select column C" }).click();

  await expect(page.getByText("Seed")).toBeHidden();

  await page.getByText("Details").click();

  await expect(page.getByText("Seed")).toBeVisible();
});

test("retry clears the result and starts a fresh run", async ({ page }) => {
  await gotoClassicRevenue(page);
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
  await gotoClassicRevenue(page);
  await page.getByRole("button", { name: "Select column C" }).click();
  await expect(page.getByTestId("pr-line")).toContainText("First personal record.");
  await expect(page.getByTestId("best-time")).toContainText("best");

  await page.reload();
  await page.getByLabel("Challenge").selectOption("selection.revenue-column");

  await expect(page.getByTestId("best-time")).toContainText("best");

  // A second run is measured against the stored record rather than treated as the first.
  await page.getByRole("button", { name: "Select column C" }).click();
  await expect(page.getByTestId("pr-line")).not.toContainText("First personal record.");
});

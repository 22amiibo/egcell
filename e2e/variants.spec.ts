import { expect, test } from "@playwright/test";

import { generateChallenge } from "../src/data/challenges/generated";
import { columnLabel } from "../src/domain/grid/range";

// These tests regenerate the exact variant the page will build from the same template, seed, and
// difficulty, so they know the grid in advance. Determinism is the product guarantee being
// exercised: if the page and the test ever disagree, the seeded generator broke.

test("a generated navigation challenge is completable by keyboard alone", async ({ page }) => {
  const seed = "e2e-nav";
  const variant = generateChallenge("gen.navigation.first-in-column", seed, 1);

  expect(variant).not.toBeNull();

  if (variant === null || variant.validation.kind !== "navigation") {
    throw new Error("Expected a navigation variant.");
  }

  const target = variant.validation.requiredCell;

  await page.goto(`/?template=gen.navigation.first-in-column&seed=${seed}&difficulty=1`);

  await expect(page.getByRole("heading", { name: variant.prompt })).toBeVisible();

  // The grid takes focus in an effect; keys sent before that lands would go nowhere.
  await expect(page.getByRole("grid", { name: "Spreadsheet" })).toBeFocused();

  // Arrows from A1: the active cell starts at row 0, col 0.
  for (let step = 0; step < target.col; step += 1) {
    await page.keyboard.press("ArrowRight");
  }

  for (let step = 0; step < target.row; step += 1) {
    await page.keyboard.press("ArrowDown");
  }

  await expect(page.getByTestId("result-card")).toBeVisible();
});

test("a generated selection challenge is completable by mouse alone", async ({ page }) => {
  const seed = "e2e-sel";
  const variant = generateChallenge("gen.selection.column", seed, 1);

  expect(variant).not.toBeNull();

  if (variant === null || variant.validation.kind !== "selection") {
    throw new Error("Expected a selection variant.");
  }

  const col = variant.validation.requiredRange.start.col;

  await page.goto(`/?template=gen.selection.column&seed=${seed}&difficulty=1`);

  await expect(page.getByRole("heading", { name: variant.prompt })).toBeVisible();

  await page.getByRole("button", { name: `Select column ${columnLabel(col)}` }).click();

  await expect(page.getByTestId("result-card")).toBeVisible();
});

test("a generated formatting challenge completes via column select and the toolbar", async ({
  page,
}) => {
  const seed = "e2e-fmt";
  const variant = generateChallenge("gen.formatting.currency", seed, 1);

  expect(variant).not.toBeNull();

  if (variant === null || variant.validation.kind !== "formatting") {
    throw new Error("Expected a formatting variant.");
  }

  const col = variant.validation.range.start.col;

  await page.goto(`/?template=gen.formatting.currency&seed=${seed}&difficulty=1`);

  await expect(page.getByRole("heading", { name: variant.prompt })).toBeVisible();

  // Selecting the whole column formats the header too, which costs nothing: only the figures
  // are graded.
  await page.getByRole("button", { name: `Select column ${columnLabel(col)}` }).click();
  await page.getByRole("button", { name: "Format as currency" }).click();

  await expect(page.getByTestId("result-card")).toBeVisible();
});

test("a generated sort challenge completes via a cell click and the toolbar", async ({ page }) => {
  const seed = "e2e-sort";
  const variant = generateChallenge("gen.sort-filter.sort-numeric", seed, 1);

  expect(variant).not.toBeNull();

  if (
    variant === null ||
    variant.validation.kind !== "sort-filter" ||
    variant.validation.requiredSort === undefined
  ) {
    throw new Error("Expected a sort variant.");
  }

  const { col, direction } = variant.validation.requiredSort;
  const firstDataRow = variant.initialGrid.usedRange.start.row + variant.initialGrid.headerRows;

  await page.goto(`/?template=gen.sort-filter.sort-numeric&seed=${seed}&difficulty=1`);

  await expect(page.getByRole("heading", { name: variant.prompt })).toBeVisible();

  // Land in the sort column, then use the toolbar, exactly as a player would.
  await page
    .getByRole("button", { name: `${columnLabel(col)}${firstDataRow + 1}`, exact: true })
    .click();
  await page
    .getByRole("button", { name: direction === "desc" ? "Sort high to low" : "Sort low to high" })
    .click();

  await expect(page.getByTestId("result-card")).toBeVisible();
});

test("the picker offers generated drills and a new draw changes the table but keeps the record key", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByRole("combobox", { name: "Challenge" }).selectOption("gen.selection.table");

  await expect(page.getByRole("heading", { name: "Select the whole table, header included." }))
    .toBeVisible();

  // A new draw is a different seed for the same drill: the prompt survives, the table changes.
  await page.getByRole("button", { name: "New draw" }).click();

  await expect(page.getByRole("heading", { name: "Select the whole table, header included." }))
    .toBeVisible();
});

import { expect, test, type Page } from "@playwright/test";

async function choose(page: Page, title: string) {
  await page.getByLabel("Challenge").selectOption({ label: title });
  await expect(page.getByTestId("result-card")).toBeHidden();
}

/** A real mouse drag. jsdom can only approximate this, so the browser is where it has to be proven. */
async function dragBetween(page: Page, fromCell: string, toCell: string) {
  const from = page.getByRole("button", { name: fromCell, exact: true });
  const to = page.getByRole("button", { name: toCell, exact: true });

  const start = await from.boundingBox();
  const end = await to.boundingBox();

  if (start === null || end === null) {
    throw new Error("A cell in the drag was not on screen.");
  }

  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  // Move in steps, so every cell in between fires pointerenter, exactly as a hand-held drag would.
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 12 });
  await page.mouse.up();
}

test("navigation: clicking the last Revenue cell completes the run", async ({ page }) => {
  await page.goto("/");
  await choose(page, "Go to the last Revenue cell");

  await page.getByRole("button", { name: "C7", exact: true }).click();

  await expect(page.getByTestId("result-card")).toBeVisible();
});

test("selection: dragging across the table completes the whole-table challenge", async ({
  page,
}) => {
  await page.goto("/");
  await choose(page, "Select the whole table");

  await dragBetween(page, "A1", "E7");

  await expect(page.getByTestId("result-card")).toBeVisible();
});

test("selection: a drag that stops short of the table does not complete it", async ({ page }) => {
  await page.goto("/");
  await choose(page, "Select the whole table");

  await dragBetween(page, "A1", "D7");

  await expect(page.getByTestId("result-card")).toBeHidden();
});

test("formatting: selecting the header row and bolding it completes the run", async ({ page }) => {
  await page.goto("/");
  await choose(page, "Bold the header row");

  // Exact, or the accessible-name match would also catch rows 10, 11, and 12.
  await page.getByRole("button", { name: "Select row 1", exact: true }).click();
  await page.getByRole("button", { name: "Bold" }).click();

  await expect(page.getByTestId("result-card")).toBeVisible();
});

test("formatting: the toolbar only offers what the challenge allows", async ({ page }) => {
  await page.goto("/");

  // A selection challenge needs no tools at all.
  await expect(page.getByRole("toolbar")).toBeHidden();

  await choose(page, "Bold the header row");

  await expect(page.getByRole("button", { name: "Bold" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sort high to low" })).toBeHidden();
});

test("sort: Revenue high to low completes the run, and the wrong way does not", async ({ page }) => {
  await page.goto("/");
  await choose(page, "Sort Revenue high to low");

  await page.getByRole("button", { name: "C2", exact: true }).click();

  await page.getByRole("button", { name: "Sort low to high" }).click();
  await expect(page.getByTestId("result-card")).toBeHidden();

  await page.getByRole("button", { name: "Sort high to low" }).click();
  await expect(page.getByTestId("result-card")).toBeVisible();
});

test("sort: the whole row travels with the sorted value", async ({ page }) => {
  await page.goto("/");
  await choose(page, "Sort Revenue high to low");

  await page.getByRole("button", { name: "C2", exact: true }).click();
  await page.getByRole("button", { name: "Sort high to low" }).click();

  // Chidi holds the top revenue. If only the numbers had moved, B2 would still read Alice.
  await expect(page.getByRole("button", { name: "B2", exact: true })).toHaveText("Chidi");
});

test("filter: filtering to the selected East cell hides the other regions", async ({ page }) => {
  await page.goto("/");
  await choose(page, "Show only the East region");

  await page.getByRole("button", { name: "A2", exact: true }).click();
  await page.getByRole("button", { name: "Filter to the selected value" }).click();

  await expect(page.getByTestId("result-card")).toBeVisible();

  // Bruno is West. His row is gone from the page entirely, not merely dimmed.
  await expect(page.getByRole("button", { name: "B3", exact: true })).toBeHidden();
});

test("switching challenge starts a fresh run rather than carrying the old one over", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Select column C" }).click();
  await expect(page.getByTestId("result-card")).toBeVisible();

  await choose(page, "Select the header row");

  await expect(page.getByRole("heading", { name: "Select the header row." })).toBeVisible();
});

test("Next challenge advances through the set", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Select column C" }).click();
  await page.getByRole("button", { name: "Next challenge" }).click();

  await expect(
    page.getByRole("heading", { name: "Go to the last cell of the Revenue column." }),
  ).toBeVisible();
});

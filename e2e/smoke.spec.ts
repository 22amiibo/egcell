import { expect, test } from "@playwright/test";

test("the game surface renders", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Select the Revenue column." })).toBeVisible();
  await expect(page.getByRole("grid", { name: "Spreadsheet" })).toBeVisible();
});

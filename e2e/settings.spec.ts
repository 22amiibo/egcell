import { expect, test } from "@playwright/test";

test("a chosen theme applies everywhere, instantly, and survives a reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Settings" }).click();
  await page.evaluate(() => {
    (window as Window & { __themeSentinel?: string }).__themeSentinel = "same-document";
  });

  await page.getByRole("button", { name: /Paper Grid/ }).click();

  // Applied live on the settings page itself.
  await expect(page.locator("html")).toHaveAttribute("data-theme", "paper-grid");
  await expect(page).toHaveURL(/\/settings$/);
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as Window & { __themeSentinel?: string }).__themeSentinel,
      ),
    )
    .toBe("same-document");

  // Still applied on the game page.
  await page.getByRole("link", { name: "Back to the game" }).click();
  await expect(page.getByRole("grid", { name: "Spreadsheet" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "paper-grid");

  // And after a full reload, with the boot script doing the early work.
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "paper-grid");

  const canvas = await page.evaluate(() =>
    document.documentElement.style.getPropertyValue("--color-canvas"),
  );
  expect(canvas).toBe("#f7f6f0");
});

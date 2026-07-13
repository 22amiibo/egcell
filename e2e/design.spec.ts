import { expect, test } from "@playwright/test";

test("practice screen keeps the spreadsheet grid dominant", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  const grid = await page.getByTestId("grid-stage").boundingBox();
  const prompt = await page.getByTestId("prompt-rail").boundingBox();
  const stats = await page.getByTestId("live-stats-bar").boundingBox();

  expect(grid).not.toBeNull();
  expect(prompt).not.toBeNull();
  expect(stats).not.toBeNull();

  const area = (box: NonNullable<typeof grid>) => box.width * box.height;

  expect(area(grid!)).toBeGreaterThan(area(prompt!));
  expect(area(grid!)).toBeGreaterThan(area(stats!));
});

test("settings categories are reachable with the keyboard", async ({ page }) => {
  await page.goto("/settings");

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Back to the game" })).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(page.getByRole("tab", { name: "Appearance" })).toBeFocused();

  for (const category of [
    "Appearance",
    "Grid",
    "Gameplay",
    "Scoring",
    "Feedback",
    "Sound",
    "Accessibility",
    "Privacy",
  ]) {
    const tab = page.getByRole("tab", { name: category });

    await expect(tab).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(tab).toHaveAttribute("aria-selected", "true");

    if (category !== "Privacy") {
      await page.keyboard.press("Tab");
    }
  }
});

test("reduced motion disables decorative animation", async ({ page }) => {
  await page.goto("/");

  const fullMotionCue = page.locator(".run-feedback-cue");
  await expect(fullMotionCue).toBeVisible();
  await expect(fullMotionCue).toHaveCSS("animation-name", "run-feedback-in");

  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Accessibility" }).click();
  await page.getByRole("checkbox", { name: "Reduced motion" }).click();

  await expect(page.locator("html")).toHaveAttribute("data-reduced-motion", "true");
  await page.getByRole("link", { name: "Back to the game" }).click();

  const cue = page.locator(".run-feedback-cue");
  await expect(cue).toBeVisible();
  await expect(cue).toHaveCSS("animation-name", "none");
});

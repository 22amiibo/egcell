import { expect, test, type Page } from "@playwright/test";

import { generateChallenge } from "../src/data/challenges/generated";
import { columnLabel } from "../src/domain/grid/range";

/**
 * The typing verb, end to end. These specs regenerate the exact copy-value drill the page builds
 * from the same template, seed, and difficulty — the `?template=` deep link runs `generateChallenge`
 * with these args — so the test knows the target cell and the value to type without scraping the
 * grid, the same determinism `variants.spec` relies on.
 *
 * Note: WPM is measured onto the run record (Phase 2 typing stats), but the single-run result card
 * does not render it, so there is no WPM stat on this surface to assert — accuracy is the visible
 * keystroke signal, and it is what these specs check.
 */
const TEMPLATE = "gen.formula.copy-value";
const SEED = "e2e-typing";
const DIFFICULTY = 2;

function copyValueDrill() {
  const variant = generateChallenge(TEMPLATE, SEED, DIFFICULTY);

  if (variant === null || variant.validation.kind !== "cell-value") {
    throw new Error("Expected a cell-value copy drill for this seed.");
  }

  const { cell, expected } = variant.validation;
  const value = expected.kind === "number" ? String(expected.value) : expected.value;

  return { prompt: variant.prompt, cell, value };
}

const targetCellButton = (page: Page, cell: { row: number; col: number }) =>
  page.getByRole("button", { name: `${columnLabel(cell.col)}${cell.row + 1}`, exact: true });

// The Accuracy StatRow renders its label and value as adjacent spans; this is the value span.
const accuracyValue = (page: Page) =>
  page
    .getByTestId("result-card")
    .getByText("Accuracy", { exact: true })
    .locator("xpath=following-sibling::span[1]");

async function openDrill(page: Page, prompt: string) {
  await page.goto(`/?template=${TEMPLATE}&seed=${SEED}&difficulty=${DIFFICULTY}`);
  await expect(page.getByRole("heading", { name: prompt })).toBeVisible();
  // The grid takes focus in an effect; F2 sent before that lands would go nowhere.
  await expect(page.getByRole("grid", { name: "Spreadsheet" })).toBeFocused();
}

async function openEditor(page: Page, cell: { row: number; col: number }) {
  await targetCellButton(page, cell).click();
  await page.keyboard.press("F2");

  return page.getByRole("textbox", { name: "Edit cell" });
}

test.describe("typing a value to complete a drill", () => {
  test("typing the copied value completes the run at full accuracy", async ({ page }) => {
    const { prompt, cell, value } = copyValueDrill();

    await openDrill(page, prompt);

    const editor = await openEditor(page, cell);

    await editor.pressSequentially(value);
    await editor.press("Enter");

    await expect(page.getByTestId("result-card")).toBeVisible();
    // A clean type: no characters were removed, so keystroke accuracy is a perfect 100%.
    await expect(accuracyValue(page)).toHaveText("100%");
  });

  test("a corrected typo drags accuracy below 100%", async ({ page }) => {
    const { prompt, cell, value } = copyValueDrill();

    await openDrill(page, prompt);

    const editor = await openEditor(page, cell);

    // Type the value, add a wrong character, then backspace it out: one correction against the
    // total. The committed buffer is still the correct value, so the drill completes.
    await editor.pressSequentially(value);
    await editor.pressSequentially("x");
    await editor.press("Backspace");
    await editor.press("Enter");

    await expect(page.getByTestId("result-card")).toBeVisible();
    await expect(accuracyValue(page)).not.toHaveText("100%");
  });
});

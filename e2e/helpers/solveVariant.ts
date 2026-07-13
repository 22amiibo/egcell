import type { Page } from "@playwright/test";

import type { Challenge, LeafValidationSpec } from "../../src/domain/challenges/challengeTypes";
import type { RangeAddress } from "../../src/domain/grid/gridTypes";
import { cellKey, columnLabel, normalizeRange } from "../../src/domain/grid/range";

/**
 * Drives the real browser grid the way a player would, for any variant the seeded queue deals.
 * Session specs compute the queue from the same seed the page uses, then solve each task here.
 */

const cellName = (row: number, col: number) => `${columnLabel(col)}${row + 1}`;

const cell = (page: Page, row: number, col: number) =>
  page.getByRole("button", { name: cellName(row, col), exact: true });

async function selectRange(page: Page, range: RangeAddress) {
  const { start, end } = normalizeRange(range);

  if (start.row === end.row && start.col === end.col) {
    await cell(page, start.row, start.col).click();

    return;
  }

  // A real drag, with raw mouse moves. When the landed range completes a session's final task,
  // the result overlay mounts the instant the pointer enters the end cell; locator.hover() would
  // then retry against the overlay forever, while a raw move has nothing to re-verify.
  const startBox = await cell(page, start.row, start.col).boundingBox();
  const endBox = await cell(page, end.row, end.col).boundingBox();

  if (startBox === null || endBox === null) {
    throw new Error("Drag cells are not on screen.");
  }

  await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(endBox.x + endBox.width / 2, endBox.y + endBox.height / 2);
  await page.mouse.up();
}

async function solvePart(page: Page, challenge: Challenge, part: LeafValidationSpec) {
  switch (part.kind) {
    case "navigation":
      await cell(page, part.requiredCell.row, part.requiredCell.col).click();

      return;

    case "selection":
      await selectRange(page, part.requiredRange);

      return;

    case "formatting": {
      await selectRange(page, part.range);

      const format = part.requiredFormat;

      if (format.bold !== undefined) {
        await page.getByRole("button", { name: "Bold" }).click();
      }

      if (format.numberFormat === "currency") {
        await page.getByRole("button", { name: "Format as currency" }).click();
      }

      if (format.numberFormat === "percent") {
        await page.getByRole("button", { name: "Format as percent" }).click();
      }

      if (format.numberFormat === "date") {
        await page.getByRole("button", { name: "Format as date" }).click();
      }

      return;
    }

    case "sort-filter": {
      const grid = challenge.initialGrid;
      const used = normalizeRange(grid.usedRange);

      if (part.requiredSort !== undefined) {
        const { col, direction } = part.requiredSort;

        await cell(page, used.start.row + grid.headerRows, col).click();
        await page
          .getByRole("button", { name: direction === "desc" ? "Sort high to low" : "Sort low to high" })
          .click();
      }

      if (part.requiredVisible !== undefined) {
        const { col, op, value } = part.requiredVisible;

        // The toolbar filters relative to the selected cell, so land on a cell holding the value.
        for (let row = used.start.row + grid.headerRows; row <= used.end.row; row += 1) {
          const cellValue = grid.cells[cellKey({ row, col })]?.value;
          const matches =
            (cellValue?.kind === "text" && cellValue.value === value) ||
            (cellValue?.kind === "number" && cellValue.value === value);

          if (matches) {
            await cell(page, row, col).click();
            break;
          }
        }

        await page
          .getByRole("button", {
            name: op === "greater-than" ? "Filter above the selected value" : "Filter to the selected value",
          })
          .click();
      }

      return;
    }
  }
}

export async function solveChallenge(page: Page, challenge: Challenge) {
  const spec = challenge.validation;
  const parts = spec.kind === "composite" ? spec.parts : [spec];

  for (const part of parts) {
    await solvePart(page, challenge, part);
  }
}

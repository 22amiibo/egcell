import { expect, test, type Page } from "@playwright/test";

import { buildSessionQueue } from "../src/data/challenges/queue";
import { solveChallenge } from "./helpers/solveVariant";

/**
 * The page reads `sessionSeed` from the URL, so these specs race the exact queue they compute
 * here. Determinism is the guarantee under test: if the page dealt different tasks, every solver
 * click below would miss.
 */
const SEED = "e2e-sprint";

const gotoSeeded = (page: Page) => page.goto(`/?sessionSeed=${SEED}`);

test.describe("sprint mode", () => {
  test("a five-task sprint runs to a session result and banks a record", async ({ page }) => {
    const queue = buildSessionQueue("sprint-5", SEED);

    await gotoSeeded(page);
    await page.getByRole("button", { name: "Sprint 5", exact: true }).click();

    await expect(page.getByText(/task 1 of 5/)).toBeVisible();

    for (const task of queue.tasks) {
      await solveChallenge(page, task.variant);
    }

    const card = page.getByTestId("session-result-card");

    await expect(card).toBeVisible();
    await expect(page.getByTestId("session-tasks")).toContainText("5 of 5");
    await expect(page.getByTestId("session-pr-line")).toContainText(
      "First personal record for this mode.",
    );

    // The breakdown lists every task by its position in the queue.
    await card.getByText("Task breakdown").click();
    await expect(card.getByText(`1. ${queue.tasks[0].variant.title}`)).toBeVisible();
    await expect(card.getByText(`5. ${queue.tasks[4].variant.title}`)).toBeVisible();
  });

  test("a ten-task sprint deals ten generated tasks and completes", async ({ page }) => {
    test.setTimeout(60_000);

    const queue = buildSessionQueue("sprint-10", SEED);

    await gotoSeeded(page);
    await page.getByRole("button", { name: "Sprint 10", exact: true }).click();

    await expect(page.getByText(/task 1 of 10/)).toBeVisible();

    for (const task of queue.tasks) {
      await solveChallenge(page, task.variant);
    }

    await expect(page.getByTestId("session-result-card")).toBeVisible();
    await expect(page.getByTestId("session-tasks")).toContainText("10 of 10");
  });

  test("skipping leaves partial credit and a completion below full", async ({ page }) => {
    const queue = buildSessionQueue("sprint-5", SEED);

    await gotoSeeded(page);
    await page.getByRole("button", { name: "Sprint 5", exact: true }).click();

    await page.getByRole("button", { name: "Skip task", exact: true }).click();

    for (const task of queue.tasks.slice(1)) {
      await solveChallenge(page, task.variant);
    }

    await expect(page.getByTestId("session-result-card")).toBeVisible();
    await expect(page.getByTestId("session-tasks")).toContainText("4 of 5");
  });

  test("a sprint record survives a reload, separately per sprint length", async ({ page }) => {
    const queue = buildSessionQueue("sprint-5", SEED);

    await gotoSeeded(page);
    await page.getByRole("button", { name: "Sprint 5", exact: true }).click();

    for (const task of queue.tasks) {
      await solveChallenge(page, task.variant);
    }

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

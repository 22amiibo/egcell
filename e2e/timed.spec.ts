import { expect, test } from "@playwright/test";

import { buildSessionQueue } from "../src/data/challenges/queue";
import { solveChallenge } from "./helpers/solveVariant";

/**
 * One real 30-second run, wall clock and all. Everything faster about timed mode is covered by
 * component tests with fake timers; this proves the deadline fires in a real browser, against a
 * seeded generated queue the test computes in advance.
 */
test("a 30-second run ends itself, shows the result, and banks a reload-proof record", async ({
  page,
}) => {
  test.setTimeout(90_000);

  const SEED = "e2e-timed";
  const queue = buildSessionQueue("timed-30", SEED);

  await page.goto(`/?sessionSeed=${SEED}`);
  await page.getByRole("button", { name: "30s", exact: true }).click();

  // Two quick completions while the clock runs.
  await solveChallenge(page, queue.tasks[0].variant);
  await solveChallenge(page, queue.tasks[1].variant);

  // Then let the clock die.
  await expect(page.getByTestId("session-result-card")).toBeVisible({ timeout: 35_000 });
  await expect(page.getByText("Time's up")).toBeVisible();
  await expect(page.getByTestId("session-final-time")).toContainText("tasks");
  await expect(page.getByTestId("session-tasks")).toContainText("2 of");

  // The record survives a reload, and the 60-second book stays empty.
  await page.reload();
  await page.getByRole("button", { name: "30s", exact: true }).click();
  await expect(page.getByTestId("best-time")).toContainText("pts");

  await page.getByRole("button", { name: "60s", exact: true }).click();
  await expect(page.getByTestId("best-time")).toContainText("no record yet");
});

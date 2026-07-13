import { defineConfig, devices } from "@playwright/test";

// Must be localhost, not 127.0.0.1. Next's dev server serves from localhost and treats a request
// from 127.0.0.1 as cross-origin, blocking its own client chunks. The page would still render, but
// it would never hydrate: a frozen clock and dead buttons.
const baseURL = "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

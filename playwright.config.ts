import { defineConfig, devices } from "@playwright/test";

// GitHub Actions, not plain CI: agent shells export CI=true, which used to make
// every local run rebuild the site with 6 workers and retries.
const CI = process.env.GITHUB_ACTIONS === "true";
// Locally, PW_PORT points the suite at a dev server of your own (and keeps it
// off another checkout's server on :3000).
const PORT = Number(process.env.PW_PORT ?? 3000);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  // Locally: two workers (a slow machine with no GPU), and a hung run dies in
  // 2 minutes rather than at the 10-minute tool timeout.
  workers: CI ? undefined : 2,
  globalTimeout: CI ? 0 : 120_000,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // CI tests the production build; locally the dev server is reused (start it
  // once with `pnpm dev`), so a targeted spec does not rebuild the site.
  webServer: {
    command: CI ? "pnpm build && pnpm start" : `pnpm dev --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !CI,
    env: { STATS_SOURCE: "snapshot" },
    timeout: CI ? 180_000 : 60_000,
  },
});

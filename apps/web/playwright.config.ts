import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "bun run dev",
    url: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 180000,
    cwd: ".",
    env: {
      ...process.env,
      ENABLE_TEST_UTILS: "true",
      APP_URL: process.env.APP_URL ?? "http://127.0.0.1:3000",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

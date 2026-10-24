import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

// Test workers import the app's db/env modules directly, so they need the
// same variables Vite injects for the dev server. The file list mirrors Vite's
// dev-mode precedence: the first file that defines a variable wins. Loading
// only ".env" would sign test sessions with a different AUTH_SECRET than the
// dev server verifies with, and every session would be rejected.
loadEnv({
  path: [
    ".env.development.local",
    ".env.local",
    ".env.development",
    ".env",
  ],
  quiet: true,
});

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: "bun run dev",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 180000,
    cwd: ".",
    env: {
      ...process.env,
      ENABLE_TEST_UTILS: "true",
      APP_URL: baseURL,
      PUBLIC_APP_URL: baseURL,
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

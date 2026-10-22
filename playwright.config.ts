import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://bettraining:bettraining@localhost:5433/bettraining_test";
process.env.TEST_DATABASE_URL = TEST_DATABASE_URL;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./tests/setup/e2e-global.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: `http://localhost:${PORT}/connexion`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      BETTER_AUTH_SECRET: "e2e-test-secret-e2e-test-secret-e2e-test-secret",
      BETTER_AUTH_URL: `http://localhost:${PORT}`,
      // The whole assessment protocol shrinks to about two minutes.
      ASSESSMENT_TIME_SCALE: "0.02",
    },
  },
});

import { defineConfig } from "vitest/config";

// Shared with the integration global setup through the environment.
const TEST_DATABASE_URL = (process.env.TEST_DATABASE_URL ??=
  "postgres://bettraining:bettraining@localhost:5433/bettraining_test");

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.int.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["src/**/*.int.test.ts"],
          environment: "node",
          globalSetup: ["tests/setup/integration-global.ts"],
          env: {
            DATABASE_URL: TEST_DATABASE_URL,
            BETTER_AUTH_SECRET: "integration-test-secret-integration-test-secret",
            BETTER_AUTH_URL: "http://localhost:3000",
          },
          // Tests share one database, so files run one at a time.
          fileParallelism: false,
        },
      },
    ],
  },
});

import { defineConfig, devices } from "@playwright/test";

// The admin application on an EMPTY database (scripts/admin-local.mjs --seed none): what the
// review project shows right after `npm run review:clean`. Its own server and throwaway
// database, Supabase Auth replaced by the LOCAL TEST STAND-IN, no AI service. Sign-in is the real path.
//   npm run test:dashboard   (via scripts/run-dashboard-tests.mjs)

export const EMPTY_PORT = 3207;
export const EMPTY_PASSWORD = "local-demo-password-for-tests-only";

export default defineConfig({
  testDir: "./tests/dashboard",
  testMatch: ["**/empty-review.spec.ts"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 120_000,
  webServer: {
    command: `node scripts/admin-local.mjs --port ${EMPTY_PORT} --seed none`,
    url: `http://localhost:${EMPTY_PORT}/login`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { DASHBOARD_DEMO_PASSWORD: EMPTY_PASSWORD, PREPARATION_GENERATOR: "off" },
  },
  use: {
    baseURL: `http://localhost:${EMPTY_PORT}`,
    ...devices["Desktop Chrome"],
    launchOptions: { args: ["--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost"] },
  },
});

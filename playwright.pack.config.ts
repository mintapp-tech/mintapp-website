import { defineConfig, devices } from "@playwright/test";

// The Direction Pack on the curated review dataset (supabase/review/seed_curated.sql):
// its own server and throwaway database (scripts/admin-local.mjs --seed review), Supabase
// Auth replaced by the LOCAL TEST STAND-IN, and no AI service. Sign-in is the real path.
//   npm run test:dashboard   (via scripts/run-dashboard-tests.mjs)

export const PACK_PORT = 3206;
export const PACK_PASSWORD = "local-demo-password-for-tests-only";

export default defineConfig({
  testDir: "./tests/dashboard",
  testMatch: ["**/direction-pack.spec.ts"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 120_000,
  webServer: {
    command: `node scripts/admin-local.mjs --port ${PACK_PORT} --seed review`,
    url: `http://localhost:${PACK_PORT}/login`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { DASHBOARD_DEMO_PASSWORD: PACK_PASSWORD, PREPARATION_GENERATOR: "off" },
  },
  use: {
    baseURL: `http://localhost:${PACK_PORT}`,
    ...devices["Desktop Chrome"],
    launchOptions: { args: ["--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost"] },
  },
});

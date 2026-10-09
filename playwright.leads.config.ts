import { defineConfig, devices } from "@playwright/test";

// The two-founder workflow end to end (Leads & Clients, the Pre-meeting Pack,
// booking automation, the command centre, Growth, settings) on synthetic data:
// its own server and throwaway database (scripts/admin-local.mjs), Supabase Auth
// replaced by the LOCAL TEST STAND-IN, and the mock generator (never a real AI
// service). Sign-in is the real deployed path.
//   npm run test:dashboard   (via scripts/run-dashboard-tests.mjs)

export const DEMO_PORT = 3205;
export const DEMO_PASSWORD = "local-demo-password-for-tests-only";

export default defineConfig({
  testDir: "./tests/dashboard",
  testMatch: ["**/leads.spec.ts"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 90_000,
  webServer: {
    command: `node scripts/admin-local.mjs --port ${DEMO_PORT}`,
    url: `http://localhost:${DEMO_PORT}/login`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { DASHBOARD_DEMO_PASSWORD: DEMO_PASSWORD, PREPARATION_GENERATOR: "mock" },
  },
  use: {
    baseURL: `http://localhost:${DEMO_PORT}`,
    ...devices["Desktop Chrome"],
    launchOptions: { args: ["--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost"] },
  },
});

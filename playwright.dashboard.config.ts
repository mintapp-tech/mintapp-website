import { defineConfig, devices } from "@playwright/test";

// The private admin application end to end on synthetic data: a throwaway
// PostgreSQL with every migration and the synthetic fixture, and Supabase Auth
// replaced by a LOCAL TEST STAND-IN (scripts/admin-local.mjs). Sign-in is the
// real deployed path: password, then an authenticator-app code.
//
//   npm run test:dashboard   (via scripts/run-dashboard-tests.mjs: this suite, then
//   playwright.admin-auth.config.ts, removing the throwaway databases afterwards)

export const DEMO_PORT = 3201;
export const DEMO_PASSWORD = "local-demo-password-for-tests-only";

export default defineConfig({
  testDir: "./tests/dashboard",
  testMatch: ["**/dashboard.spec.ts", "**/crm.spec.ts"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  webServer: {
    command: `node scripts/admin-local.mjs --port ${DEMO_PORT}`,
    url: `http://localhost:${DEMO_PORT}/login`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { DASHBOARD_DEMO_PASSWORD: DEMO_PASSWORD },
  },
  use: {
    baseURL: `http://localhost:${DEMO_PORT}`,
    ...devices["Desktop Chrome"],
    launchOptions: { args: ["--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost"] },
  },
});

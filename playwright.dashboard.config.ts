import { defineConfig, devices } from "@playwright/test";

// The private admin application with the local demo's custom login, run
// against the local demo (synthetic data on a throwaway PostgreSQL started by
// scripts/dashboard-demo.mjs). The deployed sign-in path (Supabase Auth) is
// covered by playwright.admin-auth.config.ts. Separate from the public-site
// suite because it needs that database; run one suite at a time.
//
//   npm run test:dashboard   (via scripts/run-dashboard-tests.mjs, which runs
//   both admin suites and removes the throwaway databases afterwards)

export const DEMO_PORT = 3201;
export const DEMO_PASSWORD = "local-demo-password-for-tests-only";

export default defineConfig({
  testDir: "./tests/dashboard",
  testMatch: "**/dashboard.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  webServer: {
    command: `node scripts/dashboard-demo.mjs --port ${DEMO_PORT}`,
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

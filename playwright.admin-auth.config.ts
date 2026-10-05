import { defineConfig, devices } from "@playwright/test";

// The admin application's deployed sign-in path (Supabase Auth with a
// required authenticator app and the ADMIN_TEAM allowlist), end to end on
// synthetic data. Supabase Auth is replaced by a LOCAL TEST STAND-IN
// (tests/admin/fake-supabase-auth.mjs); no remote project is involved.
//
//   npm run test:dashboard   (runs this after playwright.dashboard.config.ts)

export const AUTH_DEMO_PORT = 3202;
export const AUTH_DEMO_PASSWORD = "local-demo-password-for-tests-only";

export default defineConfig({
  testDir: "./tests/dashboard",
  testMatch: /admin-auth\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  webServer: {
    command: `node scripts/dashboard-demo.mjs --port ${AUTH_DEMO_PORT} --auth supabase`,
    url: `http://localhost:${AUTH_DEMO_PORT}/login`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { DASHBOARD_DEMO_PASSWORD: AUTH_DEMO_PASSWORD },
  },
  use: {
    baseURL: `http://localhost:${AUTH_DEMO_PORT}`,
    ...devices["Desktop Chrome"],
    launchOptions: { args: ["--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost"] },
  },
});

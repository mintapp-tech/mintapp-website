import { defineConfig, devices } from "@playwright/test";

// The admin application's sign-in (Supabase Auth with a required authenticator
// app and the ADMIN_TEAM allowlist), end to end on synthetic data, with Supabase
// Auth replaced by a LOCAL TEST STAND-IN (tests/admin/fake-supabase-auth.mjs).
// No remote project is involved. Behaviour of the real service is confirmed
// separately against a synthetic review project before launch (docs/crm-release-1-launch.md).
//
//   npm run test:dashboard   (runs this after playwright.dashboard.config.ts)

export const AUTH_DEMO_PORT = 3202;
export const AUTH_DEMO_PASSWORD = "local-demo-password-for-tests-only";
export const ACCOUNTS = { omar: "omar.demo@mintapp.local", adam: "adam.demo@mintapp.local", outsider: "outsider.demo@mintapp.local" };

export default defineConfig({
  testDir: "./tests/dashboard",
  testMatch: /admin-auth\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  webServer: {
    command: `node scripts/admin-local.mjs --port ${AUTH_DEMO_PORT}`,
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

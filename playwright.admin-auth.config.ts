import { defineConfig, devices } from "@playwright/test";

// The admin application's deployed sign-in path (Supabase Auth with a
// required authenticator app and the ADMIN_TEAM allowlist), end to end on
// synthetic data. By default Supabase Auth is replaced by a LOCAL TEST
// STAND-IN (tests/admin/fake-supabase-auth.mjs); no remote project is involved.
//
//   npm run test:dashboard   (runs this after playwright.dashboard.config.ts)
//
// With ADMIN_AUTH_LIVE=1 the same tests run against REAL Supabase Auth in the
// isolated synthetic review project (REVIEW_SUPABASE_*, never the live one):
//   npm run test:admin-auth-live

export const AUTH_DEMO_PORT = 3202;
export const LIVE = process.env.ADMIN_AUTH_LIVE === "1";
// Live runs use a random password per run (set by scripts/run-admin-auth-live.mjs);
// the synthetic test accounts are recreated each time.
export const AUTH_DEMO_PASSWORD = LIVE ? (process.env.DASHBOARD_DEMO_PASSWORD ?? "") : "local-demo-password-for-tests-only";
export const ACCOUNTS = LIVE
  ? { omar: "omar.review@example.com", adam: "adam.review@example.com", outsider: "outsider.review@example.com" }
  : { omar: "omar.demo@mintapp.local", adam: "adam.demo@mintapp.local", outsider: "outsider.demo@mintapp.local" };

export default defineConfig({
  testDir: "./tests/dashboard",
  testMatch: /admin-auth\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  webServer: {
    command: `node scripts/dashboard-demo.mjs --port ${AUTH_DEMO_PORT} --auth ${LIVE ? "supabase-live" : "supabase"}`,
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

import { defineConfig, devices } from "@playwright/test";

// The admin application against REAL Supabase Auth and the REAL database of the isolated
// synthetic review project (never the live project): the same code the admin Preview runs,
// served locally with VERCEL_ENV=preview so the review guard is active.
//   npm run test:review-live            (scripts/run-review-live-tests.mjs)
// REVIEW_SUITE=auth runs the sign-in suite, REVIEW_SUITE=crm the CRM suite; each run starts
// its own server and recreates the three synthetic *.review@example.com test accounts.

export const REVIEW_PORT = 3204;
const suite = process.env.REVIEW_SUITE === "auth" ? "auth" : "crm";

export default defineConfig({
  testDir: ".",
  testMatch: process.env.REVIEW_SPEC ? process.env.REVIEW_SPEC : suite === "auth" ? "tests/dashboard/admin-auth.spec.ts" : "tests/review/crm-live.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 90_000,
  webServer: {
    command: `node --env-file=.env.review.local scripts/admin-local.mjs --port ${REVIEW_PORT} --live`,
    url: `http://localhost:${REVIEW_PORT}/login`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: { DASHBOARD_DEMO_PASSWORD: process.env.DASHBOARD_DEMO_PASSWORD ?? "" },
  },
  use: {
    baseURL: `http://localhost:${REVIEW_PORT}`,
    ...devices["Desktop Chrome"],
    launchOptions: { args: ["--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE *.supabase.co"] },
    permissions: ["clipboard-read", "clipboard-write"],
  },
});

import { defineConfig, devices } from "@playwright/test";

// Every test in this suite intercepts /api/inquiries and the Cloudflare
// Turnstile script/siteverify network paths — no test here may reach a real
// Supabase, Resend, or Cloudflare endpoint. See tests/e2e/README.md.
export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/en",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  use: {
    baseURL: "http://localhost:3000",
    ...devices["Desktop Chrome"],
    // Enforced, not just conventional: no hostname except localhost resolves
    // in the test browser, so a test that forgets a mock fails closed instead
    // of loading real Turnstile or Cal.com. Mocked routes still work because
    // Playwright intercepts them before any lookup.
    launchOptions: { args: ["--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost"] },
  },
});

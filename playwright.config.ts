import { defineConfig, devices } from "@playwright/test";
import { FAKE_SUPABASE_PORT } from "./tests/e2e/fake-supabase.mjs";

// Not a real secret: the signing key of the references the recovery tests mint.
export const E2E_BOOKING_CONTEXT_SECRET = "e2e-booking-context-secret-not-real";

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
  webServer: [
    // A stand-in for Supabase's REST API with a few synthetic inquiries, used by
    // the booking recovery tests (tests/e2e/fake-supabase.mjs).
    {
      command: "node tests/e2e/fake-supabase-server.mjs",
      url: `http://127.0.0.1:${FAKE_SUPABASE_PORT}/__health`,
      reuseExistingServer: !process.env.CI,
      timeout: 15_000,
    },
    {
      command: "npm run dev",
      url: "http://localhost:3000/en",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      // These override .env.local for the test server, so no test can reach the
      // real database, send email, or sign a reference with a real secret.
      env: {
        SUPABASE_URL: `http://127.0.0.1:${FAKE_SUPABASE_PORT}`,
        SUPABASE_SECRET_KEY: "e2e-not-a-real-key",
        CAL_BOOKING_CONTEXT_SECRET: E2E_BOOKING_CONTEXT_SECRET,
        NEXT_PUBLIC_CAL_LINK: "mintapp/mintapp-discovery-call",
        EMAIL_SENDING_MODE: "disabled",
        RESEND_API_KEY: "",
      },
    },
  ],
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

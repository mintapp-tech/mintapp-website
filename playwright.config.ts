import { defineConfig, devices } from "@playwright/test";

// Every test in this suite intercepts /api/inquiries and the Cloudflare
// Turnstile script/siteverify network paths — no test here may reach a real
// Supabase, Resend, or Cloudflare endpoint. See tests/e2e/README.md.
export default defineConfig({
  testDir: "./tests/e2e",
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
  },
});

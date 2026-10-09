import { expect, type Browser, type Page } from "@playwright/test";
import { totp } from "../admin/totp.mjs";

// Sign-in as the deployed application does it: password, then an
// authenticator-app code (the first time, enrolling the authenticator). The
// auth service is the local test stand-in (scripts/admin-local.mjs).

const secrets = new Map<string, string>();
// Live runs (REAL Supabase Auth in the synthetic review project) get a random password per run.
export const PASSWORD = process.env.ADMIN_AUTH_LIVE === "1" ? (process.env.DASHBOARD_DEMO_PASSWORD ?? "") : "local-demo-password-for-tests-only";

export async function signInAs(browser: Browser, email: string, origin: string): Promise<Page> {
  const context = await browser.newContext();
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/login/mfa");
  if (!secrets.has(email)) {
    await page.getByRole("button", { name: "Set up authenticator" }).click();
    secrets.set(email, (await page.locator("code").textContent())!.trim());
  }
  await page.getByLabel("6-digit code").fill(totp(secrets.get(email)!));
  await page.getByRole("button", { name: "Verify" }).click();
  // Signing in lands on the dashboard; most flows start from the inquiries list.
  await page.waitForURL("**/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/inquiries");
  return page;
}

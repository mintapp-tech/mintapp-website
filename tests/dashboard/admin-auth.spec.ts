import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { ACCOUNTS, AUTH_DEMO_PASSWORD } from "../../playwright.admin-auth.config";
import { totp } from "../admin/totp.mjs";

// Supabase Auth sign-in for the admin application, against the local test
// stand-in, with synthetic accounts and data only.

const OMAR = ACCOUNTS.omar;
const ADAM = ACCOUNTS.adam;
const OUTSIDER = ACCOUNTS.outsider; // has a password, not on the allowlist
const CLINIC = "11111111-0000-4000-8000-000000000001";
const secrets = new Map<string, string>();

test.describe.configure({ mode: "serial" });

async function passwordStep(browser: Browser, email: string, password = AUTH_DEMO_PASSWORD): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  return page;
}

async function enterCode(page: Page, secret: string) {
  await page.getByLabel("6-digit code").fill(totp(secret));
  await page.getByRole("button", { name: "Verify" }).click();
  await page.waitForURL("**/dashboard");
}

// Full sign-in, enrolling an authenticator the first time.
async function signIn(browser: Browser, email: string): Promise<Page> {
  const page = await passwordStep(browser, email);
  await page.waitForURL("**/login/mfa");
  if (!secrets.has(email)) {
    await page.getByRole("button", { name: "Set up authenticator" }).click();
    secrets.set(email, (await page.locator("code").textContent())!.trim());
  }
  await enterCode(page, secrets.get(email)!);
  return page;
}

const authCookies = async (context: BrowserContext) => (await context.cookies()).filter((c) => c.name.startsWith("__Host-mintapp-admin"));

async function replay(browser: Browser, cookies: Awaited<ReturnType<typeof authCookies>>, path = "/inquiries") {
  const context = await browser.newContext();
  await context.addCookies(cookies);
  const page = await context.newPage();
  await page.goto(path);
  const url = new URL(page.url()).pathname + new URL(page.url()).search;
  await context.close();
  return url;
}

test("nothing private is served without signing in, and only on the admin host", async ({ page, request }) => {
  for (const path of ["/inquiries", `/inquiries/${CLINIC}`]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    const raw = await request.get(path, { maxRedirects: 0 });
    expect([302, 303, 307, 308]).toContain(raw.status());
    expect(await raw.text()).not.toContain("physiotherapy");
  }
  // Public pages and APIs are not part of the admin application.
  for (const path of ["/en", "/api/inquiries"]) expect((await request.get(path, { maxRedirects: 0 })).status()).toBe(404);
  // Another hostname pointed at the admin deployment gets nothing.
  expect((await request.get("/login", { headers: { Host: "www.example.com" } })).status()).toBe(404);
  // The admin application is never indexed.
  const headers = (await request.get("/login")).headers();
  expect(headers["x-robots-tag"]).toBe("noindex, nofollow");
  // Only this origin may supply scripts, connections, frames or form targets.
  for (const directive of ["default-src 'self'", "object-src 'none'", "form-action 'self'", "frame-ancestors 'none'", "base-uri 'self'"]) expect(headers["content-security-policy"]).toContain(directive);
  expect(headers["content-security-policy"]).not.toMatch(/https?:/);
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["permissions-policy"]).toContain("camera=()");
  // Never publicly cached (the exact production value is checked against a production build), and never shown inside another site's frame.
  expect(headers["cache-control"]).toMatch(/no-store|no-cache/);
  expect(headers["cache-control"]).not.toMatch(/public|s-maxage|max-age=[1-9]/);
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
});

test("forged session cookies open nothing, on any private page", async ({ browser }) => {
  const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  // A well-formed but unsigned token for an allowlisted address, claiming a completed second factor.
  const unsignedToken = `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: "11111111-1111-4111-8111-111111111111", email: OMAR, role: "authenticated", aal: "aal2", session_id: "22222222-2222-4222-8222-222222222222", iat: now, exp: now + 3600 })}.`;
  const session = { access_token: unsignedToken, refresh_token: "forged", token_type: "bearer", expires_in: 3600, expires_at: now + 3600, user: { id: "11111111-1111-4111-8111-111111111111", email: OMAR } };
  const base = { domain: "localhost", path: "/", secure: true, httpOnly: true, sameSite: "Strict" as const };
  const variants: { name: string; value: string }[][] = [
    [{ name: "__Host-mintapp-admin-auth", value: "garbage" }],
    [{ name: "__Host-mintapp-admin-auth", value: `base64-${b64(session)}` }],
    [{ name: "__Host-mintapp-admin-auth", value: `base64-${b64(session)}` }, { name: "__Host-mintapp-admin-activity", value: `${b64({ sid: "22222222-2222-4222-8222-222222222222", iat: now, last: now })}.AAAA` }],
    [{ name: "__Host-mintapp-admin-activity", value: `${b64({ sid: "x", iat: now, last: now })}.AAAA` }],
  ];
  for (const cookies of variants) {
    for (const path of ["/inquiries", `/inquiries/${CLINIC}`]) {
      const context = await browser.newContext();
      await context.addCookies(cookies.map((c) => ({ ...base, ...c })));
      const page = await context.newPage();
      await page.goto(path);
      await expect(page, `${cookies.map((c) => c.name).join("+")} ${path}`).toHaveURL(/\/login(\?.*)?$/);
      await expect(page.locator("body")).not.toContainText("physiotherapy");
      await context.close();
    }
  }
});

test("a wrong password, or the right password for an account outside the allowlist, gets the same refusal", async ({ browser }) => {
  for (const [email, password] of [
    [OMAR, "not-the-password-at-all"],
    [OUTSIDER, AUTH_DEMO_PASSWORD],
  ]) {
    const page = await passwordStep(browser, email, password);
    await expect(page.locator('p[role="alert"]')).toHaveText("That email and password do not match a Mintapp team account.");
    await page.goto("/inquiries");
    await expect(page).toHaveURL(/\/login$/);
    // The outsider's session was ended on the auth server, not just hidden.
    expect(await authCookies(page.context())).toEqual([]);
  }
});

test("first sign-in requires setting up an authenticator; the password alone opens nothing", async ({ browser }) => {
  const page = await passwordStep(browser, OMAR);
  await page.waitForURL("**/login/mfa");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Set up your authenticator");
  // With only the password, every private page sends you back to the code step.
  for (const path of ["/inquiries", `/inquiries/${CLINIC}`]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login\/mfa$/);
  }
  await page.getByRole("button", { name: "Set up authenticator" }).click();
  await expect(page.getByRole("img", { name: "QR code for your authenticator app" })).toBeVisible();
  const secret = (await page.locator("code").textContent())!.trim();
  expect(secret).toMatch(/^[A-Z2-7]{32}$/);

  await page.getByLabel("6-digit code").fill("000000");
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.locator('p[role="alert"]')).toContainText("That code did not work");
  await enterCode(page, secret);
  secrets.set(OMAR, secret);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dashboard");
  await page.goto("/inquiries");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Inquiries");
  // The synthetic review project may hold more inquiries than the four fixtures.
  expect(await page.locator("tbody tr").count()).toBeGreaterThanOrEqual(4);

  // Session cookies: host-only, HttpOnly, Secure, SameSite=Strict, at most 12 hours.
  const cookies = await authCookies(page.context());
  expect(cookies.map((c) => c.name).sort()).toEqual(expect.arrayContaining(["__Host-mintapp-admin-activity"]));
  expect(cookies.some((c) => c.name.startsWith("__Host-mintapp-admin-auth"))).toBe(true);
  for (const c of cookies) {
    expect(c, c.name).toMatchObject({ path: "/", secure: true, httpOnly: true, sameSite: "Strict", domain: "localhost" });
    expect(c.expires - Date.now() / 1000, c.name).toBeLessThanOrEqual(12 * 3600 + 5);
  }
});

test("every later sign-in asks for the current code", async ({ browser }) => {
  const page = await passwordStep(browser, OMAR);
  await page.waitForURL("**/login/mfa");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Enter your authentication code");
  await page.goto("/inquiries");
  await expect(page).toHaveURL(/\/login\/mfa$/);
  await page.getByLabel("6-digit code").fill("123456");
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.locator('p[role="alert"]')).toContainText("That code did not work");
  await enterCode(page, secrets.get(OMAR)!);
  await page.goto(`/inquiries/${CLINIC}`);
  await expect(page.locator('[data-brief="description"]')).toContainText("physiotherapy");
});

test("sign-out ends the session on the auth server: a copied cookie stops working", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  const copied = await authCookies(page.context());
  expect(await replay(browser, copied)).toBe("/inquiries");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await authCookies(page.context())).toEqual([]);
  expect(await replay(browser, copied)).toMatch(/^\/login/);
});

test("an idle or expired activity record ends the session, with a notice", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  const copied = await authCookies(page.context());
  // Without its activity record (as after 2 idle hours), the next request revokes the session.
  await page.context().clearCookies({ name: "__Host-mintapp-admin-activity" });
  await page.goto("/inquiries");
  await expect(page).toHaveURL(/\/login\?expired=1$/);
  await expect(page.getByRole("status")).toHaveText("Your session ended. Sign in again.");
  expect(await replay(browser, copied)).toMatch(/^\/login/);
});

test("sign out everywhere ends that person's other sessions only", async ({ browser }) => {
  const laptop = await signIn(browser, ADAM);
  const phone = await signIn(browser, ADAM);
  const omar = await signIn(browser, OMAR);
  await phone.getByRole("button", { name: "Sign out everywhere" }).click();
  await expect(phone).toHaveURL(/\/login$/);
  await laptop.goto("/inquiries");
  await expect(laptop).toHaveURL(/\/login/);
  await omar.goto("/inquiries");
  await expect(omar).toHaveURL(/\/inquiries$/);
});

test("the interface works in Arabic, right to left", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.goto("/inquiries");
  await page.getByRole("button", { name: "Switch the interface to Arabic" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("الطلبات");
  await expect(page.locator("tbody")).toContainText("منصة حرفيين تجريبية");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
  await page.goto(`/inquiries/${CLINIC}`);
  await expect(page.getByRole("heading", { name: "الملخص" })).toBeVisible();
  // Switch back for the rest of the team's tests.
  await page.getByRole("button", { name: "التبديل إلى الواجهة الإنجليزية" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("repeated wrong passwords lock the account for a while, even for the right password", async ({ browser }) => {
  // The outsider is used because locking an allowlisted account would lock out the other tests.
  const page0 = await passwordStep(browser, OUTSIDER, "not-the-password");
  // Each attempt is awaited: the button is disabled while one is in flight, so a click made too early is ignored.
  const attempt = async () => {
    await Promise.all([page0.waitForResponse((r) => r.request().method() === "POST"), page0.getByRole("button", { name: "Sign in" }).click()]);
  };
  await expect(page0.locator('p[role="alert"]')).toBeVisible();
  // The earlier tests in this file already used a few of the allowed failures for this account.
  for (let i = 0; i < 9; i++) {
    if ((await page0.locator('p[role="alert"]').textContent())?.startsWith("Too many")) break;
    // The form is cleared after each answer.
    await page0.getByLabel("Email").fill(OUTSIDER);
    await page0.getByLabel("Password").fill("still-not-the-password");
    await attempt();
  }
  await expect(page0.locator('p[role="alert"]')).toHaveText("Too many attempts. Try again in 15 minutes.");
  let page = page0;
  // The right password is refused while the lock holds, and no session starts.
  page = await passwordStep(browser, OUTSIDER);
  await expect(page.locator('p[role="alert"]')).toHaveText("Too many attempts. Try again in 15 minutes.");
  await expect(page).toHaveURL(/\/login$/);
  expect(await authCookies(page.context())).toEqual([]);
  // Another account is not affected.
  const other = await passwordStep(browser, OMAR);
  await other.waitForURL("**/login/mfa");
});

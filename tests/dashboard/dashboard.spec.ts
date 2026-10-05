import { test, expect, type Browser, type BrowserContext, type Page, type Response } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { DEMO_PASSWORD } from "../../playwright.dashboard.config";

// Local demo data (scripts/dashboard-demo.mjs): synthetic inquiries only.
const CLINIC = "11111111-0000-4000-8000-000000000001";
const RESTAURANT = "11111111-0000-4000-8000-000000000003";
const CRAFTS = "11111111-0000-4000-8000-000000000004";
const OMAR = "omar.demo@mintapp.local";
const ADAM = "adam.demo@mintapp.local";

test.describe.configure({ mode: "serial" });

async function signIn(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext();
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://localhost:3201" });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/inquiries");
  return page;
}

// The paste panel starts open when there is no draft yet; open it only if closed.
async function openPastePanel(page: Page) {
  const panel = page.locator("details", { has: page.locator("#paste-draft") });
  if (!(await panel.evaluate((d) => (d as HTMLDetailsElement).open))) await panel.locator("summary").click();
}

const status = (page: Page) => page.getByRole("status").filter({ has: page.locator("p") }).first();

test("inquiry data is never served without a valid team session", async ({ page, request }) => {
  for (const path of ["/inquiries", `/inquiries/${CLINIC}`]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator("body")).not.toContainText("physiotherapy");
    const raw = await request.get(path, { maxRedirects: 0 });
    expect([302, 303, 307, 308]).toContain(raw.status());
    expect(await raw.text()).not.toContain("physiotherapy");
  }
  // A forged or tampered session is rejected by the page itself, not just the proxy.
  await page.context().addCookies([{ name: "__Host-mintapp_team", value: "eyJ2IjoxLCJlIjoib21hci5kZW1vQG1pbnRhcHAubG9jYWwifQ.forged", domain: "localhost", path: "/", secure: true, httpOnly: true, sameSite: "Strict" }]);
  await page.goto(`/inquiries/${CLINIC}`);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator("body")).not.toContainText("physiotherapy");
});

test("a wrong password is refused with a generic message", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(OMAR);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator('p[role="alert"]')).toHaveText("That email and password do not match a Mintapp team account.");
  await page.goto("/inquiries");
  await expect(page).toHaveURL(/\/login$/);
});

test("list: all synthetic inquiries, Arabic intact, and stalled preparation flagged", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await expect(page.locator("tbody tr")).toHaveCount(4);
  await expect(page.locator("tbody")).toContainText("منصة حرفيين تجريبية");
  await expect(page.locator("tbody")).toContainText("Booked");
  // Automation is off in the demo, so every waiting inquiry needs attention.
  await expect(page.locator('tbody tr[data-attention="true"]')).toHaveCount(4);
  await expect(page.getByText("Automated preparation: off")).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test("phones get cards instead of the table, with nothing wider than the screen", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.reload();
  await expect(page.locator("table")).toBeHidden();
  const cards = page.getByRole("list", { name: "Inquiries, newest first" }).getByRole("listitem");
  await expect(cards).toHaveCount(4);
  await expect(cards.first()).toContainText("Needs attention");
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(await overflow()).toBe(0);
  for (const id of [CLINIC, CRAFTS]) {
    await page.goto(`/inquiries/${id}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await overflow()).toBe(0);
  }
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test("an unknown inquiry shows a not-found page inside the dashboard", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  // The page streams behind a loading state, so the status is already sent
  // (200) when the inquiry turns out not to exist; it stays noindex.
  await page.goto("/inquiries/99999999-0000-4000-8000-000000000000");
  await expect(page.getByRole("heading", { name: "Inquiry not found" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
  await page.getByRole("link", { name: "Back to all inquiries" }).click();
  await expect(page).toHaveURL(/\/inquiries$/);
});

test("an inquiry with no booking is prepared, marked ready by one teammate and approved by the other", async ({ browser }) => {
  const omar = await signIn(browser, OMAR);
  await omar.goto(`/inquiries/${RESTAURANT}`);
  await expect(omar.locator('[data-status="meeting"]')).toHaveText("Not booked");
  await omar.getByRole("button", { name: "Run mock generator" }).click();
  await expect(omar.locator('[data-draft-version="1"]')).toContainText("Mock generator (placeholder, not real analysis)");
  await expect(omar.locator('[data-draft-version="1"]')).toContainText("[MOCK]");
  await omar.getByRole("button", { name: "Mark ready for review" }).click();
  await expect(omar.locator('[data-review="in_review"]')).toBeVisible();

  const adam = await signIn(browser, ADAM);
  await adam.goto(`/inquiries/${RESTAURANT}`);
  await adam.getByRole("button", { name: "Approve for the meeting" }).click();
  await expect(adam.locator('[data-review="approved"]')).toHaveText("Approved for the meeting");
  await expect(adam.getByText("Last review change by Adam")).toBeVisible();
});

test("manual path: copy a brief without contact details, paste the result, review", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.goto(`/inquiries/${CLINIC}`);
  await expect(page.locator('[data-brief="provided"]')).toContainText("Budget range (client-stated)Not sure yet");
  await expect(page.locator('[data-brief="provided"]')).toContainText("Project typeWeb app");
  await page.getByRole("button", { name: "Copy brief for Claude" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("three physiotherapy clinics");
  expect(copied).toContain("do not invent prices");
  expect(copied).not.toMatch(/clinic@example\.com|Synthetic Clinic Group/);

  await openPastePanel(page);
  await page.getByLabel(/Paste the result/).fill("## Summary\nThree clinics want online booking.\n\n## Suggested next step\nPropose a $4,000 first phase.");
  await page.getByRole("button", { name: "Save as new draft" }).click();
  const draft = page.locator('[data-draft-version="1"]');
  await expect(draft).toContainText("Pasted by the team");
  await expect(draft).toContainText("figures not stated by the client (4000)");
  await expect(page.locator('[data-status="preparation"]')).toHaveText("Manual");
});

test("booking, reschedule, generator failure, quota pause, manual recovery and cancellation keep everything", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.goto(`/inquiries/${CRAFTS}`);
  await expect(page.locator('[data-brief="description"]')).toContainText("الحرفيين");

  await page.getByRole("button", { name: "Simulate booking" }).click();
  await expect(page.locator('[data-status="meeting"]')).toContainText("Booked");
  await page.getByRole("button", { name: "Simulate reschedule" }).click();
  await expect(page.locator('[data-status="meeting"]')).toContainText("Booked");
  await page.getByLabel("New note").fill("ملاحظة: العميل يفضّل الموبايل");
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(page.locator("[data-notes]")).toContainText("ملاحظة: العميل يفضّل الموبايل");

  await page.getByRole("button", { name: "Simulate generator failure" }).click();
  await expect(status(page)).toContainText("Automated preparation failed");
  await expect(status(page)).toContainText("the reply was not valid JSON");
  await page.getByRole("button", { name: "Retry automated preparation" }).click();
  await expect(status(page)).toContainText("Waiting for manual preparation");

  await page.getByRole("button", { name: "Simulate quota exhausted" }).click();
  await expect(status(page)).toContainText("Automation is paused");
  await expect(status(page)).toContainText("free allowance is used up");
  await page.getByRole("button", { name: "Resume automation (mock)" }).click();
  await expect(page.getByRole("button", { name: /Resume automation/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Prepare manually instead" }).click();
  await expect(page.locator('[data-status="preparation"]')).toHaveText("Manual");
  await openPastePanel(page);
  await page.getByLabel(/Paste the result/).fill("## الملخص\nمنصة تربط الحرفيين بالعملاء.");
  await page.getByRole("button", { name: "Save as new draft" }).click();
  await page.getByRole("button", { name: "Mark ready for review" }).click();
  await page.getByRole("button", { name: "Approve for the meeting" }).click();
  await expect(page.locator('[data-review="approved"]')).toBeVisible();

  await page.getByRole("button", { name: "Simulate cancellation" }).click();
  await expect(page.locator('[data-status="meeting"]')).toContainText("Cancelled");
  await expect(page.locator('[data-review="approved"]')).toBeVisible();
  await expect(page.locator('[data-draft-version="1"]')).toContainText("الحرفيين");
  await expect(page.locator("[data-notes]")).toContainText("العميل يفضّل الموبايل");

  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

// Clicks a form button and waits until the refreshed page has finished streaming.
async function submit(page: Page, name: string) {
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined),
    page.getByRole("button", { name, exact: true }).click(),
  ]);
  await response.finished();
}

test("shared ownership and follow-ups: names only, one responsible person and a due date each", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.goto(`/inquiries/${CLINIC}`);
  // Selectors offer people by name, never by sign-in email.
  const choices = await page.getByLabel("Owner", { exact: true }).locator("option").allTextContents();
  expect(choices).toEqual(["Unassigned", "Omar", "Adam", "Omar & Adam"]);
  await page.getByLabel("Owner", { exact: true }).selectOption({ label: "Omar & Adam" });
  await submit(page, "Save owner");
  await expect(page.locator("[data-owners]")).toHaveText("Omar & Adam");

  // A follow-up cannot be added without a responsible person and a due date.
  await page.getByLabel("What needs to happen").fill("Send the meeting questions");
  await page.getByRole("button", { name: "Add follow-up" }).click();
  await expect(page.locator("[data-follow-up]")).toHaveCount(0);
  const due = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel("Responsible").selectOption({ label: "Adam" });
  await page.getByLabel("Due").fill(due);
  await submit(page, "Add follow-up");
  const item = page.locator('[data-follow-up="Send the meeting questions"]');
  await expect(item).toContainText("Adam");
  await expect(item).toContainText("Due");

  await page.goto("/inquiries");
  const row = page.locator("tbody tr", { hasText: "Synthetic Clinic Group" });
  await expect(row).toContainText("Omar & Adam");
  await expect(row).toContainText("Next: Send the meeting questions · Adam");
  // Routine views never show team sign-in emails.
  expect(await page.locator("body").innerText()).not.toContain("mintapp.local");

  await page.goto(`/inquiries/${CLINIC}`);
  expect(await page.locator("body").innerText()).not.toContain("mintapp.local");
  await submit(page, "Mark done");
  await expect(page.locator("[data-follow-up]")).toHaveCount(0);
  await expect(page.getByText("Completed (1)")).toBeVisible();

  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto(`/inquiries/${CLINIC}`);
  await expect(page).toHaveURL(/\/login$/);
});

const isLoginPost = (r: Response) => r.request().method() === "POST" && new URL(r.url()).pathname === "/login";
const isActionPost = (r: Response) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined;
const setCookieOf = async (r: Response) => (await r.headersArray()).filter((h) => h.name.toLowerCase() === "set-cookie").map((h) => h.value).join("\n");
const sessionCookie = async (context: BrowserContext) => (await context.cookies()).find((c) => c.name === "__Host-mintapp_team");

// Opens the dashboard in a fresh browser holding only a copy of the cookie.
async function replay(browser: Browser, cookie: NonNullable<Awaited<ReturnType<typeof sessionCookie>>>) {
  const context = await browser.newContext();
  await context.addCookies([cookie]);
  const page = await context.newPage();
  await page.goto("/inquiries");
  const url = page.url();
  await context.close();
  return url;
}

test("the session cookie is host-only, HttpOnly, Secure and SameSite=Strict; a copied cookie dies at sign-out", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(OMAR);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  const [login] = await Promise.all([page.waitForResponse(isLoginPost), page.getByRole("button", { name: "Sign in" }).click()]);
  await page.waitForURL("**/inquiries");

  const issued = await setCookieOf(login);
  expect(issued).toMatch(/^__Host-mintapp_team=[^;]{40,};/);
  for (const attribute of [/; Path=\/(;|$)/, /; Max-Age=43200(;|$)/, /; Secure(;|$)/i, /; HttpOnly(;|$)/i, /; SameSite=Strict(;|$)/i]) expect(issued).toMatch(attribute);
  expect(issued).not.toMatch(/; Domain=/i);
  const cookie = (await sessionCookie(context))!;
  expect(cookie).toMatchObject({ path: "/", secure: true, httpOnly: true, sameSite: "Strict" });
  expect(cookie.expires - Date.now() / 1000).toBeGreaterThan(43_100);

  // A copy works while the session is live...
  expect(await replay(browser, cookie)).toMatch(/\/inquiries$/);

  const [logout] = await Promise.all([page.waitForResponse(isActionPost), page.getByRole("button", { name: "Sign out", exact: true }).click()]);
  await expect(page).toHaveURL(/\/login$/);
  const cleared = await setCookieOf(logout);
  expect(cleared).toMatch(/^__Host-mintapp_team=;/);
  for (const attribute of [/; Path=\/(;|$)/, /; Max-Age=0(;|$)/, /; Secure(;|$)/i]) expect(cleared).toMatch(attribute);
  expect(await sessionCookie(context)).toBeUndefined();

  // ...and is refused after sign-out, because the session was revoked on the server.
  expect(await replay(browser, cookie)).toMatch(/\/login$/);
  await context.close();
});

test("sign out everywhere ends that person's other sessions only", async ({ browser }) => {
  const laptop = await signIn(browser, ADAM);
  const phone = await signIn(browser, ADAM);
  const omar = await signIn(browser, OMAR);
  await phone.getByRole("button", { name: "Sign out everywhere" }).click();
  await expect(phone).toHaveURL(/\/login$/);
  await laptop.goto("/inquiries");
  await expect(laptop).toHaveURL(/\/login$/);
  await omar.goto("/inquiries");
  await expect(omar).toHaveURL(/\/inquiries$/);
});

test("repeated wrong passwords lock sign-in for that account", async ({ page }) => {
  await page.goto("/login");
  for (let i = 0; i < 8; i++) {
    await page.getByLabel("Email").fill(ADAM);
    await page.getByLabel("Password").fill(`wrong-${i}`);
    // Wait for each attempt's server response before the next one.
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/login"),
      page.getByRole("button", { name: "Sign in" }).click(),
    ]);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
  }
  await expect(page.locator('p[role="alert"]')).toHaveText("Too many attempts. Try again in 15 minutes.");
  // Even the right password is refused while locked.
  await page.getByLabel("Email").fill(ADAM);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator('p[role="alert"]')).toHaveText("Too many attempts. Try again in 15 minutes.");
});

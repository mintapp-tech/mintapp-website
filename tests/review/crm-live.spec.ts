import { test, expect, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { REVIEW_PORT } from "../../playwright.review-live.config";
import { signInAs } from "../dashboard/helpers";
import { adminClient, assertReviewProject, reviewProjectFromEnv } from "../../scripts/lib/review-auth.mjs";

// The two-founder CRM (CRM Release 1 as Leads & Clients, the Pre-meeting Pack, the command
// centre and Growth) end to end against REAL Supabase Auth and the REAL database of the isolated
// synthetic review project (mintapp-review), through the same code the admin Preview runs
// (production data paths, VERCEL_ENV=preview so the review guard is active). It makes its own
// synthetic inquiries, so it does not depend on what reviewers have done. No email is sent,
// nothing leaves the review project, and no generator is called.
const OMAR = "omar.review@example.com";
const ADAM = "adam.review@example.com";
const ORIGIN = `http://localhost:${REVIEW_PORT}`;
const tag = new Date().toISOString().replace(/\D/g, "").slice(2, 12);
const COMPANY = `Review Co ${tag}`;
const CLIENT = `Review Client ${tag}`;
const CLIENT_AR = `عميل مراجعة ${tag}`;
const EMAIL = `e2e-${tag}@example.com`;
const SHOTS = "review-evidence";

test.describe.configure({ mode: "serial" });

const signIn = (browser: Browser, email: string): Promise<Page> => signInAs(browser, email, ORIGIN);
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const axe = async (page: Page) => (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations.map((v) => v.id);
const notice = (page: Page) => page.locator("[data-notice]");
const panel = (page: Page, id: string) => page.locator(`section[aria-labelledby="${id}"]`);
const openAdvanced = async (page: Page) => {
  const advanced = page.locator("[data-advanced]");
  if (!(await advanced.evaluate((d) => (d as HTMLDetailsElement).open))) await advanced.locator("summary").first().click();
};
const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

let inquiry = "";
let inquiryAr = "";
let db: ReturnType<typeof adminClient>;

test.beforeAll(async () => {
  mkdirSync(SHOTS, { recursive: true });
  const project = reviewProjectFromEnv();
  await assertReviewProject(project);
  db = adminClient(project);
  const make = async (name: string, lang: "en" | "ar", description: string, company: string | null, email: string) => {
    const { data, error } = await db
      .from("project_inquiries")
      .insert({
        full_name: name,
        email,
        phone: "+20 100 555 0199",
        company_name: company,
        company_url: company ? "https://www.review-check.invalid/en" : null,
        preferred_language: lang,
        project_type: "web_app",
        project_description: description,
        country: "Egypt",
        consent_given: true,
        consent_at: new Date().toISOString(),
        source_page: `/${lang}/start`,
        utm_source: "linkedin",
        utm_medium: "organic",
        utm_campaign: "start_with_direction",
        utm_content: "flagship_en",
        submission_token: randomUUID(),
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    return data!.id as string;
  };
  inquiry = await make(CLIENT, "en", "We run 3 physiotherapy clinics in Cairo and want online booking for patients. Reach me at personal@review-check.invalid.", COMPANY, EMAIL);
  inquiryAr = await make(CLIENT_AR, "ar", "لدينا مدرسة خاصة ونريد موقعًا يعرض معلومات المدرسة ويتيح التقديم أونلاين.", null, `e2e-ar-${tag}@example.com`);
  // A booked meeting, as the Cal.com webhook would record it (a database function; Cal.com is not contacted).
  const start = new Date(Date.now() + 3 * 86_400_000).toISOString();
  const booked = await db.rpc("apply_booking_created", { p_inquiry_id: inquiry, p_uid: `review-${tag}`, p_start_time: start, p_timezone: "Africa/Cairo", p_event_at: new Date().toISOString() });
  expect(booked.error).toBeNull();
});

test("the deployment answers only for the synthetic review project, and refuses a stranger", async ({ page, request }) => {
  for (const path of ["/dashboard", "/leads", "/growth", "/settings", "/companies", "/outreach", "/metrics", `/leads/${inquiry}`, `/leads/${inquiry}/pack`]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator("body")).not.toContainText(CLIENT);
    expect([302, 303, 307, 308]).toContain((await request.get(path, { maxRedirects: 0 })).status());
  }
  expect((await request.post("/export/contacts", { headers: { origin: ORIGIN }, maxRedirects: 0 })).status()).toBe(401);
});

test("English, desktop: the command centre shows the booked meeting, the waiting lead and the review with no owner", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dashboard");
  await expect(page.locator('[data-section="meetings"]')).toContainText(CLIENT);
  await expect(page.locator('[data-section="awaiting"]')).toContainText(CLIENT_AR);
  await expect(page.locator('[data-section="actions"]')).toContainText("Review and approve the pre-meeting pack");
  expect(await axe(page)).toEqual([]);
  await shot(page, "en-desktop-dashboard");
  await page.context().close();
});

test("English: ownership, a dated next action, the position, and a booking that never moves it", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.goto(`/leads/${inquiry}`);
  await page.locator("#owner-select").selectOption("adam,omar");
  await page.getByRole("button", { name: "Save owner" }).click();
  await page.waitForURL(/n=saved/);
  await expect(page.locator("[data-owners]")).toContainText("Omar & Adam");
  await page.locator("#follow-up-action").fill("Send the meeting questions");
  await page.locator("#follow-up-owner").selectOption("adam");
  await page.locator("#follow-up-due").fill("2030-02-01");
  await page.getByRole("button", { name: "Add follow-up" }).click();
  await expect(page.locator("[data-follow-ups]")).toContainText("Adam");
  await page.locator("#position-select").selectOption("qualified");
  await page.getByRole("button", { name: "Save position" }).click();
  await page.waitForURL(/n=stageChanged/);
  // The booking is rescheduled and cancelled by the (simulated) webhook: the position stays, the pack stays.
  const later = new Date(Date.now() + 5 * 86_400_000).toISOString();
  await db.rpc("apply_booking_rescheduled", { p_inquiry_id: inquiry, p_reschedule_uid: `review-${tag}`, p_new_uid: `review-${tag}-b`, p_start_time: later, p_timezone: "Africa/Cairo", p_event_at: new Date().toISOString() });
  await db.rpc("apply_booking_cancelled", { p_inquiry_id: inquiry, p_uid: `review-${tag}-b`, p_start_time: later, p_timezone: "Africa/Cairo", p_event_at: new Date(Date.now() + 1000).toISOString() });
  await page.goto(`/leads/${inquiry}`);
  await expect(page.locator("#position-select")).toHaveValue("qualified");
  await expect(page.locator("[data-meeting]")).toHaveAttribute("data-meeting", "cancelled");
  await page.goto(`/leads/${inquiry}/activity`);
  await expect(page.locator("[data-activity]")).toContainText("The meeting was rescheduled");
  await expect(page.locator("[data-activity]")).toContainText("The meeting was cancelled");
  await page.goto(`/leads/${inquiry}/pack`);
  await expect(page.locator("#pack-state [data-pack-state]")).toBeVisible();
  await shot(page, "en-desktop-lead");
  await page.context().close();
});

test("Pre-meeting Pack: automation is off, so the manual path is offered, versioned and approved by the other founder", async ({ browser }) => {
  const omar = await signIn(browser, OMAR);
  await omar.goto(`/leads/${inquiry}/pack`);
  await expect(omar.locator("#pack-state [data-pack-state]")).toHaveText("Needs manual action");
  // The prompt carries the brief, never a way to reach the client.
  const prompt = (await omar.locator("[data-manual-prompt]").textContent()) ?? "";
  expect(prompt).toContain("physiotherapy clinics");
  expect(prompt).not.toMatch(new RegExp(`${EMAIL}|personal@review-check|555 0199|${COMPANY}|${CLIENT}|review-check\\.invalid`));
  const discovery = omar.locator('[data-artifact="discovery"]');
  await discovery.locator("summary").first().click();
  await discovery.locator("textarea").first().fill("Questions to ask\n- Who books today?\n- What happens when a patient cancels?");
  await discovery.getByRole("button", { name: "Save as a new version" }).click();
  await expect(notice(omar)).toContainText("saved as a new version");
  await omar.locator('[data-artifact="discovery"]').getByRole("button", { name: "Ready for review" }).click();
  await expect(omar.locator('[data-artifact="discovery"] [data-review]')).toHaveText("Ready for review");
  await expect(omar.locator('[data-artifact="discovery"] [data-waiting-for-teammate]')).toBeVisible();
  const adam = await signIn(browser, ADAM);
  await adam.goto("/dashboard");
  await expect(adam.locator('[data-section="packs"]')).toContainText(CLIENT);
  await adam.goto(`/leads/${inquiry}/pack`);
  await adam.locator('[data-artifact="discovery"]').getByRole("button", { name: "Approve for the meeting" }).click();
  await expect(adam.locator('[data-artifact="discovery"] [data-review]')).toHaveText("Approved for meeting");
  await adam.goto("/dashboard");
  await expect(adam.locator('[data-section="packs"]')).not.toContainText(CLIENT);
  await omar.context().close();
  await adam.context().close();
});

test("company and contact are created from the inquiry; contact details stay on detail pages", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.goto(`/leads/${inquiry}`);
  await openAdvanced(page);
  await page.locator("#create-mode").selectOption("new");
  await page.getByRole("button", { name: "Create from this inquiry" }).click();
  await expect(notice(page)).toContainText("Created.");
  await openAdvanced(page);
  await expect(page.locator("[data-linked-company]")).toContainText(COMPANY);
  for (const path of ["/leads", "/companies", `/search?q=${tag}`, "/dashboard", "/growth"]) {
    await page.goto(path);
    await expect(page.locator("body"), path).not.toContainText(EMAIL);
  }
  await page.goto(`/search?q=${encodeURIComponent(EMAIL.slice(0, 14))}`);
  await expect(page.locator('[data-results="inquiries"]')).toContainText(CLIENT);
  await expect(page.locator("body")).not.toContainText(EMAIL);
  await page.goto("/companies");
  await page.getByRole("link", { name: COMPANY }).click();
  await expect(page.locator("[data-contact]")).toContainText(EMAIL);
  await shot(page, "en-desktop-company");
  expect(await axe(page)).toEqual([]);
  await page.context().close();
});

test("proposal and scope: written by Omar, approved by Adam, sent by hand, won, then a project", async ({ browser }) => {
  const omar = await signIn(browser, OMAR);
  await omar.goto(`/leads/${inquiry}/deal`);
  await omar.getByText("Start a proposal").click();
  await omar.locator("#new-proposal-summary").fill("Online booking for three clinics");
  await omar.locator("#new-proposal-scope").fill("Patient booking and a receptionist schedule");
  await omar.locator("#new-proposal-pmin").fill("5000");
  await omar.locator("#new-proposal-pmax").fill("8000");
  await omar.locator("#new-proposal-currency").selectOption("USD");
  await omar.getByRole("button", { name: "Save draft" }).click();
  await expect(notice(omar)).toContainText("The proposal was saved.");
  await omar.getByRole("button", { name: "Send for internal review" }).click();
  await expect(omar.locator("[data-proposal-status]")).toHaveText("Internal review");
  await expect(omar.getByRole("button", { name: "Approve internally" })).toHaveCount(0);
  const adam = await signIn(browser, ADAM);
  await adam.goto(`/leads/${inquiry}/deal`);
  await adam.getByRole("button", { name: "Approve internally" }).click();
  await expect(adam.locator("[data-proposal-status]")).toHaveText("Approved internally");
  await adam.getByRole("button", { name: "Record as sent" }).click();
  await expect(adam.locator("[data-proposal-status]")).toHaveText("Sent");
  await adam.getByRole("button", { name: "Record as accepted" }).click();
  await expect(adam.locator("[data-proposal-status]")).toHaveText("Accepted");
  await expect(adam.locator("header [data-position]")).toHaveAttribute("data-position", "qualified");
  await shot(adam, "en-desktop-deal");
  await adam.goto(`/leads/${inquiry}`);
  await adam.locator("#position-select").selectOption("won");
  await adam.getByRole("button", { name: "Save position" }).click();
  await adam.waitForURL(/n=stageChanged/);
  await adam.goto(`/leads/${inquiry}/deal`);
  await adam.locator("#project-name").fill(`Project ${tag}`);
  await adam.getByRole("button", { name: "Create the project" }).click();
  await expect(notice(adam)).toContainText("The project was created.");
  await adam.locator("[data-project]").getByRole("link").click();
  await expect(adam.getByRole("heading", { level: 1 })).toHaveText(`Project ${tag}`);
  await expect(panel(adam, "decisions")).toContainText("proposal v1 accepted");
  await expect(panel(adam, "history")).toContainText("stay on the inquiry");
  expect(await axe(adam)).toEqual([]);
  await omar.context().close();
  await adam.context().close();
});

test("outreach: a prospect with a dated next action, a touch, and the hand-over to an inquiry", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.goto("/outreach");
  await page.locator("#new-company").fill(`Prospect ${tag}`);
  await page.locator("#new-pool").selectOption("trigger_startup");
  await page.locator("#new-owner").selectOption("omar");
  await page.locator("#new-contact").fill("Dana Lee");
  await page.locator("#new-handle").fill(`handle-${tag}`);
  await page.locator("#new-trigger").fill("Seed round announced");
  for (const key of ["trigger", "problem", "access", "proof", "timing", "commercial", "geo"]) await page.locator(`#new-score-${key}`).selectOption("2");
  await page.getByRole("button", { name: "Save prospect" }).click();
  await expect(page).toHaveURL(/\/outreach\/[0-9a-f-]{36}\?n=created/);
  await page.locator("#t-summary").fill("Observation about the seed round");
  await page.getByRole("button", { name: "Record the touch" }).click();
  await page.waitForURL(/e=follow_up_required/);
  await page.locator("#t-summary").fill("Observation about the seed round");
  await page.locator("#t-next").fill("Touch 2: a useful workflow observation");
  await page.locator("#t-owner").selectOption("omar");
  await page.locator("#t-due").fill("2030-02-10");
  await page.getByRole("button", { name: "Record the touch" }).click();
  await expect(notice(page)).toContainText("The touch was recorded.");
  await expect(page.locator("[data-next-action]")).toContainText("Omar");
  await page.goto("/outreach");
  await expect(page.locator("body")).not.toContainText(`handle-${tag}`);
  await shot(page, "en-desktop-outreach");
  await page.getByRole("link", { name: `Prospect ${tag}` }).click();
  const target = await page.locator("#link-inquiry option", { hasText: CLIENT_AR }).getAttribute("value");
  await page.locator("#link-inquiry").selectOption(target!);
  await page.getByRole("button", { name: "Link", exact: true }).click();
  await expect(notice(page)).toContainText("Linked.");
  expect(await axe(page)).toEqual([]);
  await page.context().close();
});

test("Leads & Clients filters, search, metrics and the CSV export", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.goto(`/leads?q=${encodeURIComponent(tag)}&stage=closed`);
  await expect(page.locator("[data-lead]")).toHaveCount(1);
  await expect(page.locator("[data-lead]")).toContainText(CLIENT);
  await page.goto(`/leads?q=${encodeURIComponent(tag)}&stage=new`);
  await expect(page.locator("[data-lead]")).toContainText(CLIENT_AR);
  await page.goto(`/leads?q=${encodeURIComponent(tag)}&owner=adam`);
  await expect(page.locator("[data-lead]").filter({ hasText: CLIENT })).toHaveCount(1);
  await page.goto(`/leads?q=${encodeURIComponent(tag)}`);
  await expect(page.locator("[data-lead]")).toHaveCount(2);
  await expect(page.locator("[data-leads]")).not.toContainText(EMAIL);
  await page.goto("/metrics");
  await expect(page.locator("[data-sources]")).toContainText("linkedin");
  await shot(page, "en-desktop-metrics");
  expect(await axe(page)).toEqual([]);

  const post = (kind: string, headers: Record<string, string> = { origin: ORIGIN }) => page.request.post(`/export/${kind}`, { headers, maxRedirects: 0 });
  const inquiries = await post("inquiries");
  expect(inquiries.status()).toBe(200);
  const csv = await inquiries.text();
  expect(csv.startsWith("﻿id,received,client")).toBe(true);
  expect(csv).toContain(CLIENT);
  expect(csv).not.toContain(EMAIL);
  expect((await (await post("prospects")).text())).not.toContain(`handle-${tag}`);
  expect(await (await post("contacts")).text()).toContain(EMAIL);
  expect((await post("contacts", { origin: "https://evil.invalid" })).status()).toBe(403);
  expect((await post("contacts", {})).status()).toBe(403);
  expect((await page.request.get("/export/contacts", { maxRedirects: 0 })).status()).toBe(405);
  await page.context().close();
});

test("Arabic and RTL on desktop, then English and Arabic on a phone: nothing overflows, no accessibility violations", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  const paths = ["/dashboard", "/leads", `/leads/${inquiryAr}`, `/leads/${inquiry}`, `/leads/${inquiry}/pack`, `/leads/${inquiry}/deal`, "/growth", "/outreach", "/companies", "/projects", "/metrics", "/settings", `/search?q=${encodeURIComponent(tag)}`];
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Switch the interface to Arabic" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  for (const path of paths) {
    await page.goto(path);
    await expect(page.locator("html"), path).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 }).first(), path).toBeVisible();
    expect(await axe(page), path).toEqual([]);
  }
  await page.goto("/dashboard");
  await shot(page, "ar-desktop-dashboard");
  await page.goto(`/leads/${inquiryAr}`);
  await expect(page.locator("[data-brief=description]")).toContainText("مدرسة خاصة");
  await shot(page, "ar-desktop-lead");
  await page.goto(`/leads/${inquiry}/pack`);
  await shot(page, "ar-desktop-pack");
  await page.goto("/growth");
  await shot(page, "ar-desktop-growth");
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of paths) {
    await page.goto(path);
    expect(await overflow(page), `ar ${path}`).toBe(0);
  }
  await page.goto("/dashboard");
  await shot(page, "ar-phone-dashboard");
  await page.goto(`/leads/${inquiryAr}`);
  await shot(page, "ar-phone-lead");
  await page.getByRole("button", { name: "التبديل إلى الواجهة الإنجليزية" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  for (const path of paths) {
    await page.goto(path);
    expect(await overflow(page), `en ${path}`).toBe(0);
    expect(await axe(page), `en ${path}`).toEqual([]);
  }
  await page.goto("/dashboard");
  await shot(page, "en-phone-dashboard");
  await page.goto(`/leads/${inquiry}`);
  await shot(page, "en-phone-lead");
  await page.context().close();
});

test("sign-out ends the session on the server; the back button shows nothing private", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goBack();
  await expect(page.locator("body")).not.toContainText(CLIENT);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await page.context().close();
});

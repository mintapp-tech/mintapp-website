import { test, expect, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { DEMO_PORT } from "../../playwright.dashboard.config";
import { signInAs } from "./helpers";

// CRM Release 1 end to end, on the synthetic fixture (tests/fixtures/synthetic-inquiries.sql),
// signed in as the two team members through the real sign-in path.
const CLINIC = "11111111-0000-4000-8000-000000000001";
const SCHOOL = "11111111-0000-4000-8000-000000000002";
const CRAFTS = "11111111-0000-4000-8000-000000000004";
const OMAR = "omar.demo@mintapp.local";
const ADAM = "adam.demo@mintapp.local";
const ORIGIN = `http://localhost:${DEMO_PORT}`;

test.describe.configure({ mode: "serial" });

const signIn = (browser: Browser, email: string): Promise<Page> => signInAs(browser, email, ORIGIN);
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const axe = async (page: Page) => (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations.map((v) => v.id);
const notice = (page: Page) => page.locator("[data-notice]");
// A panel is a section labelled by its heading; the heading carries the id used for in-page links.
const panel = (page: Page, id: string) => page.locator(`section[aria-labelledby="${id}"]`);

test("every new page and route refuses without a signed-in session, and says nothing", async ({ page, request }) => {
  const paths = ["/dashboard", "/pipeline", "/outreach", "/companies", "/proposals", "/projects", "/metrics", "/search?q=clinic", `/companies/${CLINIC}`, `/contacts/${CLINIC}`, `/outreach/${CLINIC}`, `/projects/${CLINIC}`];
  for (const path of paths) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator("body")).not.toContainText("physiotherapy");
    const raw = await request.get(path, { maxRedirects: 0 });
    expect([302, 303, 307, 308]).toContain(raw.status());
  }
  for (const kind of ["inquiries", "companies", "contacts", "prospects"]) {
    const res = await request.post(`/export/${kind}`, { headers: { origin: ORIGIN }, maxRedirects: 0 });
    expect([401, 403]).toContain(res.status());
    expect(await res.text()).toBe("");
  }
});

test("signing in lands on the dashboard: what needs a person today", async ({ browser }) => {
  const omar = await signIn(browser, OMAR);
  await omar.goto("/dashboard");
  await expect(omar.getByRole("heading", { level: 1 })).toHaveText("Dashboard");
  const summary = omar.locator("[data-summary]");
  await expect(summary.locator(":scope > *", { hasText: "New inquiries" }).locator("dd")).toHaveText("4");
  // The school's meeting is booked and has no approved preparation yet.
  await expect(omar.getByRole("region", { name: "Meetings to prepare" })).toContainText("مدرسة تجريبية");
  // No lead has an owner yet.
  await expect(omar.getByRole("region", { name: "Needs attention" })).toContainText("No owner");
  const nav = omar.getByRole("navigation", { name: "Admin" });
  for (const name of ["Dashboard", "Inquiries", "Pipeline", "Outreach", "Companies", "Proposals", "Projects", "Metrics"]) await expect(nav.getByRole("link", { name })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  expect(await axe(omar)).toEqual([]);
});

test("sales stage: thirteen stages, a loss needs its reason, history is kept, and bookings never move it", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.goto(`/inquiries/${CLINIC}`);
  const stage = page.locator("#stage-select");
  await expect(stage.locator("option")).toHaveCount(13);
  await stage.selectOption("qualified");
  await page.getByRole("button", { name: "Update stage" }).click();
  await expect(notice(page)).toContainText("The stage was updated.");
  await expect(page.locator("[data-stage]").first()).toHaveAttribute("data-stage", "qualified");

  // Lost without a reason is refused, and nothing changes.
  await page.locator("#stage-select").selectOption("lost");
  await page.getByRole("button", { name: "Update stage" }).click();
  await expect(notice(page)).toContainText("Choose why the deal was lost.");
  await expect(page.locator("#stage-select")).toHaveValue("qualified");

  // The meeting side is separate: booking, rescheduling and cancelling leave the stage alone.
  for (const [name, meeting] of [["Simulate booking", "Booked"], ["Simulate reschedule", "Booked"], ["Simulate cancellation", "Cancelled"], ["Simulate booking", "Booked"]]) {
    await page.getByRole("button", { name }).click();
    await expect(page.locator("[data-status=meeting]")).toHaveText(meeting);
    await expect(page.locator("#stage-select")).toHaveValue("qualified");
  }

  // The booking history is on the activity trail, with the stage change.
  await expect(page.locator("[data-activity]")).toContainText("A meeting was booked");
  await expect(page.locator("[data-activity]")).toContainText("The meeting was cancelled");
  await page.getByText("Stage history").click();
  await expect(page.locator("[data-stage-history]")).toContainText("New → Qualified");
  await expect(page.locator("[data-stage-history]")).toContainText("Omar");
  await page.context().close();
});

test("source and qualification: tracked-link values, origin, partner, fit tier and a seven-part score", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.goto(`/inquiries/${CLINIC}`);
  await expect(panel(page, "source")).toContainText("Direct or not tracked");
  await page.locator("#src-origin").selectOption("referral");
  await page.locator("#src-partner").fill("Studio Nine");
  await page.locator("#src-fit").selectOption("tier_1");
  await page.locator("#src-trigger").fill("Opened a third clinic this quarter");
  for (const key of ["trigger", "problem", "access", "proof", "timing", "commercial", "geo"]) await page.locator(`#src-score-${key}`).selectOption("2");
  await page.locator("#src-score-access").selectOption("0");
  await page.getByRole("button", { name: "Save source and qualification" }).click();
  await expect(notice(page)).toContainText("Saved.");
  await expect(panel(page, "source")).toContainText("12 of 14");
  // A partial score is refused.
  await page.locator("#src-score-trigger").selectOption("");
  await page.getByRole("button", { name: "Save source and qualification" }).click();
  await expect(notice(page)).toContainText("Score all seven categories, or none.");
  // The list shows where it came from, and can be filtered by it.
  await page.goto("/inquiries?origin=referral");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody")).toContainText("Referral");
  await expect(page.locator("tbody")).toContainText("12 of 14");
  await page.goto("/inquiries?origin=inbound");
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await page.context().close();
});

test("company and contact: created from an inquiry, contact details only on detail pages, duplicates never merged", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.goto(`/inquiries/${CLINIC}`);
  await expect(panel(page, "company")).toContainText("Not linked");
  await page.locator("#create-mode").selectOption("new");
  await page.getByRole("button", { name: "Create from this inquiry" }).click();
  await expect(notice(page)).toContainText("Created.");
  await expect(page.locator("[data-linked-company]")).toContainText("Nile Physio Group");
  await expect(page.locator("[data-linked-contact]")).toContainText("Consent: Consented on the form");
  // Not on the list, the search results, the company list or the dashboard.
  for (const path of ["/inquiries", "/companies", "/search?q=clinic", "/dashboard", "/pipeline"]) {
    await page.goto(path);
    await expect(page.locator("body"), path).not.toContainText("clinic@example.com");
  }
  // Search can match the address without showing it.
  await page.goto("/search?q=clinic%40example");
  await expect(page.locator('[data-results="inquiries"]')).toContainText("Synthetic Clinic Group");
  await expect(page.locator("body")).not.toContainText("clinic@example.com");
  // The contact's own page shows it.
  await page.goto("/companies");
  await page.getByRole("link", { name: "Nile Physio Group" }).click();
  await expect(page.locator("[data-contact]")).toContainText("clinic@example.com");
  await page.locator("[data-contact]").getByRole("link").first().click();
  await expect(page.locator("#contact-name")).toHaveValue("Synthetic Clinic Group");
  await expect(page.locator("#contact-email")).toHaveValue("clinic@example.com");

  // Another company with the same name is flagged, not merged.
  await page.goto("/companies");
  await page.locator("#new-company-name").fill("nile physio group");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page).toHaveURL(/\/companies\/[0-9a-f-]{36}\?n=created/);
  await expect(page.locator("[data-duplicates]")).toContainText("Nile Physio Group");
  await page.goto("/companies");
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await expect(page.locator("tbody")).toContainText("Possible duplicate");
  await expect(page.locator("[data-duplicate-groups]")).toBeVisible();
  await page.context().close();
});

test("withdrawing consent means do not contact, and is kept", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.goto("/companies");
  await page.getByRole("link", { name: "Nile Physio Group" }).first().click();
  await page.locator("[data-contact]").getByRole("link").first().click();
  await page.locator("#contact-consent").selectOption("withdrawn");
  await page.getByRole("button", { name: "Save contact" }).click();
  await expect(notice(page)).toContainText("Saved.");
  await expect(page.locator("#contact-dnc")).toBeChecked();
  await page.goto(`/inquiries/${CLINIC}`);
  await expect(page.locator("[data-linked-contact]")).toContainText("Do not contact");
  await page.context().close();
});

test("proposal and scope: a teammate approves, it is recorded as sent by hand, and the stage never moves by itself", async ({ browser }) => {
  const omar = await signIn(browser, OMAR);
  await omar.goto(`/inquiries/${CLINIC}`);
  await expect(panel(omar, "proposal")).toContainText("No proposal yet.");
  await omar.getByText("Start a proposal").click();
  await omar.locator("#new-proposal-summary").fill("Online booking for three clinics");
  await omar.locator("#new-proposal-scope").fill("Web app for patients and a schedule for receptionists");
  await omar.locator("#new-proposal-wmin").fill("8");
  await omar.locator("#new-proposal-wmax").fill("12");
  await omar.locator("#new-proposal-pmin").fill("5000");
  await omar.locator("#new-proposal-pmax").fill("8000");
  await omar.getByRole("button", { name: "Save draft" }).click();
  // A price needs its currency.
  await expect(notice(omar)).toContainText("Some of what you entered is not valid");
  await omar.getByText("Start a proposal").click();
  await omar.locator("#new-proposal-summary").fill("Online booking for three clinics");
  await omar.locator("#new-proposal-pmin").fill("5000");
  await omar.locator("#new-proposal-pmax").fill("8000");
  await omar.locator("#new-proposal-currency").selectOption("USD");
  await omar.getByRole("button", { name: "Save draft" }).click();
  await expect(notice(omar)).toContainText("The proposal was saved.");
  await expect(omar.locator("[data-proposal-status]")).toHaveText("Draft");
  await omar.getByRole("button", { name: "Send for internal review" }).click();
  await expect(omar.locator("[data-proposal-status]")).toHaveText("Internal review");
  // Omar wrote it: he cannot approve it.
  await expect(omar.getByRole("button", { name: "Approve internally" })).toHaveCount(0);
  await expect(omar.locator("[data-waiting-for-teammate]")).toBeVisible();
  // Nothing can be sent before it is approved.
  await expect(omar.getByRole("button", { name: "Record as sent" })).toHaveCount(0);

  const adam = await signIn(browser, ADAM);
  await adam.goto(`/inquiries/${CLINIC}`);
  await adam.getByRole("button", { name: "Approve internally" }).click();
  await expect(adam.locator("[data-proposal-status]")).toHaveText("Approved internally");
  await expect(panel(adam, "proposal")).toContainText("Approved by Adam");
  await adam.getByRole("button", { name: "Record as sent" }).click();
  await expect(adam.locator("[data-proposal-status]")).toHaveText("Sent");
  await adam.getByRole("button", { name: "Record as accepted" }).click();
  await expect(adam.locator("[data-proposal-status]")).toHaveText("Accepted");
  // The proposal never changed the sales stage.
  await expect(adam.locator("#stage-select")).toHaveValue("qualified");
  // The dashboard no longer lists it as waiting.
  await adam.goto("/proposals");
  await expect(adam.locator("body")).toContainText("No proposals are waiting.");
  await adam.goto("/proposals?all=1");
  await expect(adam.locator("[data-proposal]")).toHaveCount(1);
  await omar.context().close();
  await adam.context().close();
});

test("a revision is a new version and the earlier one is kept", async ({ browser }) => {
  const page = await signIn(browser, ADAM);
  await page.goto(`/inquiries/${CLINIC}`);
  await page.getByText("Revise as a new version").first().click();
  await page.locator("#revise-proposal-summary").fill("Online booking for three clinics, phase one");
  await page.getByRole("button", { name: "Revise as a new version" }).last().click();
  await expect(page.locator("[data-proposal-version]")).toHaveAttribute("data-proposal-version", "2");
  await expect(page.locator("[data-proposal-status]")).toHaveText("Draft");
  await page.getByText(/Earlier versions/).click();
  await expect(panel(page, "proposal")).toContainText("Version 1");
  // An accepted version keeps its answer; only work in progress is superseded.
  await expect(panel(page, "proposal")).toContainText("Accepted");
  await page.context().close();
});

test("won becomes a minimal project that keeps the scope and where the inquiry's history lives", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.goto(`/inquiries/${CLINIC}`);
  await expect(panel(page, "conversion")).toContainText("Mark the inquiry as won to create a project.");
  await page.locator("#stage-select").selectOption("won");
  await page.getByRole("button", { name: "Update stage" }).click();
  await page.waitForURL(/n=stageChanged/);
  await expect(page.locator("#stage-select")).toHaveValue("won");
  await page.locator("#project-name").fill("Clinic booking system");
  await page.getByRole("button", { name: "Create the project" }).click();
  await expect(notice(page)).toContainText("The project was created.");
  await page.locator("[data-project]").getByRole("link").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Clinic booking system");
  await expect(panel(page, "source")).toBeVisible();
  await expect(panel(page, "history")).toContainText("stay on the inquiry");
  await expect(panel(page, "decisions")).toContainText("stage: qualified to won");
  await expect(panel(page, "decisions")).toContainText("proposal v1 accepted");
  await page.getByRole("link", { name: /Open the inquiry/ }).click();
  await expect(page).toHaveURL(new RegExp(`/inquiries/${CLINIC}$`));
  await page.goto("/projects");
  await expect(page.locator("tbody")).toContainText("Clinic booking system");
  expect(await axe(page)).toEqual([]);
  await page.context().close();
});

test("outreach: research, the next action is always dated, four touches, and a hand-over to the inquiry", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.goto("/outreach");
  await expect(page.locator("[data-pools]")).toContainText("0 of 10");
  await page.locator("#new-company").fill("Acme Robotics");
  await page.locator("#new-country").fill("UAE");
  await page.locator("#new-pool").selectOption("trigger_startup");
  await page.locator("#new-owner").selectOption("omar");
  await page.locator("#new-contact").fill("Dana Lee");
  await page.locator("#new-handle").fill("linkedin.com/in/dana-test");
  await page.locator("#new-trigger").fill("Seed round announced");
  for (const key of ["trigger", "problem", "access", "proof", "timing", "commercial", "geo"]) await page.locator(`#new-score-${key}`).selectOption("2");
  await page.getByRole("button", { name: "Save prospect" }).click();
  await expect(page).toHaveURL(/\/outreach\/[0-9a-f-]{36}\?n=created/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Acme Robotics");

  // Contacting needs the next action, a responsible person and a date.
  await page.locator("#ps-stage").selectOption("contacted");
  await page.getByRole("button", { name: "Update", exact: true }).click();
  await expect(notice(page)).toContainText("Add the next action, who is responsible and the date.");

  // Touch 1 without a next action is refused and leaves nothing half-recorded.
  await page.goto(page.url().split("?")[0]);
  await page.locator("#t-summary").fill("Observation about the seed round");
  await page.getByRole("button", { name: "Record the touch" }).click();
  await page.waitForURL(/e=follow_up_required/);
  await expect(notice(page)).toContainText("Add the next action, who is responsible and the date.");
  await expect(page.locator("[data-touches]")).toHaveCount(0);

  await page.goto(page.url().split("?")[0]);
  await page.locator("#t-summary").fill("Observation about the seed round");
  await page.locator("#t-next").fill("Touch 2: a useful workflow observation");
  await page.locator("#t-owner").selectOption("omar");
  await page.locator("#t-due").fill("2030-01-15");
  await page.getByRole("button", { name: "Record the touch" }).click();
  await expect(notice(page)).toContainText("The touch was recorded.");
  await expect(page.locator("[data-touches]")).toContainText("Observation about the seed round");
  await expect(page.getByText("Contacted").first()).toBeVisible();
  await expect(page.locator("[data-next-action]")).toContainText("Touch 2: a useful workflow observation");
  await expect(page.locator("[data-next-action]")).toContainText("Omar");
  // The contact handle is on this page only.
  await expect(page.locator("#edit-handle")).toHaveValue("linkedin.com/in/dana-test");
  await page.goto("/outreach");
  await expect(page.locator("body")).not.toContainText("dana-test");
  await expect(page.locator("[data-pools]")).toContainText("1 of 8");
  await expect(page.locator("[data-prospect]")).toContainText("14");

  // The same account later submits the form: link it.
  await page.getByRole("link", { name: "Acme Robotics" }).click();
  const restaurant = await page.locator("#link-inquiry option", { hasText: "Synthetic Restaurant" }).getAttribute("value");
  await page.locator("#link-inquiry").selectOption(restaurant!);
  await page.getByRole("button", { name: "Link", exact: true }).click();
  await expect(notice(page)).toContainText("Linked.");
  await expect(page.locator("[data-linked-inquiry]")).toBeVisible();
  await expect(page.getByText("Inquiry submitted").first()).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await page.context().close();
});

test("a prospect marked do-not-contact takes no outbound touch", async ({ browser }) => {
  const page = await signIn(browser, ADAM);
  await page.goto("/outreach");
  await page.locator("#new-company").fill("Quiet Co");
  await page.locator("#new-owner").selectOption("adam");
  await page.getByRole("button", { name: "Save prospect" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Quiet Co");
  await page.locator("#edit-dnc").check();
  await page.getByRole("button", { name: "Save prospect" }).click();
  await expect(page.locator("#edit-dnc")).toBeChecked();
  await page.locator("#t-summary").fill("Tried to reach out");
  await page.locator("#t-next").fill("Wait");
  await page.locator("#t-owner").selectOption("adam");
  await page.locator("#t-due").fill("2030-01-20");
  await page.getByRole("button", { name: "Record the touch" }).click();
  await expect(notice(page)).toContainText("marked do not contact");
  await page.context().close();
});

test("pipeline: every inquiry in its stage, by owner; overdue and unplanned work stands out", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.goto(`/inquiries/${SCHOOL}`);
  await page.locator("#owner-select").selectOption("adam");
  await page.getByRole("button", { name: "Save owner" }).click();
  await page.waitForURL(/n=saved/);
  await page.locator("#stage-select").selectOption("meeting_booked");
  await page.getByRole("button", { name: "Update stage" }).click();
  await page.waitForURL(/n=stageChanged/);
  await page.goto("/pipeline");
  await expect(page.locator('[data-stage-column="meeting_booked"]')).toContainText("مدرسة تجريبية");
  await expect(page.locator('[data-stage-column="won"]')).toContainText("Synthetic Clinic Group");
  await expect(page.locator('[data-stage-column="new"] [data-pipeline-card]')).toHaveCount(2);
  await expect(page.locator('[data-stage-column="new"]')).toContainText("No next action");
  await page.goto("/pipeline?owner=adam");
  await expect(page.locator("[data-pipeline-card]")).toHaveCount(1);
  await page.goto("/pipeline?owner=unassigned");
  await expect(page.locator("[data-pipeline-card]")).toHaveCount(3);
  await page.goto("/pipeline?owner=%3Cscript%3E");
  await expect(page.locator("[data-pipeline-card]")).toHaveCount(4);
  expect(await axe(page)).toEqual([]);
  await page.context().close();
});

test("filters: owner, stage, attention and text narrow the inquiry list; the address bar is not trusted", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.goto("/inquiries?owner=unassigned&stage=new");
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page.goto("/inquiries?q=physiotherapy");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.goto("/inquiries?q=%27%3B+drop+table+public.project_inquiries%3B+--");
  await expect(page.getByText("No inquiries match these filters.")).toBeVisible();
  await page.goto("/inquiries?stage=bogus&origin=bogus&owner=%3Cb%3E");
  await expect(page.locator("tbody tr")).toHaveCount(4);
  await page.goto("/inquiries");
  await page.locator("#f-q").fill("مدرسة");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/q=/);
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.getByRole("status").filter({ hasText: "Showing 1 of 4" })).toBeVisible();
  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(4);
  await page.context().close();
});

test("metrics: the funnel, sources and outreach for a period, with no data shown as no data", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.goto("/metrics");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Metrics");
  const cohort = page.locator("[data-cohort]");
  await expect(cohort.locator("div", { hasText: "New inquiries" }).locator("dd")).toHaveText("4");
  await expect(cohort.locator("div", { hasText: "Wins" }).locator("dd")).toHaveText("1");
  await expect(page.locator("[data-sources]")).toContainText("direct");
  await expect(page.locator("[data-rates]")).toContainText("Inquiry to booking");
  await expect(page.locator("[data-outreach]")).toContainText("Prospects");
  // A period with nothing in it: no data, not zero percent.
  await page.goto("/metrics?from=2020-01-01&to=2020-01-31");
  await expect(page.locator("[data-rates]")).toContainText("No data yet");
  await expect(page.locator("[data-sources]")).toHaveCount(0);
  await page.goto("/metrics?from=2026-12-01&to=2026-01-01");
  await expect(page.locator("p[role=alert]")).toContainText("not valid");
  expect(await axe(page)).toEqual([]);
  await page.context().close();
});

test("search: companies, contacts, inquiries and prospects, by name or company, never showing contact details", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.goto("/search?q=acme");
  await expect(page.locator('[data-results="prospects"]')).toContainText("Acme Robotics");
  await page.goto("/search?q=synthetic");
  await expect(page.locator('[data-results="inquiries"]')).toContainText("Synthetic Restaurant");
  await expect(page.locator('[data-results="contacts"]')).toContainText("Synthetic Clinic Group");
  await page.goto("/search?q=nile");
  await expect(page.locator('[data-results="companies"]')).toContainText("Nile Physio Group");
  await expect(page.locator('[data-results="inquiries"]')).toContainText("Nile Physio Group");
  await expect(page.locator("body")).not.toContainText("@example.com");
  await page.goto("/search?q=x");
  await expect(page.getByText("Type at least two characters.")).toBeVisible();
  await page.goto("/search?q=zzzz-nothing");
  await expect(page.getByText("Nothing matches.")).toBeVisible();
  // The header search works from any page.
  await page.goto("/pipeline");
  await page.getByRole("searchbox", { name: "Search companies, contacts and inquiries" }).fill("robotics");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/search\?q=robotics/);
  expect(await axe(page)).toEqual([]);
  await page.context().close();
});

test("CSV export: signed-in, same-origin POST only; contacts leave with details and are recorded; formulas become text", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  // A company whose name is a spreadsheet formula.
  await page.goto("/companies");
  await page.locator("#new-company-name").fill("=HYPERLINK(\"http://evil.invalid\",\"click\")");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page).toHaveURL(/\/companies\/[0-9a-f-]{36}/);

  const post = (kind: string, headers: Record<string, string> = { origin: ORIGIN }) => page.request.post(`/export/${kind}`, { headers, maxRedirects: 0 });
  const companies = await post("companies");
  expect(companies.status()).toBe(200);
  expect(companies.headers()["content-type"]).toContain("text/csv");
  expect(companies.headers()["content-disposition"]).toMatch(/attachment; filename="mintapp-companies-\d{4}-\d{2}-\d{2}\.csv"/);
  expect(companies.headers()["cache-control"]).toContain("no-store");
  const text = await companies.text();
  expect(text.startsWith("﻿id,name,website")).toBe(true);
  expect(text).toContain(`'=HYPERLINK`);
  expect(text).not.toMatch(/(^|,)=HYPERLINK/m);

  const inquiries = await (await post("inquiries")).text();
  expect(inquiries).toContain("Synthetic Clinic Group");
  expect(inquiries).not.toContain("clinic@example.com");
  expect(await (await post("prospects")).text()).not.toContain("dana-test");

  const contacts = await (await post("contacts")).text();
  expect(contacts).toContain("clinic@example.com");

  // Cross-site, missing-origin and GET requests are refused.
  expect((await post("contacts", { origin: "https://evil.invalid" })).status()).toBe(403);
  expect((await post("contacts", {})).status()).toBe(403);
  expect((await post("contacts", { origin: ORIGIN, "sec-fetch-site": "cross-site" })).status()).toBe(403);
  expect((await page.request.get("/export/contacts", { maxRedirects: 0 })).status()).toBe(405);
  expect((await post("everything")).status()).toBe(404);

  // Every export is on the trail, without its rows.
  await page.goto("/dashboard");
  await expect(page.getByRole("region", { name: "Recent activity" })).toContainText("exported data");
  await page.context().close();
});

test("Arabic: right-to-left throughout, nothing wider than the screen on a phone, no accessibility violations", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Switch the interface to Arabic" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("اللوحة");
  const paths = ["/dashboard", "/inquiries", `/inquiries/${CLINIC}`, `/inquiries/${CRAFTS}`, "/pipeline", "/outreach", "/companies", "/proposals", "/projects", "/metrics", "/search?q=مدرسة"];
  for (const path of paths) {
    await page.goto(path);
    await expect(page.locator("html"), path).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 }).first(), path).toBeVisible();
    expect(await axe(page), path).toEqual([]);
  }
  // Arabic labels for the new concepts.
  await page.goto(`/inquiries/${CRAFTS}`);
  await expect(panel(page, "stage")).toContainText("مرحلة المبيعات");
  await expect(panel(page, "proposal")).toContainText("العرض والنطاق");
  await page.goto("/pipeline");
  await expect(page.locator('[data-stage-column="won"]')).toContainText("تم الفوز");
  // Phone width.
  await page.setViewportSize({ width: 360, height: 780 });
  for (const path of paths) {
    await page.goto(path);
    expect(await overflow(page), path).toBe(0);
  }
  await page.getByRole("button", { name: "التبديل إلى الواجهة الإنجليزية" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await page.context().close();
});

test("English on a phone: no page is wider than the screen", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.setViewportSize({ width: 360, height: 780 });
  for (const path of ["/dashboard", "/inquiries", `/inquiries/${CLINIC}`, "/pipeline", "/outreach", "/companies", "/proposals", "/projects", "/metrics", "/search?q=clinic"]) {
    await page.goto(path);
    expect(await overflow(page), path).toBe(0);
  }
  await page.context().close();
});

test("keyboard: the skip link, the header search and a form can all be used without a mouse", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.goto("/companies");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  // Using the skip link moves to the main content.
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
  await page.locator("#company-q").fill("nile");
  await page.locator("#company-q").press("Enter");
  await expect(page).toHaveURL(/q=nile/);
  await expect(page.locator("[data-company]").first()).toBeVisible();
  await page.context().close();
});

test("unknown records show a not-found page inside the workspace", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  const missing = "99999999-0000-4000-8000-000000000009";
  for (const path of [`/companies/${missing}`, `/contacts/${missing}`, `/outreach/${missing}`, `/projects/${missing}`]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Admin" })).toBeVisible();
  }
  await page.context().close();
});

test("a forged cross-site form post changes nothing", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.goto(`/inquiries/${CRAFTS}`);
  const field = await panel(page, "stage").locator("form input[type=hidden]").evaluateAll((els) => els.map((e) => (e as HTMLInputElement).name).find((n) => n.startsWith("$ACTION_ID_")) ?? "");
  expect(field).not.toBe("");
  const forged = (origin: string) =>
    page.request.post(page.url(), { multipart: { [field]: "", inquiryId: CRAFTS, stage: "won", reason: "", note: "", pausedUntil: "" }, headers: { origin }, maxRedirects: 0 });
  const refused = await forged("https://evil.invalid");
  expect(refused.status()).not.toBe(303);
  await page.reload();
  await expect(page.locator("#stage-select")).toHaveValue("new");
  // The same post from the site itself is what the page's own form sends, and it works.
  const accepted = await forged(ORIGIN);
  expect([200, 303]).toContain(accepted.status());
  await page.reload();
  await expect(page.locator("#stage-select")).toHaveValue("won");
  await page.locator("#stage-select").selectOption("new");
  await page.getByRole("button", { name: "Update stage" }).click();
  await page.waitForURL(/n=stageChanged/);
  await expect(page.locator("#stage-select")).toHaveValue("new");
  await page.context().close();
});

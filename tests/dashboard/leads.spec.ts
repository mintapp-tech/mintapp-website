import { test, expect, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { DEMO_PORT } from "../../playwright.leads.config";
import { signInAs } from "./helpers";

// The corrected two-founder workflow, on the synthetic fixture
// (tests/fixtures/synthetic-inquiries.sql), signed in as both founders through the
// real sign-in path, with the mock generator standing in for any AI service.
const CLINIC = "11111111-0000-4000-8000-000000000001"; // en, web_app, not booked
const SCHOOL = "11111111-0000-4000-8000-000000000002"; // ar, website, booked by the fixture
const RESTAURANT = "11111111-0000-4000-8000-000000000003"; // en, no project type
const CRAFTS = "11111111-0000-4000-8000-000000000004"; // ar, not_sure
const OMAR = "omar.demo@mintapp.local";
const ADAM = "adam.demo@mintapp.local";
const ORIGIN = `http://localhost:${DEMO_PORT}`;
const SHOTS = "review-evidence/screens";

test.describe.configure({ mode: "serial" });
mkdirSync(SHOTS, { recursive: true });

const signIn = (browser: Browser, email: string): Promise<Page> => signInAs(browser, email, ORIGIN);
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const axe = async (page: Page) => (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
const notice = (page: Page) => page.locator("[data-notice]");
const artifact = (page: Page, name: string) => page.locator(`[data-artifact="${name}"]`);
// Screenshots for the report, once the page (not its loading skeleton) is there.
const shot = async (page: Page, name: string) => {
  await page.locator("main h1").first().waitFor();
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
};
const setLanguage = async (page: Page, to: "en" | "ar") => {
  await page.getByRole("button", { name: to === "ar" ? "Switch the interface to Arabic" : "التبديل إلى الواجهة الإنجليزية" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", to);
};

test("the new pages refuse without a signed-in session and say nothing", async ({ page, request }) => {
  for (const path of ["/leads", `/leads/${CLINIC}`, `/leads/${CLINIC}/pack`, `/leads/${CLINIC}/pack/design?v=1`, `/leads/${CLINIC}/deal`, `/leads/${CLINIC}/activity`, "/settings", "/settings/design-library", "/growth"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator("body")).not.toContainText("physiotherapy");
    const raw = await request.get(path, { maxRedirects: 0 });
    expect([302, 303, 307, 308]).toContain(raw.status());
  }
});

test("navigation: four primary sections and a restrained More menu; older addresses land in the new places", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  const nav = page.getByRole("navigation", { name: "Admin" });
  for (const name of ["Dashboard", "Leads & Clients", "Projects", "Growth"]) await expect(nav.getByRole("link", { name })).toBeVisible();
  for (const name of ["Inquiries", "Pipeline", "Companies", "Proposals", "Metrics", "Outreach"]) await expect(nav.getByRole("link", { name, exact: true })).toHaveCount(0);
  await nav.getByText("More").click();
  await expect(nav.getByRole("link", { name: "Settings" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Companies" })).toBeVisible();

  await page.goto("/inquiries");
  await expect(page).toHaveURL(/\/leads$/);
  await page.goto(`/inquiries/${CLINIC}`);
  await expect(page).toHaveURL(new RegExp(`/leads/${CLINIC}$`));
  await page.goto("/pipeline");
  await expect(page).toHaveURL(/\/leads$/);
  await page.goto("/proposals");
  await expect(page).toHaveURL(/\/leads\?stage=proposal$/);
  await page.context().close();
});

test("settings: the default reviewer is chosen once, and automation is described plainly", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.goto("/settings");
  await expect(page.locator("[data-automation]")).toHaveAttribute("data-automation", "mock");
  await page.locator("#default-owner-select").selectOption("adam");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(notice(page)).toContainText("Saved.");
  await expect(page.locator("#default-owner-select")).toHaveValue("adam");
  expect(await axe(page)).toEqual([]);
  await page.context().close();
});

test("design library: 11 patterns, 23 templates, and six synthetic examples drawn in both languages and on a phone", async ({ browser }) => {
  test.setTimeout(240_000);
  const page = await signIn(browser, OMAR);
  await page.goto("/settings");
  await page.getByRole("link", { name: "Design library" }).click();
  await expect(page).toHaveURL(/\/settings\/design-library$/);
  await expect(page.locator("[data-pattern-table] [data-pattern]")).toHaveCount(11);
  await expect(page.locator("[data-template-table] [data-template]")).toHaveCount(23);
  await expect(page.locator("[data-manual-cases] li")).toHaveCount(5);
  const examples = ["service-website", "marketplace", "operations-dashboard", "booking-application", "mobile-application", "arabic-website"];
  await expect(page.locator("[data-example]")).toHaveCount(examples.length);
  for (const id of examples) {
    await page.goto(`/settings/design-library?example=${id}`);
    await expect(page.locator(`[data-example="${id}"]`)).toHaveAttribute("aria-current", "page");
    const screens = await page.locator("[data-design-preview] [data-screen]").count();
    expect(screens, id).toBeGreaterThanOrEqual(2);
    expect(screens, id).toBeLessThanOrEqual(4);
    expect(await axe(page), id).toEqual([]);
    await shot(page, `library-${id}-en-desktop`);
  }
  // The Arabic example is drawn right to left inside its frames.
  await expect(page.locator("[data-design-preview] [dir=rtl]").first()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const id of ["mobile-application", "arabic-website", "operations-dashboard"]) {
    await page.goto(`/settings/design-library?example=${id}`);
    expect(await overflow(page), id).toBeLessThanOrEqual(0);
    await shot(page, `library-${id}-en-phone`);
  }
  await setLanguage(page, "ar");
  await page.goto("/settings/design-library?example=marketplace");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("مكتبة التصميم");
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  expect(await axe(page)).toEqual([]);
  await shot(page, "library-marketplace-ar-phone");
  await setLanguage(page, "en");
  await page.context().close();
});

test("Leads & Clients: one row per lead with meeting, pack, position, owner and next action, and no contact details", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.goto("/leads");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Leads & Clients");
  const rows = page.locator("[data-lead]");
  await expect(rows).toHaveCount(4);
  await expect(page.locator("[data-leads]")).not.toContainText("@example.com");
  // Not booked: the pack waits for the booking. Booked: the review action exists, with the default reviewer.
  const clinic = page.locator(`[data-lead="${CLINIC}"]`);
  await expect(clinic.locator("[data-pack-state]")).toHaveText("Waiting for booking");
  await expect(clinic.locator("[data-position]")).toHaveText("New");
  const school = page.locator(`[data-lead="${SCHOOL}"]`);
  await expect(school.locator("[data-next-action]")).toContainText("Review and approve the pre-meeting pack");
  // Filters: the Meeting step holds the booked school only after it is moved there; Paused is a flag.
  await page.locator("#lead-paused").selectOption("yes");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.locator("[data-lead]")).toHaveCount(0);
  await expect(page.getByText("No leads match these filters.")).toBeVisible();
  await page.getByRole("link", { name: "Clear" }).click();
  await expect(rows).toHaveCount(4);
  expect(await axe(page)).toEqual([]);
  await shot(page, "leads-en-desktop");
  await page.context().close();
});

test("overview: client, idea, budget, timeline and link; seven-step position; priority; pause with a date; advanced collapsed", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.goto(`/leads/${CLINIC}`);
  await expect(page.getByRole("navigation", { name: "Lead sections" }).getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  await expect(page.locator("[data-budget]")).toHaveText("Not sure yet");
  await expect(page.locator("[data-timeline]")).toHaveText("Within 3 months");
  await expect(page.locator("[data-existing-link]")).toHaveText("https://www.nile-physio.example/en");
  await expect(page.getByText("It is never opened or crawled automatically.")).toBeVisible();
  // Contact details and the advanced area are collapsed.
  await expect(page.locator("[data-contact]")).not.toHaveAttribute("open", "");
  await expect(page.locator("[data-advanced]")).not.toHaveAttribute("open", "");
  await expect(page.getByText("clinic@example.com")).toBeHidden();
  await expect(page.locator("#src-score-trigger")).toBeHidden();

  const position = page.locator("#position-select");
  await expect(position.locator("option")).toHaveCount(8);
  await position.selectOption("qualified");
  await page.getByRole("button", { name: "Save position" }).click();
  await expect(notice(page)).toContainText("The stage was updated.");
  await expect(page.locator("header [data-position]")).toHaveText("Qualified");
  await page.locator("#position-select").selectOption("lost");
  await page.getByRole("button", { name: "Save position" }).click();
  await expect(notice(page)).toContainText("Choose why the deal was lost.");
  await expect(page.locator("header [data-position]")).toHaveText("Qualified");

  await page.locator("#priority-select").selectOption("high");
  await page.getByRole("button", { name: "Save priority" }).click();
  await expect(page.locator("header [data-priority]")).toHaveText("High");

  const until = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
  await page.locator("#pause-until").fill(until);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(notice(page)).toContainText("The lead is paused.");
  await expect(page.locator("header [data-paused]")).toHaveAttribute("data-paused", until);
  // Pausing never changes the position.
  await expect(page.locator("header [data-position]")).toHaveText("Qualified");
  await page.goto("/leads?paused=yes");
  await expect(page.locator("[data-lead]")).toHaveCount(1);
  await page.goto(`/leads/${CLINIC}`);
  await page.getByRole("button", { name: "Resume now" }).click();
  await expect(notice(page)).toContainText("The lead is active again.");
  await expect(page.locator("header [data-paused]")).toHaveCount(0);

  // The optional score stays available in Advanced.
  await page.locator("[data-advanced] > summary").click();
  await expect(page.locator("#src-score-trigger")).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await shot(page, "lead-overview-en-desktop");
  await page.context().close();
});

test("booking automation: a booking creates the dated review action, a reschedule moves it, a cancellation keeps all work", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.goto(`/leads/${CRAFTS}/pack`);
  await expect(page.locator("[data-pack-state]").first()).toHaveText("Waiting for booking");
  await page.getByRole("button", { name: "Simulate booking" }).click();
  // The meeting is three days out: the review is due the day before, for the default reviewer (Adam).
  const due = (days: number) => new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", day: "numeric", month: "short", year: "numeric" }).format(new Date(Date.now() + days * 86_400_000));
  await expect(page.locator("[data-review-action]")).toContainText(`Review: Adam, by ${due(2)}`);
  await page.getByRole("button", { name: "Simulate reschedule" }).click();
  await expect(page.locator("[data-review-action]")).toContainText(`Review: Adam, by ${due(4)}`);
  // Prepare (the mock generator), then cancel: every version stays, the action closes.
  await page.getByRole("button", { name: "Run mock generator" }).click();
  await expect(artifact(page, "design").locator("[data-version]")).toBeVisible();
  await page.getByRole("button", { name: "Simulate cancellation" }).click();
  await expect(page.locator("[data-review-action]")).toHaveCount(0);
  for (const name of ["design", "proposal", "discovery"]) await expect(artifact(page, name).locator("[data-version]")).toBeVisible();
  await page.goto(`/leads/${CRAFTS}`);
  await expect(page.locator("[data-meeting]")).toHaveAttribute("data-meeting", "cancelled");
  await page.context().close();
});

test("Prepare now, then three artifacts reviewed separately: the proposal is labelled, the design drawn, the writer cannot approve", async ({ browser }) => {
  const omar = await signIn(browser, OMAR);
  await omar.goto(`/leads/${CLINIC}/pack`);
  await expect(omar.locator("[data-pack-explanation]")).toContainText("once the client books a meeting");
  await omar.getByRole("button", { name: "Prepare now" }).click();
  await expect(notice(omar)).toContainText("Preparation ran.");
  await expect(omar.locator("#pack-state [data-pack-state]")).toHaveText("Ready for review");
  for (const name of ["design", "proposal", "discovery"]) await expect(artifact(omar, name).locator("[data-source]")).toHaveText("Automated (test generator)");
  await expect(artifact(omar, "proposal").locator("[data-proposal-label]")).toHaveText("Initial draft for discussion — not a final quote or commitment.");
  await expect(artifact(omar, "discovery")).toContainText("Questions to ask");
  // The sanitised input is inspectable (the mock generator sends nothing anywhere).
  await expect(omar.locator("[data-audit]")).toBeVisible();

  // The design preview: library templates in device frames, two to four screens, a user flow.
  await artifact(omar, "design").getByRole("link", { name: "Open the design preview" }).click();
  await expect(omar.locator("[data-design-preview]")).toBeVisible();
  const screens = await omar.locator("[data-design-preview] [data-screen]").count();
  expect(screens).toBeGreaterThanOrEqual(2);
  expect(screens).toBeLessThanOrEqual(4);
  await expect(omar.locator("[data-user-flow]")).toBeVisible();
  await expect(omar.getByText("Not a final design; images are placeholders.")).toBeVisible();
  expect(await axe(omar)).toEqual([]);
  await shot(omar, "design-preview-en-desktop");
  await omar.emulateMedia({ reducedMotion: "reduce" });
  await omar.setViewportSize({ width: 390, height: 844 });
  expect(await overflow(omar)).toBeLessThanOrEqual(0);
  await shot(omar, "design-preview-en-phone");
  await omar.setViewportSize({ width: 1280, height: 900 });

  // Omar rewrites the proposal by hand: a new version he cannot approve himself.
  await omar.goto(`/leads/${CLINIC}/pack`);
  const proposal = artifact(omar, "proposal");
  await proposal.getByText("Edit as text").click();
  await proposal.locator("textarea").fill("Our understanding\nA booking system for three clinics.\n\nNext step\nAgree the first release in the meeting.");
  await proposal.getByRole("button", { name: "Save as a new version" }).click();
  await expect(notice(omar)).toContainText("saved as a new version");
  await expect(artifact(omar, "proposal").locator("[data-source]")).toHaveText("Edited by hand");
  await expect(artifact(omar, "proposal").locator("[data-history]")).toBeAttached();
  for (const name of ["design", "proposal", "discovery"]) {
    await artifact(omar, name).getByRole("button", { name: "Ready for review" }).click();
    await expect(notice(omar)).toContainText("The review status was updated.");
  }
  await expect(artifact(omar, "proposal").locator("[data-waiting-for-teammate]")).toBeVisible();
  // Automated versions may be approved by either founder.
  for (const name of ["design", "discovery"]) {
    await artifact(omar, name).getByRole("button", { name: "Approve for the meeting" }).click();
    await expect(artifact(omar, name).locator("[data-review]")).toHaveAttribute("data-review", "approved");
  }

  const adam = await signIn(browser, ADAM);
  await adam.goto(`/leads/${CLINIC}/pack`);
  await artifact(adam, "proposal").getByRole("button", { name: "Approve for the meeting" }).click();
  await expect(artifact(adam, "proposal").locator("[data-review]")).toHaveAttribute("data-review", "approved");
  await expect(adam.locator("#pack-state [data-pack-state]")).toHaveText("Approved for meeting");
  expect(await axe(adam)).toEqual([]);
  await shot(adam, "lead-pack-en-desktop");
  await omar.context().close();
  await adam.context().close();
});

test("the manual Claude path: the prompt carries no contact details, and a pasted reply is checked before anything is saved", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.goto(`/leads/${RESTAURANT}/pack`);
  const prompt = await page.locator("[data-manual-prompt]").textContent();
  expect(prompt).toContain("An app for my restaurant.");
  expect(prompt).not.toContain("food@example.com");
  expect(prompt).not.toContain("Synthetic Restaurant");
  await page.locator("#paste-pack").fill("Sure! Here is the pack you asked for.");
  await page.getByRole("button", { name: "Check and save the pack" }).click();
  await expect(notice(page)).toContainText("That is not a JSON object.");
  await page.locator("#paste-pack").fill(JSON.stringify({ language: "en", client_facts: [{ text: "They have ten restaurants", evidence: "ten restaurants across Cairo" }] }));
  await page.getByRole("button", { name: "Check and save the pack" }).click();
  await expect(notice(page)).toContainText("The pack was not saved");
  await expect(page.locator("[data-pack-problems]")).toContainText("The reply does not have the required structure.");
  await expect(artifact(page, "design").locator("[data-version]")).toHaveCount(0);
  await page.context().close();
});

test("deal: the contract is recorded by hand, a signed contract needs its date, and the final proposal lives here", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.goto(`/leads/${CLINIC}/deal`);
  await expect(page.locator('section[aria-labelledby="proposal"]')).toBeVisible();
  await page.locator("#contract-status").selectOption("signed");
  await page.getByRole("button", { name: "Save the deal" }).click();
  await expect(notice(page)).toContainText("Add the date the contract was signed.");
  await page.locator("#contract-status").selectOption("signed");
  await page.locator("#contract-signed").fill("2026-10-01");
  await page.locator("#contract-reference").fill("MA-2026-014");
  await page.getByRole("button", { name: "Save the deal" }).click();
  await expect(notice(page)).toContainText("Saved.");
  await expect(page.locator("[data-contract]")).toHaveText("Signed");
  await page.goto(`/leads/${CLINIC}/activity`);
  await expect(page.locator("[data-activity]")).toContainText("updated the contract status");
  expect(await axe(page)).toEqual([]);
  await page.context().close();
});

test("Arabic: the whole lead experience reads right to left, on a phone, without sideways scrolling", async ({ browser }) => {
  const page = await signIn(browser, ADAM);
  await page.goto("/leads");
  await setLanguage(page, "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("العملاء والفرص");
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/leads", `/leads/${SCHOOL}`, `/leads/${SCHOOL}/pack`, `/leads/${SCHOOL}/deal`, `/leads/${SCHOOL}/activity`, "/settings"]) {
    await page.goto(path);
    expect(await overflow(page), path).toBeLessThanOrEqual(0);
    expect(await axe(page), path).toEqual([]);
  }
  await page.goto(`/leads/${SCHOOL}/pack`);
  await expect(page.locator("[data-review-action]")).toBeVisible();
  await shot(page, "lead-pack-ar-phone");
  await page.goto(`/leads/${SCHOOL}`);
  await shot(page, "lead-overview-ar-phone");
  await page.goto("/leads");
  await shot(page, "leads-ar-phone");
  await setLanguage(page, "en");
  await page.context().close();
});

test("English on a phone: the list, a lead and its pack fit the screen", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/leads", `/leads/${CLINIC}`, `/leads/${CLINIC}/pack`, `/leads/${CLINIC}/deal`]) {
    await page.goto(path);
    expect(await overflow(page), path).toBeLessThanOrEqual(0);
  }
  await shot(page, "lead-deal-en-phone");
  await page.context().close();
});

test("the dashboard is a command centre: alerts, actions with one owner each, meetings with their links; no KPI grid, no technical words", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dashboard");
  await expect(page.locator("[data-summary]")).toHaveCount(0);
  // The school's review action was created before a default reviewer existed: it needs an owner.
  await expect(page.locator('[data-alert="unowned"]')).toContainText("مدرسة تجريبية");
  // The booked school is an upcoming meeting, with its Cal.com manage link.
  const meeting = page.locator(`[data-meeting-row="${SCHOOL}"]`);
  await expect(meeting).toBeVisible();
  await expect(meeting.locator("[data-manage-link]")).toHaveAttribute("href", "https://cal.com/booking/synthetic-seed-booking");
  // Meetings, preparation and client work are labelled differently.
  await expect(page.locator('[data-action-kind="pack_review"]').first()).toContainText("Preparation");
  // Plain language only.
  const text = (await page.locator("main").textContent()) ?? "";
  for (const word of ["waiting_booking", "retry_scheduled", "queued", "codecraft_", "lead_status"]) expect(text).not.toContain(word);
  expect(await axe(page)).toEqual([]);
  await shot(page, "dashboard-en-desktop");
  // Taking the unowned review clears the alert.
  await page.locator('[data-alert="unowned"] a').first().click();
  await page.locator("[data-follow-up] select").first().selectOption("omar");
  await page.locator("[data-follow-up]").first().getByRole("button", { name: "Save" }).click();
  await expect(notice(page)).toContainText("Saved.");
  await page.goto("/dashboard");
  await expect(page.locator('[data-alert="unowned"]')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  await shot(page, "dashboard-en-phone");
  await page.context().close();
});

test("Growth: six fields add a prospect; research is optional and collapsed; numbers are current and entered by hand", async ({ browser }) => {
  const page = await signIn(browser, ADAM);
  await page.goto("/growth");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Growth");
  await expect(page.locator("[data-growth-numbers]")).toBeVisible();
  await expect(page.getByText("No social platform is connected.")).toBeVisible();
  await expect(page.locator("[data-research]")).not.toHaveAttribute("open", "");
  await page.locator("#qp-company").fill("Synthetic Logistics Co");
  await page.locator("#qp-contact").fill("https://www.linkedin.com/in/synthetic-ops-lead");
  await page.locator("#qp-reason").fill("Opened a second warehouse and is hiring dispatchers");
  await page.locator("#qp-owner").selectOption("adam");
  await page.locator("#qp-priority").selectOption("high");
  await page.locator("#qp-action").fill("Send a short note about dispatch scheduling");
  await page.locator("#qp-due").fill(new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Add prospect" }).click();
  await expect(notice(page)).toContainText("Created.");
  const row = page.locator("[data-prospect]", { hasText: "Synthetic Logistics Co" });
  await expect(row.locator("[data-priority]")).toHaveText("High");
  await expect(row.locator("[data-next-action]")).toContainText("Send a short note about dispatch scheduling");
  await expect(row).toContainText("Opened a second warehouse");
  // The contact link stays on the prospect's own page, not the list.
  await expect(page.locator("[data-prospects]")).not.toContainText("linkedin.com");
  // Missing the next action date is refused and nothing is created.
  await page.locator("#qp-company").fill("Half-filled Co");
  await page.locator("#qp-reason").fill("A reason");
  await page.locator("#qp-owner").selectOption("adam");
  await page.locator("#qp-action").fill("Something");
  await page.locator("#qp-due").evaluate((el: HTMLInputElement) => el.removeAttribute("required"));
  await page.getByRole("button", { name: "Add prospect" }).click();
  await expect(notice(page)).toContainText("not valid");
  await expect(page.locator("[data-prospect]", { hasText: "Half-filled Co" })).toHaveCount(0);
  // Priority can be changed on the prospect's page, which sits under Growth.
  await row.getByRole("link").first().click();
  await expect(page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Growth" })).toHaveAttribute("aria-current", "page");
  await page.locator("#prospect-priority").selectOption("low");
  await page.locator("#priority").getByRole("button", { name: "Save" }).click();
  await expect(page.locator("header [data-priority]")).toHaveText("Low");
  await page.goto("/growth");
  expect(await axe(page)).toEqual([]);
  await shot(page, "growth-en-desktop");
  await page.context().close();
});

test("Arabic: the command centre and Growth read right to left on a phone", async ({ browser }) => {
  const page = await signIn(browser, ADAM);
  await page.goto("/dashboard");
  await setLanguage(page, "ar");
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/dashboard", "/growth", "/projects"]) {
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    expect(await overflow(page), path).toBeLessThanOrEqual(0);
    expect(await axe(page), path).toEqual([]);
  }
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("اللوحة");
  await shot(page, "dashboard-ar-phone");
  await page.goto("/growth");
  await shot(page, "growth-ar-phone");
  await setLanguage(page, "en");
  await page.context().close();
});

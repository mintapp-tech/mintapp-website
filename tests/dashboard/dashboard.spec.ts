import { test, expect, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { DEMO_PORT } from "../../playwright.dashboard.config";
import { signInAs } from "./helpers";

// The lead workflow with automated preparation OFF (the default): every pack is
// prepared by hand or with the simulated generator. Synthetic fixture data
// (tests/fixtures/synthetic-inquiries.sql), loaded by scripts/admin-local.mjs.
const CLINIC = "11111111-0000-4000-8000-000000000001";
const SCHOOL = "11111111-0000-4000-8000-000000000002";
const RESTAURANT = "11111111-0000-4000-8000-000000000003";
const CRAFTS = "11111111-0000-4000-8000-000000000004";
const OMAR = "omar.demo@mintapp.local";
const ADAM = "adam.demo@mintapp.local";

test.describe.configure({ mode: "serial" });

const signIn = async (browser: Browser, email: string): Promise<Page> => {
  const page = await signInAs(browser, email, `http://localhost:${DEMO_PORT}`);
  await page.goto("/leads");
  return page;
};
const axe = async (page: Page) => (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations.map((v) => v.id);
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const row = (page: Page, id: string) => page.locator(`[data-lead="${id}"]`);
const artifact = (page: Page, name: string) => page.locator(`[data-artifact="${name}"]`);

// Clicks a form button and waits until the refreshed page has finished streaming.
async function submit(page: Page, name: string, scope?: ReturnType<Page["locator"]>) {
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined),
    (scope ?? page).getByRole("button", { name, exact: true }).click(),
  ]);
  await response.finished();
}

test("lead data is never served without a valid team session", async ({ page, request }) => {
  for (const path of ["/leads", `/leads/${CLINIC}`, `/leads/${CLINIC}/pack`, "/inquiries", `/inquiries/${CLINIC}`]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator("body")).not.toContainText("physiotherapy");
    const raw = await request.get(path, { maxRedirects: 0 });
    expect([302, 303, 307, 308]).toContain(raw.status());
    expect(await raw.text()).not.toContain("physiotherapy");
  }
});

test("a wrong password is refused with a generic message", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(OMAR);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator('p[role="alert"]')).toHaveText("That email and password do not match a Mintapp team account.");
  await page.goto("/leads");
  await expect(page).toHaveURL(/\/login$/);
});

test("list: all synthetic leads, Arabic intact, and with automation off a booked meeting needs a person", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await expect(page.locator("[data-lead]")).toHaveCount(4);
  await expect(page.locator("[data-leads]")).toContainText("منصة حرفيين تجريبية");
  await expect(page.locator("[data-position]")).toHaveText(["New", "New", "New", "New"]);
  // Not booked: waiting for the booking. Booked, with automation off: a person has to prepare it.
  await expect(row(page, CLINIC).locator("[data-pack-state]")).toHaveText("Waiting for booking");
  await expect(row(page, SCHOOL).locator("[data-pack-state]")).toHaveText("Needs manual action");
  await expect(row(page, SCHOOL).locator("[data-meeting]")).toHaveAttribute("data-meeting", "booked");
  // No client email anywhere in the routine list.
  expect(await page.locator("body").innerText()).not.toMatch(/@example\.com|@mintapp\.local/);
  expect(await axe(page)).toEqual([]);
});

test("project type: only what the client chose is shown, everything else is Not provided (English)", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await expect(row(page, CLINIC)).toContainText("Web application");
  await expect(row(page, SCHOOL)).toContainText("Website");
  await expect(row(page, CRAFTS)).toContainText("Not sure yet");
  await expect(row(page, RESTAURANT)).toContainText("Not provided");
  await expect(page.locator("[data-leads]")).not.toContainText(/Other/);

  await page.goto(`/leads/${RESTAURANT}`);
  await expect(page.locator('[data-brief="provided"]')).toContainText("Project typeNot provided");
  await expect(page.locator('[data-brief="provided"]')).toContainText("BudgetNot provided");
  await expect(page.locator('[data-brief="provided"]')).not.toContainText(/Other/);
  await page.goto(`/leads/${CRAFTS}`);
  await expect(page.locator('[data-brief="provided"]')).toContainText("Project typeNot sure yet");
});

test("project type in Arabic: the form's own words, and Not provided for no choice", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.getByRole("button", { name: "Switch the interface to Arabic" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(row(page, CLINIC)).toContainText("تطبيق ويب");
  await expect(row(page, SCHOOL)).toContainText("موقع إلكتروني");
  await expect(row(page, CRAFTS)).toContainText("لست متأكدًا بعد");
  await expect(row(page, RESTAURANT)).toContainText("غير مذكور");
  await expect(page.locator("[data-leads]")).not.toContainText("أخرى");
  await page.goto(`/leads/${CRAFTS}`);
  await expect(page.locator('[data-brief="provided"]')).toContainText("نوع المشروعلست متأكدًا بعد");
  expect(await axe(page)).toEqual([]);
  await page.getByRole("button", { name: "التبديل إلى الواجهة الإنجليزية" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("every width from a small phone to a wide screen fits, in both languages", async ({ browser }) => {
  test.setTimeout(240_000);
  const page = await signIn(browser, OMAR);
  for (const language of ["en", "ar"] as const) {
    if (language === "ar") await page.getByRole("button", { name: "Switch the interface to Arabic" }).click();
    for (const width of [360, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ["/leads", `/leads/${CLINIC}`, `/leads/${CRAFTS}/pack`]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        expect(await overflow(page), `${language} ${path} at ${width}px`).toBeLessThanOrEqual(0);
      }
    }
  }
  await page.context().close();
});

test("an unknown lead shows a not-found page inside the workspace", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.goto("/leads/99999999-0000-4000-8000-000000000000");
  await expect(page.getByRole("heading", { name: "Lead not found" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
  await page.getByRole("link", { name: "Back to Leads & Clients" }).click();
  await expect(page).toHaveURL(/\/leads$/);
});

test("a lead with no booking is prepared by the simulated generator, made ready by one founder and approved by the other", async ({ browser }) => {
  const omar = await signIn(browser, OMAR);
  await omar.goto(`/leads/${RESTAURANT}/pack`);
  await omar.getByRole("button", { name: "Run mock generator" }).click();
  for (const name of ["design", "proposal", "discovery"]) {
    await expect(artifact(omar, name).locator("[data-source]")).toHaveText("Automated (test generator)");
    await expect(artifact(omar, name)).toContainText("[MOCK]");
    await submit(omar, "Ready for review", artifact(omar, name));
  }
  const adam = await signIn(browser, ADAM);
  await adam.goto(`/leads/${RESTAURANT}/pack`);
  for (const name of ["design", "proposal", "discovery"]) await submit(adam, "Approve for the meeting", artifact(adam, name));
  await expect(artifact(adam, "design").getByText("Last review change by Adam")).toBeVisible();
  // No project type, so no library pattern fits: the design falls back to a person.
  await expect(adam.locator("#pack-state [data-pack-state]")).toHaveText("Needs manual action");
  await expect(adam.locator("[data-pack-explanation]")).toContainText("No pattern in the design library fits");
  const design = artifact(adam, "design");
  await design.getByText("Edit as text").click();
  await design.locator("textarea").first().fill("User flow\n- Screen 1: the menu\n- Screen 2: the order\n\nScreen 1: Menu\nDishes with photos (placeholders) and prices from the restaurant.");
  await submit(adam, "Save as a new version", design);
  await submit(adam, "Ready for review", artifact(adam, "design"));
  await omar.goto(`/leads/${RESTAURANT}/pack`);
  await submit(omar, "Approve for the meeting", artifact(omar, "design"));
  await expect(omar.locator("#pack-state [data-pack-state]")).toHaveText("Approved for meeting");
});

test("manual path: copy a prompt without contact details, write by hand, and figures the client never stated are flagged", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.goto(`/leads/${CLINIC}`);
  await expect(page.locator('[data-brief="provided"]')).toContainText("BudgetNot sure yet");
  await expect(page.locator('[data-brief="provided"]')).toContainText("Project typeWeb application");
  await page.goto(`/leads/${CLINIC}/pack`);
  await page.getByRole("button", { name: "Copy the prompt" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("three physiotherapy clinics");
  expect(copied).not.toMatch(/clinic@example\.com|Synthetic Clinic Group|Nile Physio|nile-physio/);

  const proposal = artifact(page, "proposal");
  await proposal.getByText("Edit", { exact: true }).click();
  await proposal.locator("textarea").fill("Our understanding\nThree clinics want online booking.\n\nNext step\nPropose a $4,000 first phase.");
  await submit(page, "Save as a new version", proposal);
  await expect(artifact(page, "proposal").locator("[data-source]")).toHaveText("Written by hand");
  await expect(artifact(page, "proposal")).toContainText("the client did not state them: 4000");
  // Only part of the pack exists: it says so in plain words.
  await expect(page.locator("#pack-state [data-pack-state]")).toHaveText("Needs manual action");
  await expect(page.locator("[data-pack-explanation]")).toContainText("Only part of the pack exists.");
});

test("founder approval: the writer cannot approve their own version, even with a forged request; the other founder can", async ({ browser }) => {
  // Continues from the manual path: Omar wrote the clinic's draft proposal.
  const omar = await signIn(browser, OMAR);
  await omar.goto(`/leads/${CLINIC}/pack`);
  const proposal = artifact(omar, "proposal");
  await submit(omar, "Ready for review", proposal);
  await expect(proposal.locator('[data-review="in_review"]')).toBeVisible();
  await expect(proposal.locator("[data-waiting-for-teammate]")).toContainText("Waiting for the other founder");
  await expect(proposal.getByRole("button", { name: "Approve for the meeting" })).toHaveCount(0);

  // A forged request: reuse the real "Send back to draft" form (same server action) but ask for "approved".
  const forged = proposal.getByRole("button", { name: "Send back to draft" }).locator("xpath=ancestor::form");
  await forged.evaluate((form) => {
    (form.querySelector('input[name="to"]') as HTMLInputElement).value = "approved";
  });
  const [answer] = await Promise.all([omar.waitForResponse((r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined), forged.evaluate((form) => (form as HTMLFormElement).requestSubmit())]);
  await answer.finished();
  await omar.goto(`/leads/${CLINIC}/pack`);
  await expect(artifact(omar, "proposal").locator('[data-review="in_review"]')).toBeVisible();

  const adam = await signIn(browser, ADAM);
  await adam.goto(`/leads/${CLINIC}/pack`);
  await expect(artifact(adam, "proposal").locator("[data-waiting-for-teammate]")).toHaveCount(0);
  await submit(adam, "Approve for the meeting", artifact(adam, "proposal"));
  await expect(artifact(adam, "proposal").locator('[data-review="approved"]')).toHaveText("Approved for meeting");
});

test("booking, reschedule, generator failure, quota pause, manual recovery and cancellation keep everything", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.goto(`/leads/${CRAFTS}`);
  await expect(page.locator('[data-brief="description"]')).toContainText("الحرفيين");
  await page.locator("#note").fill("ملاحظة: العميل يفضّل الموبايل");
  await submit(page, "Add note");
  await expect(page.locator("[data-notes]")).toContainText("ملاحظة: العميل يفضّل الموبايل");

  await page.goto(`/leads/${CRAFTS}/pack`);
  await submit(page, "Simulate booking");
  await expect(page.locator("[data-review-action]")).toBeVisible();
  await submit(page, "Simulate reschedule");
  await submit(page, "Simulate generator failure");
  await expect(page.locator("#pack-state [data-pack-state]")).toHaveText("Needs manual action");
  await expect(page.locator("[data-pack-explanation]")).toContainText("did not produce a usable pack");

  await submit(page, "Simulate quota exhausted");
  await expect(page.locator("[data-pack-explanation]")).toContainText("Nothing is charged");
  await submit(page, "Resume automation (mock)");
  await expect(page.getByRole("button", { name: /Resume automation/ })).toHaveCount(0);

  await submit(page, "Prepare by hand instead");
  for (const name of ["design", "proposal", "discovery"]) {
    const part = artifact(page, name);
    await part.locator("summary").first().click();
    await part.locator("textarea").first().fill(`ملاحظات ${name}: منصة تربط الحرفيين بالعملاء.`);
    await submit(page, "Save as a new version", part);
    await submit(page, "Ready for review", artifact(page, name));
  }
  await expect(page.locator("[data-waiting-for-teammate]")).toHaveCount(3);
  const adam = await signIn(browser, ADAM);
  await adam.goto(`/leads/${CRAFTS}/pack`);
  for (const name of ["design", "proposal", "discovery"]) await submit(adam, "Approve for the meeting", artifact(adam, name));
  await expect(adam.locator("#pack-state [data-pack-state]")).toHaveText("Approved for meeting");

  await page.reload();
  await submit(page, "Simulate cancellation");
  await expect(page.locator("[data-review-action]")).toHaveCount(0);
  await expect(page.locator("#pack-state [data-pack-state]")).toHaveText("Approved for meeting");
  await expect(artifact(page, "design")).toContainText("الحرفيين");
  await page.goto(`/leads/${CRAFTS}`);
  await expect(page.locator("[data-meeting]")).toHaveAttribute("data-meeting", "cancelled");
  await expect(page.locator("[data-notes]")).toContainText("العميل يفضّل الموبايل");
  expect(await axe(page)).toEqual([]);
});

test("shared ownership and next actions: names only, one responsible founder and a date each", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.goto(`/leads/${CLINIC}`);
  const choices = await page.locator("#owner-select option").allTextContents();
  expect(choices).toEqual(["Unassigned", "Omar", "Adam", "Omar & Adam"]);
  await page.locator("#owner-select").selectOption({ label: "Omar & Adam" });
  await submit(page, "Save owner");
  await expect(page.locator("[data-owners]")).toHaveText("Omar & Adam");

  // The form will not send without a responsible founder and a date.
  await page.locator("#follow-up-action").fill("Send the meeting questions");
  await page.getByRole("button", { name: "Add follow-up" }).click();
  await expect(page.locator("[data-follow-up]")).toHaveCount(0);
  await page.locator("#follow-up-owner").selectOption({ label: "Adam" });
  await page.locator("#follow-up-due").fill(new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10));
  await submit(page, "Add follow-up");
  const item = page.locator('[data-follow-up="Send the meeting questions"]');
  await expect(item).toContainText("Adam");

  await page.goto("/leads");
  await expect(row(page, CLINIC).locator("[data-owners]")).toHaveText("Omar & Adam");
  await expect(row(page, CLINIC).locator("[data-next-action]")).toContainText("Send the meeting questions");
  await expect(row(page, CLINIC).locator("[data-next-action]")).toContainText("Adam");
  expect(await page.locator("body").innerText()).not.toContain("mintapp.local");

  await page.goto(`/leads/${CLINIC}`);
  expect(await page.locator("body").innerText()).not.toContain("mintapp.local");
  await submit(page, "Mark done", page.locator('[data-follow-up="Send the meeting questions"]'));
  await expect(page.locator('[data-follow-up="Send the meeting questions"]')).toHaveCount(0);
  await expect(page.getByText("Completed (1)")).toBeVisible();

  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto(`/leads/${CLINIC}`);
  await expect(page).toHaveURL(/\/login$/);
});

test("an overdue action shows on the list, the lead and the dashboard, and completing it clears them", async ({ browser }) => {
  const page = await signIn(browser, OMAR);
  await page.goto(`/leads/${RESTAURANT}`);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  await page.locator("#follow-up-action").fill("Call the restaurant owner");
  await page.locator("#follow-up-owner").selectOption({ label: "Omar" });
  await page.locator("#follow-up-due").evaluate((input) => input.removeAttribute("min"));
  await page.locator("#follow-up-due").fill(yesterday);
  await submit(page, "Add follow-up");
  await expect(page.locator('[data-follow-up="Call the restaurant owner"]')).toContainText("Overdue");

  await page.goto("/leads");
  await expect(row(page, RESTAURANT).locator("[data-next-action]")).toContainText("Overdue");
  await page.goto("/dashboard");
  const overdue = page.locator('[data-group="overdue"]');
  await expect(overdue).toContainText("Call the restaurant owner");
  await expect(overdue).toContainText("Omar");

  await page.getByRole("button", { name: "Switch the interface to Arabic" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator('[data-group="overdue"]')).toContainText("متأخرة");
  await page.getByRole("button", { name: "التبديل إلى الواجهة الإنجليزية" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.goto(`/leads/${RESTAURANT}`);
  await submit(page, "Mark done", page.locator('[data-follow-up="Call the restaurant owner"]'));
  await page.goto("/dashboard");
  await expect(page.locator('[data-group="overdue"]')).toHaveCount(0);
});

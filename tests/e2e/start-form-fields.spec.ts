import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { installTurnstileMock, mockInquiriesRoute } from "./turnstile-mock";

// Budget, expected timeline and the existing-link field, and the sensitive-data note,
// in English and Arabic, on a phone and a desktop. Turnstile is mocked and
// /api/inquiries is intercepted: nothing reaches a real backend, and the page must
// not request anything from another origin because of these fields.

const COPY = {
  en: { budget: "Estimated budget", budgetHelp: "In US dollars, or the equivalent in your currency.", timeline: "Expected timeline", link: "Existing website or app", note: "Before describing your project", desc: "Project description", notSure: "Not sure yet", badUrl: "Enter a public website address" },
  ar: { budget: "الميزانية التقديرية", budgetHelp: "بالدولار الأمريكي، أو ما يعادله بعملتك.", timeline: "المدة المتوقعة", link: "الموقع أو التطبيق الحالي", note: "قبل وصف مشروعك", desc: "وصف المشروع", notSure: "لست متأكدًا بعد", badUrl: "أدخل عنوان موقع عام" },
} as const;

async function fillRequired(page: Page) {
  const textInputs = page.locator('form input:not([type="checkbox"]):not([type="radio"]):not([tabindex="-1"])');
  await textInputs.nth(0).fill("Test User");
  await textInputs.nth(2).fill("test@example.com");
  await page.locator('label:has(input[name="projectType"][value="web_app"])').click();
  await page.locator("form textarea").first().fill("A booking system for three clinics, for patients and receptionists.");
  await page.locator('input[type="checkbox"]').check();
}

for (const viewport of [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 900 },
]) {
  for (const locale of ["en", "ar"] as const) {
    test.describe(`${locale} on a ${viewport.name}`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });
      const c = COPY[locale];

      test("budget and timeline are required choices that include Not sure yet; the link is optional", async ({ page }) => {
        await installTurnstileMock(page);
        await page.goto(`/${locale}/start`);
        const budget = page.getByLabel(c.budget);
        const timeline = page.getByLabel(c.timeline);
        await expect(budget).toHaveAttribute("required", "");
        await expect(timeline).toHaveAttribute("required", "");
        await expect(budget.locator("option", { hasText: c.notSure })).toHaveCount(1);
        await expect(timeline.locator("option", { hasText: c.notSure })).toHaveCount(1);
        await expect(page.getByLabel(c.link)).not.toHaveAttribute("required", "");
        // The estimate is in US dollars or the local equivalent, and the help is announced with the field.
        await expect(page.locator("#budget-help")).toHaveText(c.budgetHelp);
        await expect(budget).toHaveAttribute("aria-describedby", /budget-help/);
        await expect(budget.locator("option")).toHaveCount(7);
        await fillRequired(page);
        await expect(page.locator('button[type="submit"]')).toBeDisabled();
        await budget.selectOption("not_sure");
        await expect(page.locator('button[type="submit"]')).toBeDisabled();
        await timeline.selectOption("within_3_months");
        await expect(page.locator('button[type="submit"]')).toBeEnabled({ timeout: 5000 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
      });

      test("the sensitive-data note sits above the description and is linked to it", async ({ page }) => {
        await installTurnstileMock(page);
        await page.goto(`/${locale}/start`);
        const note = page.getByRole("complementary", { name: c.note });
        await expect(note).toBeVisible();
        const desc = page.getByLabel(c.desc, { exact: false }).and(page.locator("textarea"));
        const [noteBox, descBox] = [await note.boundingBox(), await desc.boundingBox()];
        expect(noteBox!.y + noteBox!.height).toBeLessThanOrEqual(descBox!.y);
        // In the document too, not only visually.
        expect(await page.evaluate(() => !!(document.querySelector("[data-sensitive-note]")!.compareDocumentPosition(document.querySelector("form textarea")!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
        await expect(desc).toHaveAttribute("aria-describedby", /sensitive-note/);
        await expect(note.getByRole("listitem")).toHaveCount(5);
        if (locale === "ar") await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      });

      test("sends the stored values and a normalized link; an unsafe link is refused before sending", async ({ page }) => {
        await installTurnstileMock(page);
        const requests = await mockInquiriesRoute(page, () => ({ status: 201, body: { id: "11111111-1111-4111-8111-111111111111" } }));
        const foreign: string[] = [];
        page.on("request", (r) => {
          const host = new URL(r.url()).host;
          if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) && !/challenges\.cloudflare\.com|fonts\.(gstatic|googleapis)\.com/.test(host)) foreign.push(host);
        });
        await page.goto(`/${locale}/start`);
        await fillRequired(page);
        await page.getByLabel(c.budget).selectOption("5000_10000");
        await page.getByLabel(c.timeline).selectOption("not_sure");
        await page.getByLabel(c.link).fill("javascript:alert(1)");
        await page.locator('button[type="submit"]').click();
        await expect(page.getByText(c.badUrl)).toBeVisible();
        await expect(page.getByLabel(c.link)).toBeFocused();
        expect(requests).toHaveLength(0);
        await page.getByLabel(c.link).fill("acme.example.com/app");
        await page.locator('button[type="submit"]').click();
        await expect.poll(() => requests.length).toBe(1);
        const body = JSON.parse(requests[0]);
        // Stable codes are sent, never the labels shown.
        expect(body).toMatchObject({ budget: "5000_10000", timeline: "not_sure", existingUrl: "acme.example.com/app" });
        expect(foreign).toEqual([]);
      });

      test("no accessibility violations", async ({ page }) => {
        await installTurnstileMock(page);
        await page.goto(`/${locale}/start`);
        const results = await new AxeBuilder({ page }).include("form").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
        expect(results.violations.map((v) => v.id)).toEqual([]);
      });
    });
  }
}

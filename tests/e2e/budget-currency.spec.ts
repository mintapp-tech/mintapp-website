import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { installTurnstileMock, mockInquiriesRoute } from "./turnstile-mock";

// The budget currency: which scale the question starts in (the visitor's saved
// choice, else Egypt -> EGP and everyone else -> USD), switching, what is sent, and
// that the page is personal to each request. The country is given the way the host
// gives it (the x-vercel-ip-country request header); no real IP or location is used.
// Turnstile is mocked and /api/inquiries is intercepted.

const COOKIE = "mintapp_budget_currency";
const currency = (page: Page) => page.locator("[data-budget-currency]");
const budget = (page: Page) => page.locator('select[name="budget"]');
const options = (page: Page) => budget(page).locator("option:not([disabled])").allTextContents();
// Every selectable option as [stored code, visible label], in the order shown.
const optionPairs = (page: Page) =>
  budget(page)
    .locator("option:not([disabled])")
    .evaluateAll((els) => els.map((el) => [(el as HTMLOptionElement).value, el.textContent ?? ""]));

// The approved scales, written out here on purpose rather than imported from
// src/lib/form-options.ts, so a change to the production options fails this test.
const APPROVED = {
  USD: {
    en: [
      ["under_2500", "Under USD 2,500"],
      ["2500_5000", "USD 2,500–5,000"],
      ["5000_10000", "USD 5,000–10,000"],
      ["10000_20000", "USD 10,000–20,000"],
      ["over_20000", "Over USD 20,000"],
      ["not_sure", "Not sure yet"],
    ],
    ar: [
      ["under_2500", "أقل من 2,500 دولار أمريكي"],
      ["2500_5000", "من 2,500 إلى 5,000 دولار أمريكي"],
      ["5000_10000", "من 5,000 إلى 10,000 دولار أمريكي"],
      ["10000_20000", "من 10,000 إلى 20,000 دولار أمريكي"],
      ["over_20000", "أكثر من 20,000 دولار أمريكي"],
      ["not_sure", "لست متأكدًا بعد"],
    ],
  },
  EGP: {
    en: [
      ["under_50000", "Under EGP 50,000"],
      ["50000_100000", "EGP 50,000–100,000"],
      ["100000_250000", "EGP 100,000–250,000"],
      ["250000_500000", "EGP 250,000–500,000"],
      ["over_500000", "Over EGP 500,000"],
      ["not_sure", "Not sure yet"],
    ],
    ar: [
      ["under_50000", "أقل من 50,000 جنيه مصري"],
      ["50000_100000", "من 50,000 إلى 100,000 جنيه مصري"],
      ["100000_250000", "من 100,000 إلى 250,000 جنيه مصري"],
      ["250000_500000", "من 250,000 إلى 500,000 جنيه مصري"],
      ["over_500000", "أكثر من 500,000 جنيه مصري"],
      ["not_sure", "لست متأكدًا بعد"],
    ],
  },
} as const;

async function open(page: Page, locale: "en" | "ar", country?: string, saved?: "USD" | "EGP") {
  if (country) await page.setExtraHTTPHeaders({ "x-vercel-ip-country": country });
  if (saved) await page.context().addCookies([{ name: COOKIE, value: saved, domain: "localhost", path: "/" }]);
  await installTurnstileMock(page);
  await page.goto(`/${locale}/start`);
}

async function fillRequired(page: Page) {
  const textInputs = page.locator('form input:not([type="checkbox"]):not([type="radio"]):not([tabindex="-1"])');
  await textInputs.nth(0).fill("Test User");
  await textInputs.nth(2).fill("test@example.com");
  await page.locator('label:has(input[name="projectType"][value="web_app"])').click();
  await page.locator('select[name="timeline"]').selectOption("not_sure");
  await page.locator("form textarea").first().fill("A booking system for three clinics, for patients and receptionists.");
  await page.locator('input[type="checkbox"]').check();
}

test.describe("the starting currency", () => {
  for (const locale of ["en", "ar"] as const) {
    test(`${locale}: Egypt starts in Egyptian pounds, with every approved option in order`, async ({ page }) => {
      await open(page, locale, "EG");
      await expect(currency(page)).toHaveAttribute("data-budget-currency", "EGP");
      await expect(page.locator('input[name="budgetCurrency"][value="EGP"]')).toBeChecked();
      expect(await optionPairs(page)).toEqual(APPROVED.EGP[locale]);
    });

    for (const country of ["US", "SA", "AE", "KW", "QA", "BH", "OM", "JO"]) {
      test(`${locale}: ${country} starts in US dollars, with every approved option in order`, async ({ page }) => {
        await open(page, locale, country);
        await expect(currency(page)).toHaveAttribute("data-budget-currency", "USD");
        await expect(page.locator('input[name="budgetCurrency"][value="USD"]')).toBeChecked();
        expect(await optionPairs(page)).toEqual(APPROVED.USD[locale]);
      });
    }
  }

  test("no country (local or unknown) starts in US dollars", async ({ page }) => {
    await open(page, "en");
    await expect(currency(page)).toHaveAttribute("data-budget-currency", "USD");
    await open(page, "en", "ZZZ");
    await expect(currency(page)).toHaveAttribute("data-budget-currency", "USD");
  });

  test("a saved choice wins over the country, both ways", async ({ browser }) => {
    for (const [country, saved] of [["EG", "USD"], ["SA", "EGP"]] as const) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await open(page, "en", country, saved);
      await expect(currency(page)).toHaveAttribute("data-budget-currency", saved);
      await context.close();
    }
  });

  test("language and currency are independent: English in Egypt sees pounds, Arabic elsewhere sees dollars", async ({ browser }) => {
    let context = await browser.newContext();
    let page = await context.newPage();
    await open(page, "en", "EG");
    expect((await options(page))[0]).toBe("Under EGP 50,000");
    await context.close();
    context = await browser.newContext();
    page = await context.newPage();
    await open(page, "ar", "AE");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    expect(await options(page)).toEqual(["أقل من 2,500 دولار أمريكي", "من 2,500 إلى 5,000 دولار أمريكي", "من 5,000 إلى 10,000 دولار أمريكي", "من 10,000 إلى 20,000 دولار أمريكي", "أكثر من 20,000 دولار أمريكي", "لست متأكدًا بعد"]);
    await expect(page.getByText("يساعدنا ذلك على فهم النطاق المناسب، ولا يُعدّ عرض سعر نهائيًا.")).toBeVisible();
    await context.close();
  });
});

test.describe("switching and sending", () => {
  test("switching clears the range, says so, asks again and is remembered", async ({ page }) => {
    await open(page, "en", "EG");
    await budget(page).selectOption("100000_250000");
    await page.locator('label:has(input[name="budgetCurrency"][value="USD"])').click();
    await expect(currency(page)).toHaveAttribute("data-budget-currency", "USD");
    await expect(budget(page)).toHaveValue("");
    await expect(page.locator("[data-currency-note]")).toHaveText("Currency changed. Choose your budget range again.");
    expect((await page.context().cookies()).find((c) => c.name === COOKIE)?.value).toBe("USD");
    // The next visit from Egypt starts where the visitor left it.
    await page.goto("/en/start");
    await expect(currency(page)).toHaveAttribute("data-budget-currency", "USD");
  });

  test("sends the range with its currency, in pounds and in dollars", async ({ page }) => {
    const requests = await mockInquiriesRoute(page, () => ({ status: 201, body: { id: "11111111-1111-4111-8111-111111111111" } }));
    await open(page, "en", "EG");
    await fillRequired(page);
    await budget(page).selectOption("100000_250000");
    await page.locator('button[type="submit"]').click();
    await expect.poll(() => requests.length).toBe(1);
    const body = JSON.parse(requests[0]);
    expect(body).toMatchObject({ budget: "100000_250000", budgetCurrency: "EGP" });
    // Nothing about where the visitor is goes with the inquiry.
    expect(Object.keys(body).filter((k) => /^(ip|country|geo|remoteIp)$/i.test(k))).toEqual([]);
  });

  test("sends dollars after switching from pounds", async ({ page }) => {
    const requests = await mockInquiriesRoute(page, () => ({ status: 201, body: { id: "11111111-1111-4111-8111-111111111111" } }));
    await open(page, "en", "EG");
    await fillRequired(page);
    await page.locator('label:has(input[name="budgetCurrency"][value="USD"])').click();
    await budget(page).selectOption("2500_5000");
    await page.locator('button[type="submit"]').click();
    await expect.poll(() => requests.length).toBe(1);
    expect(JSON.parse(requests[0])).toMatchObject({ budget: "2500_5000", budgetCurrency: "USD" });
  });
});

test.describe("a personal page, without a flash", () => {
  test("never cacheable by a shared cache, and each request gets its own starting currency in the first HTML", async ({ request }) => {
    const egypt = await request.get("/en/start", { headers: { "x-vercel-ip-country": "EG" } });
    const gulf = await request.get("/en/start", { headers: { "x-vercel-ip-country": "SA" } });
    for (const res of [egypt, gulf]) expect(res.headers()["cache-control"] ?? "").toMatch(/no-store|private|no-cache/);
    const [egHtml, saHtml] = [await egypt.text(), await gulf.text()];
    // Rendered on the server already: the right scale is in the HTML before any script runs.
    expect(egHtml).toContain('data-budget-currency="EGP"');
    expect(egHtml).toContain("Under EGP 50,000");
    expect(saHtml).toContain('data-budget-currency="USD"');
    expect(saHtml).not.toContain("Under EGP 50,000");
    // The country is never echoed into the page.
    expect(egHtml).not.toMatch(/x-vercel-ip-country|"EG"/);
  });

  test("no hydration mismatch, and the scale shown first is the one that stays", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" && /hydrat|did not match|server rendered/i.test(m.text())) errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(e.message));
    await open(page, "ar", "EG");
    await expect(currency(page)).toHaveAttribute("data-budget-currency", "EGP");
    await page.waitForLoadState("networkidle");
    await expect(currency(page)).toHaveAttribute("data-budget-currency", "EGP");
    expect(errors).toEqual([]);
  });
});

test.describe("accessibility and reflow", () => {
  for (const [locale, country] of [["en", "EG"], ["ar", "EG"], ["ar", undefined]] as const) {
    test(`${locale} ${country ?? "no country"}: no violations, a labelled currency group, no sideways scrolling at 320-1280 px`, async ({ page }) => {
      await open(page, locale, country);
      const group = page.getByRole("group", { name: locale === "ar" ? "عملة الميزانية" : "Budget currency" });
      await expect(group.getByRole("radio")).toHaveCount(2);
      const results = await new AxeBuilder({ page }).include("form").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(results.violations.map((v) => v.id)).toEqual([]);
      for (const width of [320, 360, 390, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${width}px`).toBeLessThanOrEqual(0);
      }
    });
  }
});

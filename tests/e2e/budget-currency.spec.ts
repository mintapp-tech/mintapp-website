import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { installTurnstileMock, mockInquiriesRoute } from "./turnstile-mock";

// The budget scale is the server's decision for each request: Egypt gets the
// Egyptian-pound scale, every other or unknown country the US-dollar scale. There is
// no currency choice, no remembered preference, and a manipulated page or request
// cannot submit the other scale. The country is given the way the host gives it (the
// x-vercel-ip-country request header); no real IP or location is used. Turnstile is
// mocked; the form tests intercept /api/inquiries, and the tamper tests post to the
// real route, which refuses them before any verification or database call.

const RETIRED_COOKIE = "mintapp_budget_currency";
const budget = (page: Page) => page.locator('select[name="budget"]');
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
const HELP = { en: "This helps us understand the suitable scope. It is not a final quote.", ar: "يساعدنا ذلك على فهم النطاق المناسب، ولا يُعدّ عرض سعر نهائيًا." } as const;

async function open(page: Page, locale: "en" | "ar", country?: string) {
  if (country) await page.setExtraHTTPHeaders({ "x-vercel-ip-country": country });
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

// A body the real route accepts in shape; only the budget varies.
const realBody = (budgetValue: string, extra: Record<string, unknown> = {}) => ({
  name: "Test User",
  email: "test@example.com",
  desc: "A booking system for three clinics, for patients and receptionists.",
  lang: "en",
  projectType: "web_app",
  consent: true,
  submissionToken: "11111111-1111-4111-8111-111111111111",
  formStartedAt: new Date(Date.now() - 60_000).toISOString(),
  turnstileToken: "not-a-real-token",
  timeline: "not_sure",
  budget: budgetValue,
  ...extra,
});

test.describe("one scale per request, chosen by the server", () => {
  for (const locale of ["en", "ar"] as const) {
    test(`${locale}: Egypt sees only the Egyptian-pound scale, in order, with no currency choice`, async ({ page }) => {
      await open(page, locale, "EG");
      expect(await optionPairs(page)).toEqual(APPROVED.EGP[locale]);
      await expect(page.locator('[data-budget-currency="EGP"]')).toHaveCount(1);
      await expect(page.locator('input[name="budgetCurrency"]')).toHaveCount(0);
      // No currency control of any kind (the project-type question is the only radio group).
      await expect(page.getByRole("group", { name: /currency|عملة/i })).toHaveCount(0);
      await expect(page.getByRole("radio", { name: /USD|EGP|dollar|pound|دولار|جنيه/i })).toHaveCount(0);
      await expect(page.locator("#budget-help")).toHaveText(HELP[locale]);
    });

    for (const country of ["US", "SA", "AE", "KW", "QA", "BH", "OM", "JO"]) {
      test(`${locale}: ${country} sees only the US-dollar scale, in order`, async ({ page }) => {
        await open(page, locale, country);
        expect(await optionPairs(page)).toEqual(APPROVED.USD[locale]);
        await expect(page.locator('input[name="budgetCurrency"]')).toHaveCount(0);
      });
    }
  }

  test("a missing or malformed country gets the US-dollar scale", async ({ browser }) => {
    for (const country of [undefined, "ZZZ", "e-g", "203.0.113.7"]) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await open(page, "en", country);
      expect(await optionPairs(page), String(country)).toEqual(APPROVED.USD.en);
      await context.close();
    }
  });

  test("the retired preference cookie is ignored and expired", async ({ browser, request }) => {
    // A visitor in Egypt who once chose dollars on an earlier review build still sees pounds.
    const context = await browser.newContext();
    await context.addCookies([{ name: RETIRED_COOKIE, value: "USD", domain: "localhost", path: "/" }]);
    const page = await context.newPage();
    await open(page, "en", "EG");
    expect(await optionPairs(page)).toEqual(APPROVED.EGP.en);
    // ...and the page response told the browser to delete it.
    expect((await context.cookies()).find((c) => c.name === RETIRED_COOKIE)).toBeUndefined();
    await context.close();
    const res = await request.get("/en/start", { headers: { "x-vercel-ip-country": "SA", cookie: `${RETIRED_COOKIE}=EGP` } });
    expect(res.headers()["set-cookie"] ?? "").toMatch(new RegExp(`${RETIRED_COOKIE}=;.*Max-Age=0`, "i"));
    expect(await res.text()).not.toContain("Under EGP 50,000");
  });

  test("language and currency are independent: English in Egypt sees pounds, Arabic elsewhere sees dollars", async ({ browser }) => {
    let context = await browser.newContext();
    let page = await context.newPage();
    await open(page, "en", "EG");
    expect((await optionPairs(page))[0]).toEqual(["under_50000", "Under EGP 50,000"]);
    await context.close();
    context = await browser.newContext();
    page = await context.newPage();
    await open(page, "ar", "AE");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    expect((await optionPairs(page))[0]).toEqual(["under_2500", "أقل من 2,500 دولار أمريكي"]);
    await context.close();
  });
});

test.describe("tampering cannot obtain or submit the other scale", () => {
  test("the form sends the range only, never a currency", async ({ page }) => {
    const requests = await mockInquiriesRoute(page, () => ({ status: 201, body: { id: "11111111-1111-4111-8111-111111111111" } }));
    await open(page, "en", "EG");
    await fillRequired(page);
    await budget(page).selectOption("100000_250000");
    await page.locator('button[type="submit"]').click();
    await expect.poll(() => requests.length).toBe(1);
    const body = JSON.parse(requests[0]);
    expect(body.budget).toBe("100000_250000");
    // Nothing about currency or where the visitor is goes with the inquiry.
    expect(Object.keys(body).filter((k) => /currency|^(ip|country|geo|remoteIp)$/i.test(k))).toEqual([]);
  });

  test("a dollar option injected into the Egyptian page is refused by the server, with a field error the visitor can act on", async ({ page }) => {
    await open(page, "en", "EG");
    await fillRequired(page);
    // Tamper with the page itself: add a dollar range to the select and choose it.
    await budget(page).evaluate((select) => {
      const option = document.createElement("option");
      option.value = "under_2500";
      option.textContent = "Under USD 2,500";
      (select as HTMLSelectElement).append(option);
    });
    await budget(page).selectOption("under_2500");
    const response = page.waitForResponse((r) => r.url().endsWith("/api/inquiries") && r.request().method() === "POST");
    await page.locator('button[type="submit"]').click();
    const res = await response;
    expect(res.status()).toBe(400);
    expect((await res.json()).fields).toEqual({ budget: "budget_reload" });
    await expect(page.locator("#budget-error")).toHaveText("The budget options have changed. Please refresh the page and choose again.");
  });

  test("the real route refuses the other scale whatever the request claims", async ({ request }) => {
    const cases: [Record<string, string>, string, Record<string, unknown>][] = [
      [{ "x-vercel-ip-country": "EG" }, "under_2500", {}],
      [{ "x-vercel-ip-country": "EG" }, "5000_10000", { budgetCurrency: "USD" }],
      [{ "x-vercel-ip-country": "EG", cookie: `${RETIRED_COOKIE}=USD` }, "over_20000", {}],
      [{ "x-vercel-ip-country": "SA" }, "under_50000", { budgetCurrency: "EGP" }],
      [{}, "100000_250000", {}],
    ];
    for (const [headers, value, extra] of cases) {
      const res = await request.post("/api/inquiries", { headers: { "content-type": "application/json", ...headers }, data: realBody(value, extra) });
      expect(res.status(), `${JSON.stringify(headers)} ${value}`).toBe(400);
      expect((await res.json()).fields).toEqual({ budget: "budget_reload" });
    }
  });
});

test.describe("a personal page, without a flash", () => {
  test("never cacheable by a shared cache, and each request gets its own scale in the first HTML", async ({ request }) => {
    const egypt = await request.get("/en/start", { headers: { "x-vercel-ip-country": "EG" } });
    const gulf = await request.get("/en/start", { headers: { "x-vercel-ip-country": "SA" } });
    for (const res of [egypt, gulf]) expect(res.headers()["cache-control"] ?? "").toMatch(/no-store|private|no-cache/);
    const [egHtml, saHtml] = [await egypt.text(), await gulf.text()];
    // Rendered on the server already: the right scale is in the HTML before any script runs.
    expect(egHtml).toContain('data-budget-currency="EGP"');
    expect(egHtml).toContain("Under EGP 50,000");
    expect(egHtml).not.toContain("Under USD 2,500");
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
    await page.waitForLoadState("networkidle");
    expect(await optionPairs(page)).toEqual(APPROVED.EGP.ar);
    expect(errors).toEqual([]);
  });
});

test.describe("accessibility and reflow", () => {
  for (const [locale, country] of [["en", "EG"], ["ar", "EG"], ["ar", undefined], ["en", "AE"]] as const) {
    test(`${locale} ${country ?? "no country"}: no violations, a labelled budget field, no sideways scrolling at 320-1280 px`, async ({ page }) => {
      await open(page, locale, country);
      await expect(budget(page)).toHaveAccessibleName(locale === "ar" ? /الميزانية التقديرية/ : /Estimated budget/);
      await expect(budget(page)).toHaveAccessibleDescription(new RegExp(HELP[locale].slice(0, 20)));
      const results = await new AxeBuilder({ page }).include("form").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(results.violations.map((v) => v.id)).toEqual([]);
      for (const width of [320, 360, 390, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${width}px`).toBeLessThanOrEqual(0);
      }
    });
  }
});

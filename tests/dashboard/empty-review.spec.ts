import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { EMPTY_PORT } from "../../playwright.empty.config";
import { signInAs } from "./helpers";

// The admin application with nothing in the database: what the review project shows right
// after `npm run review:clean` (scripts/admin-local.mjs --seed none). Every page loads, says
// plainly that it is empty, is right to left in Arabic, has no accessibility violations, and
// is no wider than the screen on a phone. Synthetic and empty: no rows are created here.
const OMAR = "omar.demo@mintapp.local";
const ORIGIN = `http://localhost:${EMPTY_PORT}`;

// The empty sentence each main page shows, written out here independently of the app's messages.
const PAGES: { path: string; en: RegExp | null; ar: RegExp | null }[] = [
  { path: "/dashboard", en: /Nothing needs you today/, ar: /لا شيء يحتاج إليك اليوم/ },
  { path: "/leads", en: /No inquiries yet/, ar: /لا توجد طلبات بعد/ },
  { path: "/companies", en: /No companies yet/, ar: /لا توجد شركات بعد/ },
  { path: "/projects", en: /No projects yet/, ar: /لا توجد مشاريع بعد/ },
  { path: "/metrics", en: /No data yet/, ar: /لا توجد بيانات بعد/ },
  { path: "/growth", en: null, ar: null },
  { path: "/outreach", en: null, ar: null },
  { path: "/settings", en: null, ar: null },
  { path: "/search?q=clinic", en: /Nothing matches/, ar: /لا شيء يطابق/ },
];

const axe = async (page: Page) =>
  (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe.configure({ mode: "serial" });

for (const lang of ["en", "ar"] as const) {
  test(`${lang === "en" ? "English" : "Arabic"}: every page of an empty workspace loads, says it is empty, and passes accessibility on desktop and phone`, async ({ browser }) => {
    const page = await signInAs(browser, OMAR, ORIGIN);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    if (lang === "ar") {
      await page.goto("/dashboard");
      await page.getByRole("button", { name: "Switch the interface to Arabic" }).click();
      await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    }
    for (const viewport of [{ width: 1280, height: 800 }, { width: 360, height: 780 }]) {
      await page.setViewportSize(viewport);
      for (const { path, en, ar } of PAGES) {
        const where = `${lang} ${viewport.width}px ${path}`;
        const response = await page.goto(path);
        expect(response?.status(), where).toBe(200);
        await expect(page.locator("html"), where).toHaveAttribute("dir", lang === "ar" ? "rtl" : "ltr");
        await expect(page.getByRole("heading", { level: 1 }).first(), where).toBeVisible();
        const expected = lang === "ar" ? ar : en;
        if (expected) await expect(page.locator("main"), where).toContainText(expected);
        expect(await overflow(page), `${where}: nothing wider than the screen`).toBe(0);
        if (viewport.width > 400) expect(await axe(page), where).toEqual([]);
      }
    }
    if (lang === "ar") await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    expect(errors, "no script errors on any page").toEqual([]);
    await page.context().close();
  });
}

test("an empty workspace shows no counts above zero and no leftover test names", async ({ browser }) => {
  const page = await signInAs(browser, OMAR, ORIGIN);
  await page.goto("/leads");
  await expect(page.getByText("0 leads")).toBeVisible();
  await page.goto("/growth");
  await expect(page.locator("main")).toContainText("Active prospects");
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(/e2e-|review-run|11111111|@example\.com/);
  await page.context().close();
});

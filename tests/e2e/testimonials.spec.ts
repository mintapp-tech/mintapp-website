import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// No client quote is approved yet, so the public homepage must not show the
// section at all. Its layout is reviewed on a development-only preview page
// that renders clearly marked fixtures (it returns 404 in production builds).

for (const locale of ["en", "ar"] as const) {
  test(`${locale}: homepage shows no testimonials section and no sample text while nothing is approved`, async ({ page }) => {
    await page.goto(`/${locale}`);
    await expect(page.locator("#testimonials")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(/FIXTURE|Sample Client|عيّنة اختبار/);
    await expect(page.locator('script[type="application/ld+json"]', { hasText: /Review|AggregateRating/ })).toHaveCount(0);
  });

  test(`${locale}: preview renders readable, accessible cards`, async ({ page }) => {
    await page.goto(`/${locale}/preview/testimonials`, { waitUntil: "networkidle" });
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    const section = page.locator("#testimonials");
    await expect(section.getByRole("heading", { level: 2 })).toHaveText(locale === "en" ? "What our clients say" : "ماذا يقول عملاؤنا");
    const figures = section.locator("figure");
    await expect(figures).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      await expect(figures.nth(i).locator("blockquote")).toHaveAttribute("lang", /^(en|ar)$/);
      await expect(figures.nth(i).locator("figcaption")).not.toBeEmpty();
    }
    // A quote without an approved translation stays in its own language, marked as such.
    const untranslated = figures.nth(locale === "en" ? 1 : 2).locator("blockquote");
    await expect(untranslated).toHaveAttribute("lang", locale === "en" ? "ar" : "en");
    await expect(untranslated).toContainText(locale === "en" ? "Quoted in Arabic" : "مقتبس بالإنجليزية");
    // Linked project uses the localized case-study route.
    await expect(section.locator(`a[href="/${locale}/work/rentop"]`)).toHaveCount(1);

    await page.locator("#testimonials").scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    const results = await new AxeBuilder({ page }).include("#testimonials").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });

  test(`${locale}: 390px, no horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/${locale}/preview/testimonials`, { waitUntil: "networkidle" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test.describe("motion", () => {
  test("cards reveal on scroll and nothing rotates on its own", async ({ page }) => {
    await page.goto("/en/preview/testimonials", { waitUntil: "networkidle" });
    await page.locator("#testimonials").scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000);
    const infinite = await page.locator("#testimonials").evaluate((s) =>
      s.getAnimations({ subtree: true }).filter((a) => a.effect?.getTiming().iterations === Infinity).length,
    );
    expect(infinite).toBe(0);
    const firstQuote = await page.locator("#testimonials blockquote").first().textContent();
    await page.waitForTimeout(2000);
    expect(await page.locator("#testimonials blockquote").first().textContent()).toBe(firstQuote);
  });

  test.describe("reduced motion", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } });
    test("cards are fully visible with no animation", async ({ page }) => {
      await page.goto("/en/preview/testimonials", { waitUntil: "networkidle" });
      const state = await page.locator("#testimonials").evaluate((s) => ({
        running: s.getAnimations({ subtree: true }).filter((a) => a.playState === "running").length,
        opacities: [...s.querySelectorAll("figure, .mt-node")].map((el) => getComputedStyle(el).opacity),
      }));
      expect(state.running).toBe(0);
      expect(new Set(state.opacities)).toEqual(new Set(["1"]));
    });
  });
});

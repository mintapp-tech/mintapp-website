import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// The two approved client testimonials on the homepage, in English and
// Arabic. Only the English wording is approved, so Arabic pages show it in
// English, marked as such.

const OTJ = "Working with MintApp team on OTJ has been a great experience.";
const WAKRAH = "What stood out about working with Mintapp was how well the team understood what we needed.";

for (const locale of ["en", "ar"] as const) {
  test(`${locale}: two approved testimonials with their attribution, readable and accessible`, async ({ page }) => {
    await page.goto(`/${locale}`, { waitUntil: "networkidle" });
    const section = page.locator("#testimonials");
    await expect(section.getByRole("heading", { level: 2 })).toHaveText(locale === "en" ? "What our clients say" : "ماذا يقول عملاؤنا");
    const figures = section.locator("figure");
    await expect(figures).toHaveCount(2);

    const otj = figures.nth(0);
    await expect(otj.locator("blockquote")).toContainText(OTJ);
    await expect(otj.locator("blockquote")).toContainText("they’ve been part of that journey.");
    await expect(otj.locator("figcaption")).toContainText("Nour Makram");
    await expect(otj.locator("[data-attribution]")).toHaveText(locale === "en" ? "Founder · OTJ" : "المؤسِّسة · OTJ");
    const logo = otj.locator('img[src*="otj-logo"]');
    await expect(logo).toHaveCount(1);
    await logo.scrollIntoViewIfNeeded();
    await expect.poll(() => logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);

    const wakrah = figures.nth(1);
    await expect(wakrah.locator("blockquote")).toContainText(WAKRAH);
    await expect(wakrah.locator("[data-attribution]")).toHaveText("Academy Supervisor · Al Wakrah");
    // No person named, so no avatar or mark of any kind: only the approved attribution.
    await expect(wakrah.locator("img")).toHaveCount(0);
    await expect(wakrah.locator("figcaption")).toHaveText("Academy Supervisor · Al Wakrah");

    for (const figure of [otj, wakrah]) {
      await expect(figure.locator("blockquote")).toHaveAttribute("lang", "en");
      // Arabic pages label the original English wording; English pages need no label.
      if (locale === "ar") await expect(figure.locator("blockquote")).toContainText("مقتبس بالإنجليزية");
      else await expect(figure.locator("blockquote")).not.toContainText("Quoted in");
    }

    // No fictional content, and no review or rating structured data.
    await expect(page.locator("body")).not.toContainText(/FIXTURE|Sample Client|Sample content|عيّنة اختبار|محتوى تجريبي/);
    await expect(page.locator('script[type="application/ld+json"]', { hasText: /Review|AggregateRating|ratingValue/ })).toHaveCount(0);

    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    const results = await new AxeBuilder({ page }).include("#testimonials").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });

  test(`${locale}: two cards sit side by side on desktop and stack on phones, with no overflow`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/${locale}`, { waitUntil: "networkidle" });
    await page.locator("#testimonials").scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    const boxes = await page.locator("#testimonials figure").evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ top: Math.round(r.top), width: Math.round(r.width) })));
    expect(boxes).toHaveLength(2);
    expect(Math.abs(boxes[0].top - boxes[1].top)).toBeLessThanOrEqual(1);
    expect(boxes[0].width).toBe(boxes[1].width);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/${locale}`, { waitUntil: "networkidle" });
    await page.locator("#testimonials").scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    const phone = await page.locator("#testimonials figure").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(phone[1]).toBeGreaterThan(phone[0]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("the old sample preview page no longer exists", async ({ page }) => {
  const response = await page.goto("/en/preview/testimonials");
  expect(response?.status()).toBe(404);
});

test.describe("motion", () => {
  test("cards reveal on scroll and nothing rotates on its own", async ({ page }) => {
    await page.goto("/en", { waitUntil: "networkidle" });
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
      await page.goto("/en", { waitUntil: "networkidle" });
      await page.locator("#testimonials").scrollIntoViewIfNeeded();
      const state = await page.locator("#testimonials").evaluate((s) => ({
        running: s.getAnimations({ subtree: true }).filter((a) => a.playState === "running").length,
        opacities: [...s.querySelectorAll("figure, .mt-node")].map((el) => getComputedStyle(el).opacity),
      }));
      expect(state.running).toBe(0);
      expect(new Set(state.opacities)).toEqual(new Set(["1"]));
    });
  });
});

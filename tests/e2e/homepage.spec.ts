import { test, expect } from "@playwright/test";

const COPY = {
  en: { h1: "Your first meeting starts with direction, not a blank page.", start: "Start a project", work: "View selected work", fit: "Mintapp works best with founders" },
  ar: { h1: "اجتماعك الأول يبدأ باتجاه واضح، لا من صفحة فارغة", start: "ابدأ مشروعك", work: "تصفّح أعمالنا المختارة", fit: "نعمل بأفضل شكل مع المؤسسين" },
} as const;

const VIEWPORTS = [
  { name: "320", width: 320, height: 640 },
  { name: "390", width: 390, height: 844 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "desktop", width: 1440, height: 900 },
];

for (const locale of ["en", "ar"] as const) {
  const c = COPY[locale];

  test.describe(`${locale}: first viewport`, () => {
    for (const vp of VIEWPORTS) {
      test(`${vp.name}: says what, why different and how to start, with the primary CTA on screen`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`/${locale}`);
        const hero = page.locator("main > section").first();
        await expect(page.locator("h1")).toHaveText(c.h1);
        const cta = hero.getByRole("link", { name: c.start, exact: true });
        await expect(cta).toBeInViewport({ ratio: 1 });
        await expect(cta).toHaveAttribute("href", `/${locale}/start`);
        await expect(hero.getByRole("link", { name: c.work, exact: true })).toHaveAttribute("href", `/${locale}#work`);
        // The header keeps its own Start CTA visible too.
        await expect(page.locator("header").getByRole("link", { name: locale === "en" ? "Start a Project" : "ابدأ مشروعك", exact: true }).first()).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      });
    }

    test("fit statement is present and the decorative board is hidden from assistive tech", async ({ page }) => {
      await page.goto(`/${locale}`);
      await expect(page.getByText(c.fit)).toBeVisible();
      const board = page.locator(".hb-chip").first().locator("xpath=ancestor::*[@aria-hidden='true'][1]");
      await expect(board).toHaveCount(1);
    });
  });

  test(`${locale}: sections in the approved order, with no extra contact channels`, async ({ page }) => {
    await page.goto(`/${locale}`);
    const ids = await page.locator("main > section").evaluateAll((sections) => sections.map((s) => s.id || "(none)"));
    expect(ids).toEqual(["(none)", "process", "work", "services", "(none)"]);
    await expect(page.locator("main form")).toHaveCount(0);
    await expect(page.locator('a[href^="tel:"], a[href*="wa.me"], a[href*="whatsapp"]')).toHaveCount(0);
    await expect(page.locator("main iframe")).toHaveCount(0);
    await expect(page.locator('main a[href="mailto:hello@mintapp.tech"]')).toHaveCount(1);
    await expect(page.locator('a[href*="/insights"], #insights')).toHaveCount(0);
  });
}

test.describe("reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("the direction board and section paths are already settled, with nothing animating", async ({ page }) => {
    await page.goto("/en", { waitUntil: "networkidle" });
    const chips = await page.locator(".hb-chip").evaluateAll((els) => els.map((e) => [getComputedStyle(e).opacity, getComputedStyle(e).transform]));
    expect(chips).toHaveLength(6);
    for (const [opacity, transform] of chips) {
      expect(opacity).toBe("1");
      expect(transform).toBe("none");
    }
    for (const sel of [".hb-next", ".hb-path", ".mt-draw-x", ".mt-node", ".mt-converge"]) {
      const styles = await page.locator(sel).evaluateAll((els) => els.map((e) => [getComputedStyle(e).animationName, getComputedStyle(e).opacity]));
      for (const [name, opacity] of styles) {
        expect(name, sel).toBe("none");
        expect(opacity, sel).toBe("1");
      }
    }
  });
});

test.describe("normal motion", () => {
  test("the board starts loose and settles, without covering the CTA", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/en");
    const chip = page.locator(".hb-chip").first();
    expect(await chip.evaluate((e) => getComputedStyle(e).animationName)).toBe("hb-gather");
    await expect.poll(() => chip.evaluate((e) => getComputedStyle(e).transform), { timeout: 6000 }).toBe("none");
    await expect(page.locator(".hb-next")).toBeVisible();
    // Fragments never take pointer events, so the CTA stays clickable throughout.
    expect(await chip.evaluate((e) => getComputedStyle(e).pointerEvents)).toBe("none");
    await page.locator("main > section").first().getByRole("link", { name: "Start a project", exact: true }).click();
    await page.waitForURL("**/en/start");
  });
});

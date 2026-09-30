import { test, expect, type Page } from "@playwright/test";
import { installTurnstileMock } from "./turnstile-mock";

const PATHS = ["", "/about", "/services", "/insights", "/start", "/privacy", "/work/arrentio", "/work/jameel", "/work/kwayes", "/work/nazarih", "/work/rentop", "/work/tanglevibe", "/work/taskaty"];
const WIDTHS = [320, 360, 390, 768, 1280];
const LOCALES = ["en", "ar"] as const;

const COPY = {
  en: { switchLang: "Switch to Arabic", visibleLang: "AR", skip: "Skip to main content", services: "Services", about: "About", start: "Start a Project", menu: "Menu" },
  ar: { switchLang: "التبديل إلى الإنجليزية", visibleLang: "EN", skip: "انتقل إلى المحتوى الرئيسي", services: "خدماتنا", about: "من نحن", start: "ابدأ مشروعك", menu: "القائمة" },
} as const;

// Horizontal overflow that a visitor could actually lose. html/body use overflow-x: hidden,
// which would silently clip overflowing content, so that clipping is lifted before measuring.
async function reflowOverflow(page: Page) {
  await page.addStyleTag({ content: "html,body{overflow-x:visible!important}" });
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test.describe("reflow: no horizontal overflow", () => {
  for (const width of WIDTHS) {
    for (const locale of LOCALES) {
      test(`${locale} @ ${width}px on every public page`, async ({ page }) => {
        // 13 pages per test; a cold dev server compiles each on first request.
        test.setTimeout(300_000);
        await page.setViewportSize({ width, height: 800 });
        await installTurnstileMock(page);
        for (const path of PATHS) {
          await page.goto(`/${locale}${path}`);
          expect(await reflowOverflow(page), `/${locale}${path}`).toBeLessThanOrEqual(0);
        }
      });
    }
  }
});

for (const locale of LOCALES) {
  const c = COPY[locale];

  test.describe(`${locale}: language switches state their purpose`, () => {
    test("desktop header and footer", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`/${locale}`);
      const headerSwitch = page.locator("header nav a[hreflang]");
      await expect(headerSwitch).toHaveText(c.visibleLang);
      await expect(headerSwitch).toHaveAccessibleName(c.switchLang);
      await expect(page.locator("footer a[hreflang]")).toHaveAccessibleName(c.switchLang);
    });

    test("mobile menu", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 800 });
      await page.goto(`/${locale}`);
      await page.getByRole("button", { name: c.menu, exact: true }).click();
      await expect(page.getByRole("dialog").getByRole("link", { name: c.switchLang, exact: true })).toBeVisible();
    });
  });

  for (const width of [390, 1280]) {
    test.describe(`${locale} @ ${width}px: skip link`, () => {
      test.use({ viewport: { width, height: 800 } });

      test("is the first Tab stop, becomes visible, and moves focus into the main content", async ({ page }) => {
        await page.goto(`/${locale}/about`, { waitUntil: "networkidle" });
        await page.keyboard.press("Tab");
        const skip = page.getByRole("link", { name: c.skip, exact: true });
        await expect(skip).toBeFocused();
        const box = (await skip.boundingBox())!;
        expect(box.width).toBeGreaterThan(40);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);

        await page.keyboard.press("Enter");
        await expect(page.locator("main#main-content")).toBeFocused();
        await page.keyboard.press("Tab");
        const inMain = await page.evaluate(() => !!document.activeElement?.closest("main"));
        expect(inMain).toBe(true);
      });
    });
  }

  test.describe(`${locale}: aria-current marks the current route`, () => {
    test("desktop header and footer", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`/${locale}/services`);
      const nav = page.locator("header nav");
      await expect(nav.getByRole("link", { name: c.services, exact: true })).toHaveAttribute("aria-current", "page");
      await expect(nav.getByRole("link", { name: c.about, exact: true })).not.toHaveAttribute("aria-current", /.*/);
      await expect(page.locator("footer").getByRole("link", { name: c.services, exact: true })).toHaveAttribute("aria-current", "page");
      await expect(page.locator("[aria-current]")).toHaveCount(2);

      await page.goto(`/${locale}/start`);
      await expect(nav.getByRole("link", { name: c.start, exact: true })).toHaveAttribute("aria-current", "page");

      await page.goto(`/${locale}`);
      await expect(page.locator('header a[aria-label="Mintapp"]')).toHaveAttribute("aria-current", "page");
    });

    test("mobile menu", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 800 });
      await page.goto(`/${locale}/about`);
      await page.getByRole("button", { name: c.menu, exact: true }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("link", { name: c.about, exact: true })).toHaveAttribute("aria-current", "page");
      await expect(dialog.getByRole("link", { name: c.services, exact: true })).not.toHaveAttribute("aria-current", /.*/);
    });
  });
}

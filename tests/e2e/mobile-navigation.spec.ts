import { test, expect, type Page } from "@playwright/test";

const COPY = {
  en: { start: "Start a Project", menu: "Menu", close: "Close", langInMenu: "العربية", services: "Services", deskLang: "AR" },
  ar: { start: "ابدأ مشروعك", menu: "القائمة", close: "إغلاق", langInMenu: "English", services: "خدماتنا", deskLang: "EN" },
} as const;

const LOCALES = ["en", "ar"] as const;
const MOBILE_WIDTHS = [360, 390];
const DESKTOP_WIDTHS = [768, 1280];

const trigger = (page: Page) => page.locator("header button[aria-controls]");
const dialog = (page: Page) => page.getByRole("dialog");

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function focusIsInsideDialog(page: Page) {
  return page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    return !!d && d.contains(document.activeElement);
  });
}

for (const locale of LOCALES) {
  const c = COPY[locale];
  const other = locale === "en" ? "ar" : "en";

  for (const width of MOBILE_WIDTHS) {
    test.describe(`${locale} @ ${width}px mobile`, () => {
      test.use({ viewport: { width, height: 780 }, hasTouch: true });

      test("header shows the Start CTA, fits the viewport and keeps the language switch in the menu", async ({ page }) => {
        await page.goto(`/${locale}`, { waitUntil: "networkidle" });
        const cta = page.locator("header").getByRole("link", { name: c.start, exact: true });
        await expect(cta).toBeVisible();
        await expect(cta).toHaveAttribute("href", `/${locale}/start`);
        const box = (await cta.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
        expect(box.height).toBeLessThan(44);

        await expect(trigger(page)).toBeVisible();
        const menuBox = (await trigger(page).boundingBox())!;
        expect(menuBox.x).toBeGreaterThanOrEqual(0);
        expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(width);

        await expect(page.locator("header a[hreflang]:visible")).toHaveCount(0);
        expect(await horizontalOverflow(page)).toBe(0);
      });

      test("RTL/LTR: header items follow the reading direction", async ({ page }) => {
        await page.goto(`/${locale}`, { waitUntil: "networkidle" });
        await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
        const logoX = (await page.locator('header a[aria-label="Mintapp"]').boundingBox())!.x;
        const ctaX = (await page.locator("header").getByRole("link", { name: c.start, exact: true }).boundingBox())!.x;
        const menuX = (await trigger(page).boundingBox())!.x;
        if (locale === "ar") {
          expect(menuX).toBeLessThan(ctaX);
          expect(ctaX).toBeLessThan(logoX);
        } else {
          expect(logoX).toBeLessThan(ctaX);
          expect(ctaX).toBeLessThan(menuX);
        }
      });

      test("menu is an accessible modal: labels, expanded state, focus, containment, Escape and focus return", async ({ page }) => {
        await page.goto(`/${locale}`, { waitUntil: "networkidle" });
        const button = trigger(page);
        await expect(button).toHaveAttribute("aria-label", c.menu);
        await expect(button).toHaveAttribute("aria-haspopup", "dialog");
        await expect(button).toHaveAttribute("aria-expanded", "false");
        await expect(dialog(page)).toHaveCount(0);

        await button.focus();
        await page.keyboard.press("Enter");
        await expect(dialog(page)).toBeVisible();
        await expect(dialog(page)).toHaveAttribute("aria-modal", "true");
        await expect(dialog(page)).toHaveAttribute("aria-label", c.menu);
        await expect(dialog(page)).toHaveAttribute("id", (await button.getAttribute("aria-controls"))!);
        await expect(button).toHaveAttribute("aria-expanded", "true");

        const close = dialog(page).getByRole("button", { name: c.close, exact: true });
        await expect(close).toBeFocused();
        expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");

        const focusableCount = await dialog(page).locator("a[href], button").count();
        for (let i = 0; i < focusableCount + 2; i++) {
          await page.keyboard.press("Tab");
          expect(await focusIsInsideDialog(page)).toBe(true);
        }
        await close.focus();
        await page.keyboard.press("Shift+Tab");
        expect(await focusIsInsideDialog(page)).toBe(true);
        await expect(dialog(page).getByRole("link").last()).toBeFocused();

        await page.keyboard.press("Escape");
        await expect(dialog(page)).toHaveCount(0);
        await expect(button).toBeFocused();
        await expect(button).toHaveAttribute("aria-expanded", "false");
        expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
      });

      test("close button closes the menu and returns focus", async ({ page }) => {
        await page.goto(`/${locale}`, { waitUntil: "networkidle" });
        await trigger(page).click();
        await dialog(page).getByRole("button", { name: c.close, exact: true }).click();
        await expect(dialog(page)).toHaveCount(0);
        await expect(trigger(page)).toBeFocused();
      });

      test("menu links: Start and the language switch keep the locale/route", async ({ page }) => {
        await page.goto(`/${locale}/services`, { waitUntil: "networkidle" });
        await trigger(page).click();
        await expect(dialog(page).getByRole("link", { name: c.start, exact: true })).toHaveAttribute("href", `/${locale}/start`);
        const langLink = dialog(page).getByRole("link", { name: c.langInMenu, exact: true });
        await expect(langLink).toHaveAttribute("href", `/${other}/services`);
        await langLink.click();
        await page.waitForURL(`**/${other}/services`);
        await expect(page.locator("html")).toHaveAttribute("lang", other);
        await expect(dialog(page)).toHaveCount(0);
      });

      test("closed state exposes no hidden focusable elements", async ({ page }) => {
        await page.goto(`/${locale}`, { waitUntil: "networkidle" });
        await page.locator("body").focus();
        for (let i = 0; i < 6; i++) {
          await page.keyboard.press("Tab");
          const visible = await page.evaluate(() => {
            const el = document.activeElement as HTMLElement | null;
            return !!el && el !== document.body && el.checkVisibility();
          });
          expect(visible).toBe(true);
        }
      });
    });
  }

  for (const width of DESKTOP_WIDTHS) {
    test.describe(`${locale} @ ${width}px desktop navigation is unchanged`, () => {
      test.use({ viewport: { width, height: 900 } });

      test("desktop nav visible, mobile controls hidden, no overflow", async ({ page }) => {
        await page.goto(`/${locale}`, { waitUntil: "networkidle" });
        const nav = page.locator("header nav");
        await expect(nav).toBeVisible();
        await expect(nav.getByRole("link", { name: c.services, exact: true })).toBeVisible();
        await expect(nav.getByRole("link", { name: c.deskLang, exact: true })).toBeVisible();
        await expect(nav.getByRole("link", { name: c.start, exact: true })).toBeVisible();
        await expect(trigger(page)).toBeHidden();
        // The mobile CTA is still in the DOM but display:none, so only the desktop one is exposed.
        await expect(page.locator(`header a[href="/${locale}/start"]`)).toHaveCount(2);
        await expect(page.locator("header").getByRole("link", { name: c.start, exact: true })).toHaveCount(1);
        expect(await horizontalOverflow(page)).toBe(0);
      });
    });
  }
}

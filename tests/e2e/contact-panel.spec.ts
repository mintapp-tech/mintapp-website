import { test, expect, type Page } from "@playwright/test";

const COPY = {
  en: {
    contact: "Contact",
    title: "Where would you like to start?",
    start: "Start a project",
    general: "General inquiry",
    reply: "We reply within one business day.",
    close: "Close contact options",
    menu: "Menu",
  },
  ar: {
    contact: "تواصل معنا",
    title: "من أين تودّ أن تبدأ؟",
    start: "ابدأ مشروعك",
    general: "استفسار عام",
    reply: "نردّ خلال يوم عمل واحد.",
    close: "إغلاق خيارات التواصل",
    menu: "القائمة",
  },
} as const;

const panel = (page: Page) => page.locator("#contact-panel");
const desktopTrigger = (page: Page) => page.locator('header nav a[href="#contact"]');

// Measure only once the entrance has finished (it slides and scales in).
async function settled(page: Page) {
  await expect
    .poll(() => panel(page).evaluate((p) => `${getComputedStyle(p).opacity} ${getComputedStyle(p).transform}`))
    .toBe("1 none");
}

async function openOnDesktop(page: Page, locale: "en" | "ar") {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/${locale}`, { waitUntil: "networkidle" });
  await desktopTrigger(page).click();
  await expect(panel(page)).toBeVisible();
  await settled(page);
}

async function openOnMobile(page: Page, locale: "en" | "ar", width = 390, height = 844) {
  await page.setViewportSize({ width, height });
  await page.goto(`/${locale}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: COPY[locale].menu, exact: true }).click();
  await page.locator('#mobile-menu a[href="#contact"]').click();
  await expect(panel(page)).toBeVisible();
  await settled(page);
}

for (const locale of ["en", "ar"] as const) {
  const c = COPY[locale];

  test.describe(`${locale}: Contact panel`, () => {
    test("desktop: Contact sits in the navigation beside the Start a Project button", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`/${locale}`);
      const trigger = desktopTrigger(page);
      await expect(trigger).toBeVisible();
      await expect(trigger).toHaveText(c.contact);
      await expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      await expect(page.locator("header nav").getByRole("link", { name: locale === "en" ? "Start a Project" : "ابدأ مشروعك", exact: true })).toBeVisible();
      await expect(panel(page)).toHaveCount(0);
    });

    test("opens as a named modal dialog with both routes and the reply promise", async ({ page }) => {
      await openOnDesktop(page, locale);
      const dialog = page.getByRole("dialog", { name: c.title });
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAttribute("aria-modal", "true");
      await expect(desktopTrigger(page)).toHaveAttribute("aria-expanded", "true");
      await expect(dialog).toBeFocused();

      const start = dialog.getByRole("link", { name: new RegExp(`^${c.start}`) });
      await expect(start).toHaveAttribute("href", `/${locale}/start`);
      const mail = dialog.getByRole("link", { name: new RegExp(`^${c.general}`) });
      await expect(mail).toHaveAttribute("href", "mailto:hello@mintapp.tech");
      await expect(mail).toContainText("hello@mintapp.tech");
      await expect(dialog.getByText(c.reply, { exact: true })).toBeVisible();
      await expect(dialog.getByRole("button", { name: c.close, exact: true })).toBeVisible();

      // Two routes only: no form, phone, WhatsApp, chat or scheduler.
      await expect(dialog.locator("form, input, textarea, select, iframe")).toHaveCount(0);
      await expect(dialog.locator('a[href^="tel:"], a[href*="wa.me"], a[href*="whatsapp"]')).toHaveCount(0);
    });

    test("Start a project goes to the Start page and closes the panel", async ({ page }) => {
      await openOnDesktop(page, locale);
      await panel(page).getByRole("link", { name: new RegExp(`^${c.start}`) }).click();
      await page.waitForURL(`**/${locale}/start`);
      await expect(panel(page)).toHaveCount(0);
    });

    test("keyboard: Enter opens, Tab stays inside, Escape closes and focus returns to Contact", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`/${locale}`, { waitUntil: "networkidle" });
      const trigger = desktopTrigger(page);
      await trigger.focus();
      await page.keyboard.press("Enter");
      await expect(panel(page)).toBeFocused();

      const close = panel(page).getByRole("button", { name: c.close, exact: true });
      const start = panel(page).getByRole("link", { name: new RegExp(`^${c.start}`) });
      const mail = panel(page).getByRole("link", { name: new RegExp(`^${c.general}`) });
      await page.keyboard.press("Tab");
      await expect(close).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(start).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(mail).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(close).toBeFocused(); // wraps, never escapes to the page
      await page.keyboard.press("Shift+Tab");
      await expect(mail).toBeFocused();

      await page.keyboard.press("Escape");
      await expect(panel(page)).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
    });

    test("closes on a click outside and on the close button, restoring focus each time", async ({ page }) => {
      await openOnDesktop(page, locale);
      await page.mouse.click(locale === "en" ? 200 : 1240, 820);
      await expect(panel(page)).toHaveCount(0);
      await expect(desktopTrigger(page)).toBeFocused();

      await desktopTrigger(page).click();
      await panel(page).getByRole("button", { name: c.close, exact: true }).click();
      await expect(panel(page)).toHaveCount(0);
      await expect(desktopTrigger(page)).toBeFocused();
    });

    test("locks background scroll while open and releases it after", async ({ page }) => {
      await openOnDesktop(page, locale);
      expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
      await page.keyboard.press("Escape");
      await expect(panel(page)).toHaveCount(0);
      expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
    });

    test("mobile: Contact in the menu opens a bottom sheet; closing returns focus to the menu button", async ({ page }) => {
      await openOnMobile(page, locale);
      await expect(page.locator("#mobile-menu")).toHaveCount(0);
      await expect(panel(page)).toBeFocused();
      const box = (await panel(page).boundingBox())!;
      expect(Math.round(box.x)).toBe(0);
      expect(Math.round(box.width)).toBe(390);
      expect(Math.round(box.y + box.height)).toBe(844);
      expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");

      await page.keyboard.press("Escape");
      await expect(panel(page)).toHaveCount(0);
      await expect(page.getByRole("button", { name: c.menu, exact: true })).toBeFocused();
      expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
    });

    test("320px: the sheet fits with nothing clipped and no horizontal scroll", async ({ page }) => {
      await openOnMobile(page, locale, 320, 640);
      const fits = await panel(page).evaluate((p) => {
        const r = p.getBoundingClientRect();
        const inside = [...p.querySelectorAll("a, button, h2, p")].every((el) => {
          const b = el.getBoundingClientRect();
          return b.left >= r.left - 0.5 && b.right <= r.right + 0.5;
        });
        return { inside, withinViewport: r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight + 0.5, noPageScroll: document.documentElement.scrollWidth <= innerWidth };
      });
      expect(fits).toEqual({ inside: true, withinViewport: true, noPageScroll: true });
      await expect(panel(page).getByText(c.reply, { exact: true })).toBeInViewport();
    });
  });
}

test("RTL: the desktop panel anchors on the navigation side and reads right to left", async ({ page }) => {
  await openOnDesktop(page, "ar");
  const box = (await panel(page).boundingBox())!;
  expect(box.x + box.width).toBeLessThan(720);
  expect(await panel(page).evaluate((p) => getComputedStyle(p).direction)).toBe("rtl");
  const trigger = (await desktopTrigger(page).boundingBox())!;
  expect(trigger.x).toBeLessThan(720);
});

test.describe("reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("the panel appears complete, with no entrance animation running", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/en", { waitUntil: "networkidle" });
    await desktopTrigger(page).click();
    await expect(panel(page)).toBeVisible();
    const state = await panel(page).evaluate((p) => ({
      opacity: getComputedStyle(p).opacity,
      running: p.getAnimations({ subtree: true }).filter((a) => a.playState === "running").length,
      paths: [...p.querySelectorAll(".mt-draw-y, .mt-node")].map((el) => getComputedStyle(el).animationName),
    }));
    expect(state.opacity).toBe("1");
    expect(state.running).toBe(0);
    expect(new Set(state.paths)).toEqual(new Set(["none"]));
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("Contact still leads to the email and the Start page via the footer", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/en");
    await desktopTrigger(page).click();
    await expect(page).toHaveURL(/#contact$/);
    const footerContact = page.locator("footer #contact");
    await expect(footerContact).toBeInViewport();
    await expect(footerContact.locator('a[href="mailto:hello@mintapp.tech"]')).toBeVisible();
    await expect(page.locator('footer a[href="/en/start"]')).toBeVisible();
  });
});

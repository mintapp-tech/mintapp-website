import { test, expect, type Page } from "@playwright/test";

const COPY = {
  en: {
    work: "Work",
    services: "Services",
    about: "About",
    insights: "Insights",
    start: "Start a Project",
    lang: "AR",
    switchLang: "Switch to Arabic",
    footerLang: "العربية",
    privacy: "Privacy",
    heroPrimary: "Start your project",
    heroSecondary: "Explore our work",
    finalTitle: "Let's make your idea easier to build.",
    finalCta: "Start a project",
    back: "Back",
  },
  ar: {
    work: "أعمالنا",
    services: "خدماتنا",
    about: "من نحن",
    insights: "مقالات",
    start: "ابدأ مشروعك",
    lang: "EN",
    switchLang: "التبديل إلى الإنجليزية",
    footerLang: "English",
    privacy: "الخصوصية",
    heroPrimary: "ابدأ مشروعك",
    heroSecondary: "استكشف أعمالنا",
    finalTitle: "لنجعل فكرتك أسهل في التنفيذ",
    finalCta: "ابدأ مشروعك",
    back: "رجوع",
  },
} as const;

const CASE_STUDIES = ["arrentio", "rentop", "jameel", "nazarih", "taskaty", "tanglevibe", "kwayes"];
const LOCALES = ["en", "ar"] as const;

function exact(name: string) {
  return { name, exact: true };
}

async function expectLink(page: Page, locator: ReturnType<Page["locator"]>, href: string) {
  await expect(locator).toHaveCount(1);
  expect(await locator.evaluate((el) => el.tagName)).toBe("A");
  await expect(locator).toHaveAttribute("href", href);
}

for (const locale of LOCALES) {
  const c = COPY[locale];
  const other = locale === "en" ? "ar" : "en";

  test.describe(`${locale}: navigation and calls to action are real links`, () => {
    test("header navigation", async ({ page }) => {
      await page.goto(`/${locale}`);
      const nav = page.locator("header nav");
      await expectLink(page, page.locator('header a[aria-label="Mintapp"]'), `/${locale}`);
      await expectLink(page, nav.getByRole("link", exact(c.work)), `/${locale}#work`);
      await expectLink(page, nav.getByRole("link", exact(c.services)), `/${locale}/services`);
      await expectLink(page, nav.getByRole("link", exact(c.about)), `/${locale}/about`);
      await expectLink(page, nav.getByRole("link", exact(c.insights)), `/${locale}/insights`);
      await expectLink(page, nav.getByRole("link", exact(c.start)), `/${locale}/start`);
      await expectLink(page, nav.getByRole("link", exact(c.switchLang)), `/${other}`);
      await expect(nav.getByRole("link", exact(c.switchLang))).toHaveText(c.lang);
    });

    test("hero, work section and final calls to action", async ({ page }) => {
      await page.goto(`/${locale}`);
      const hero = page.locator("main > section").first();
      await expectLink(page, hero.getByRole("link", exact(c.heroPrimary)), `/${locale}/start`);
      await expectLink(page, hero.getByRole("link", exact(c.heroSecondary)), `/${locale}#work`);

      for (const slug of CASE_STUDIES) {
        await expectLink(page, page.locator(`#work a[href="/${locale}/work/${slug}"]`), `/${locale}/work/${slug}`);
      }

      const final = page.locator("section", { hasText: c.finalTitle }).last();
      await expectLink(page, final.getByRole("link", exact(c.finalCta)), `/${locale}/start`);
    });

    test("footer navigation", async ({ page }) => {
      await page.goto(`/${locale}`);
      const footer = page.locator("footer");
      await expectLink(page, footer.getByRole("link", exact(c.work)), `/${locale}#work`);
      await expectLink(page, footer.getByRole("link", exact(c.services)), `/${locale}/services`);
      await expectLink(page, footer.getByRole("link", exact(c.about)), `/${locale}/about`);
      await expectLink(page, footer.getByRole("link", exact(c.insights)), `/${locale}/insights`);
      await expectLink(page, footer.getByRole("link", exact(c.start)), `/${locale}/start`);
      await expectLink(page, footer.getByRole("link", exact(c.privacy)), `/${locale}/privacy`);
      await expectLink(page, footer.getByRole("link", exact(c.switchLang)), `/${other}`);
      await expect(footer.getByRole("link", exact(c.switchLang))).toHaveText(c.footerLang);
    });

    test("no navigation label is still rendered as a button", async ({ page }) => {
      await page.goto(`/${locale}`);
      for (const label of [c.work, c.services, c.about, c.insights, c.start, c.lang, c.switchLang, c.heroSecondary, c.finalCta, c.privacy]) {
        await expect(page.getByRole("button", exact(label))).toHaveCount(0);
      }
    });

    test("every internal link stays in this locale, and nothing interactive is nested", async ({ page }) => {
      for (const path of ["", "/about", "/services", "/insights", "/privacy", "/start", "/work/jameel", "/work/arrentio"]) {
        await page.goto(`/${locale}${path}`);
        const hrefs = await page.locator('a[href^="/"]:not([hreflang])').evaluateAll((els) => els.map((el) => el.getAttribute("href")!));
        expect(hrefs.length).toBeGreaterThan(0);
        for (const href of hrefs) {
          expect(href === `/${locale}` || href.startsWith(`/${locale}/`) || href.startsWith(`/${locale}#`), `${path}: ${href}`).toBe(true);
        }
        const switchers = await page.locator("a[hreflang]").evaluateAll((els) => els.map((el) => el.getAttribute("href")!));
        for (const href of switchers) expect(href === `/${other}${path}`, `${path}: ${href}`).toBe(true);

        await expect(page.locator("a a, a button, button a, button button")).toHaveCount(0);
      }
    });

    test("in-page hash navigation still scrolls to the section", async ({ page }) => {
      await page.goto(`/${locale}`, { waitUntil: "networkidle" });
      await page.locator("main > section").first().getByRole("link", exact(c.heroSecondary)).click();
      await expect(page.locator("#work")).toBeInViewport();
      expect(new URL(page.url()).pathname).toBe(`/${locale}`);
    });

    test("section links from another page land on the homepage section", async ({ page }) => {
      await page.goto(`/${locale}/about`, { waitUntil: "networkidle" });
      await page.locator("header nav").getByRole("link", exact(c.work)).click();
      await page.waitForURL(`**/${locale}#work`);
      await expect(page.locator("#work")).toBeInViewport();

      await page.goto(`/${locale}/work/jameel`, { waitUntil: "networkidle" });
      await page.getByRole("link", { name: c.back }).click();
      await page.waitForURL(`**/${locale}#work`);
      await expect(page.locator("#work")).toBeInViewport();
    });

    test("language link keeps the equivalent route and remembers the choice", async ({ page, context }) => {
      const savedLocale = async () => (await context.cookies()).find((ck) => ck.name === "mintapp_locale")?.value;

      // proxy.ts saves the locale of every request, so the other locale must never be
      // requested (e.g. prefetched) before the visitor actually chooses it. Prefetching
      // only happens in production builds; in dev this list is trivially empty.
      const otherLocaleRequests: string[] = [];
      const onRequest = (req: { url: () => string }) => {
        if (new URL(req.url()).pathname.startsWith(`/${other}`)) otherLocaleRequests.push(req.url());
      };
      page.on("request", onRequest);
      await page.goto(`/${locale}/about`, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);
      page.off("request", onRequest);
      expect(otherLocaleRequests).toEqual([]);
      expect(await savedLocale()).toBe(locale);

      await page.locator("header nav").getByRole("link", exact(c.switchLang)).click();
      await page.waitForURL(`**/${other}/about`);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("html")).toHaveAttribute("lang", other);
      expect(await savedLocale()).toBe(other);
    });
  });
}

test.describe("links behave like links", () => {
  test("keyboard: Tab reaches the header Start link and Enter follows it", async ({ page }) => {
    await page.goto("/en", { waitUntil: "networkidle" });
    const start = page.locator("header nav").getByRole("link", exact(COPY.en.start));
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
      if (await start.evaluate((el) => el === document.activeElement)) break;
    }
    await expect(start).toBeFocused();
    await page.keyboard.press("Enter");
    await page.waitForURL("**/en/start");
  });

  test("modifier-click opens a new tab instead of navigating in place, including in-page section links", async ({ page, context }) => {
    await page.goto("/en", { waitUntil: "networkidle" });

    const [startTab] = await Promise.all([
      context.waitForEvent("page"),
      page.locator("header nav").getByRole("link", exact(COPY.en.start)).click({ modifiers: ["ControlOrMeta"] }),
    ]);
    await startTab.waitForURL("**/en/start");

    const heroSecondary = page.locator("main > section").first().getByRole("link", exact(COPY.en.heroSecondary));
    await heroSecondary.scrollIntoViewIfNeeded();
    const scrollBefore = await page.evaluate(() => window.scrollY);
    const [workTab] = await Promise.all([context.waitForEvent("page"), heroSecondary.click({ modifiers: ["ControlOrMeta"] })]);
    await workTab.waitForURL("**/en#work");
    // The original tab neither navigated nor ran the in-page smooth scroll.
    await page.waitForTimeout(1000);
    expect(new URL(page.url()).pathname).toBe("/en");
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  });

  test("destinations are discoverable in the raw server HTML", async ({ request }) => {
    for (const locale of LOCALES) {
      const html = await (await request.get(`/${locale}`)).text();
      for (const href of [`/${locale}/start`, `/${locale}/services`, `/${locale}/about`, `/${locale}/insights`, `/${locale}/privacy`, `/${locale}#work`]) {
        expect(html, href).toContain(`href="${href}"`);
      }
      for (const slug of CASE_STUDIES) expect(html).toContain(`href="/${locale}/work/${slug}"`);
    }
  });
});

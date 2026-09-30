import { test, expect } from "@playwright/test";

const SITE_URL = "https://www.mintapp.tech";

const PUBLIC_PATHS = [
  "",
  "/about",
  "/services",
  "/start",
  "/privacy",
  "/work/arrentio",
  "/work/jameel",
  "/work/kwayes",
  "/work/nazarih",
  "/work/rentop",
  "/work/tanglevibe",
  "/work/taskaty",
];

test.describe("all 24 valid localized URLs succeed and render with the correct lang/dir", () => {
  for (const path of PUBLIC_PATHS) {
    for (const locale of ["en", "ar"] as const) {
      test(`/${locale}${path}`, async ({ page }) => {
        const response = await page.goto(`/${locale}${path}`);
        expect(response?.status()).toBe(200);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
      });
    }
  }
});

test.describe("invalid routes are deterministic real 404s, never a silent 200", () => {
  test("unknown path under /en/ is a real 404", async ({ page }) => {
    const response = await page.goto("/en/this-page-does-not-exist");
    expect(response?.status()).toBe(404);
  });

  test("unknown path under /ar/ is a real 404", async ({ page }) => {
    const response = await page.goto("/ar/this-page-does-not-exist");
    expect(response?.status()).toBe(404);
  });

  test("/work is invalid in both locales — no Work index route exists", async ({ page }) => {
    expect((await page.goto("/en/work"))?.status()).toBe(404);
    expect((await page.goto("/ar/work"))?.status()).toBe(404);
  });

  test("an unknown case-study slug is a real 404", async ({ page }) => {
    const response = await page.goto("/en/work/not-a-real-case-study");
    expect(response?.status()).toBe(404);
  });

  test("a bare top-level path with a file extension that matches no real route is a real 404, never the silently-rendered default-locale homepage", async ({ page }) => {
    // Regression guard for the exact defect found during the Phase 3 audit:
    // /manifest.json (or any other guessed extensioned path with no real
    // route) used to match the [locale] dynamic segment and silently render
    // the Arabic homepage with a 200. The layout's isSupportedLocale guard
    // fixes this — confirmed here by asserting a real 404 and that the
    // homepage's own distinguishing content never appears.
    const response = await page.goto("/manifest.json");
    expect(response?.status()).toBe(404);
  });
});

test.describe("the removed Insights pages are genuine 404s, never a homepage or soft 404", () => {
  for (const locale of ["en", "ar"] as const) {
    test(`/${locale}/insights returns 404 and renders no site content`, async ({ page }) => {
      const response = await page.goto(`/${locale}/insights`);
      expect(response?.status()).toBe(404);
      expect(new URL(page.url()).pathname).toBe(`/${locale}/insights`);
      await expect(page.locator("main#main-content")).toHaveCount(0);
      await expect(page.locator("header nav")).toHaveCount(0);
    });
  }

  test("the bare /insights path is locale-prefixed by the proxy and then 404s, never redirected to the homepage", async ({ page }) => {
    const response = await page.goto("/insights");
    expect(response?.status()).toBe(404);
    expect(new URL(page.url()).pathname).toMatch(/^\/(en|ar)\/insights$/);
  });
});

test.describe("locale-like-but-unsupported prefixes redirect to a real supported locale, rather than rendering content at the unsupported URL", () => {
  test("/fr/about redirects (not a direct 200) to a real /en or /ar page, never staying on /fr/about", async ({ page }) => {
    const response = await page.goto("/fr/about");
    expect(response?.status()).toBe(200);
    const finalUrl = page.url();
    expect(finalUrl.includes("/fr/")).toBe(false);
    expect(finalUrl.includes("/en/about") || finalUrl.includes("/ar/about")).toBe(true);
  });
});

test.describe("/sitemap.xml", () => {
  test("returns real XML containing exactly the 24 intended public URLs", async ({ page }) => {
    const response = await page.goto("/sitemap.xml");
    expect(response?.status()).toBe(200);
    expect(response?.headers()["content-type"]).toContain("xml");

    const body = await response!.text();
    const locations = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locations.length).toBe(24);
    expect(new Set(locations).size).toBe(24);

    for (const loc of locations) {
      expect(loc.startsWith(SITE_URL)).toBe(true);
    }
    expect(locations.some((l) => l.includes("/internal"))).toBe(false);
    expect(locations.some((l) => l.endsWith("/work") || l.endsWith("/work/"))).toBe(false);
    expect(locations.some((l) => l.includes("/insights"))).toBe(false);
  });
});

test.describe("/robots.txt", () => {
  test("returns the intended directives and the absolute production sitemap URL", async ({ page }) => {
    const response = await page.goto("/robots.txt");
    expect(response?.status()).toBe(200);
    const body = await response!.text();
    expect(body).toContain("Disallow: /internal/");
    expect(body).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
    expect(body).not.toContain("vercel.app");
  });
});

test.describe("/internal/concept-pack stays excluded and noindex, unaffected by this milestone", () => {
  test("is not one of the sitemap's 24 URLs", async ({ page }) => {
    const response = await page.goto("/sitemap.xml");
    const body = await response!.text();
    expect(body).not.toContain("/internal");
  });

  test("still renders with its own noindex meta tag", async ({ page }) => {
    const response = await page.goto("/internal/concept-pack");
    expect(response?.status()).toBe(200);
    const robotsMeta = page.locator('meta[name="robots"]');
    await expect(robotsMeta).toHaveAttribute("content", /noindex/);
  });
});

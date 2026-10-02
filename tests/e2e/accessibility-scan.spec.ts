import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { installTurnstileMock } from "./turnstile-mock";

// Automated WCAG 2.2 A/AA checks. Complements (never replaces) the manual keyboard,
// focus, reduced-motion, RTL and visual checks in the other specs.
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const PAGES = ["/en", "/ar", "/en/start", "/ar/start", "/en/work/jameel", "/ar/work/arrentio", "/en/privacy", "/ar/privacy"];
const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

// No scan may reach a third party (Turnstile, Cal.com, Supabase, Resend, analytics):
// every cross-origin request is recorded and fails the test.
async function guardOrigin(page: Page, baseURL: string) {
  const external: string[] = [];
  page.on("request", (req) => {
    const url = req.url();
    if (!url.startsWith("data:") && new URL(url).origin !== new URL(baseURL).origin) external.push(url);
  });
  await installTurnstileMock(page);
  return external;
}

function describeViolations(violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"]) {
  return violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
}

// Scan the settled page: a contrast check taken mid-fade measures half-transparent
// text, not what anyone reads. Infinite loops (marquee, float) and scroll-linked
// timelines never finish, so only finite time-based animations are awaited.
async function waitForEntrances(page: Page) {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity || !(a.timeline instanceof DocumentTimeline)),
  );
}

async function scan(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return describeViolations(results.violations);
}

for (const viewport of VIEWPORTS) {
  test.describe(`axe @ ${viewport.name}`, () => {
    // Reduced motion renders every section immediately, so nothing is still hidden
    // for a scroll entrance while axe evaluates contrast and structure.
    test.use({ viewport: { width: viewport.width, height: viewport.height }, contextOptions: { reducedMotion: "reduce" } });

    for (const path of PAGES) {
      test(`${path} has no WCAG A/AA violations`, async ({ page, baseURL }) => {
        const external = await guardOrigin(page, baseURL!);
        await page.goto(path, { waitUntil: "networkidle" });
        expect(await scan(page)).toEqual([]);
        expect(external).toEqual([]);
      });
    }
  });
}

test.describe("axe: interactive and motion states", () => {
  for (const locale of ["en", "ar"] as const) {
    test(`${locale}: open mobile menu dialog has no violations`, async ({ page, baseURL }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const external = await guardOrigin(page, baseURL!);
      await page.goto(`/${locale}`, { waitUntil: "networkidle" });
      await page.locator("header button[aria-controls]").click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.waitForTimeout(400);
      await waitForEntrances(page);
      expect(await scan(page)).toEqual([]);
      expect(external).toEqual([]);
    });

    for (const [name, width, height] of [["desktop", 1280, 900], ["mobile", 390, 844]] as const) {
      test(`${locale}: open Contact panel (${name}) has no violations`, async ({ page, baseURL }) => {
        await page.setViewportSize({ width, height });
        const external = await guardOrigin(page, baseURL!);
        await page.goto(`/${locale}`, { waitUntil: "networkidle" });
        if (name === "desktop") {
          await page.locator('header nav a[href="#contact"]').click();
        } else {
          await page.locator("header button[aria-controls]").click();
          await page.locator('#mobile-menu a[href="#contact"]').click();
        }
        await expect(page.locator("#contact-panel")).toBeVisible();
        await page.waitForTimeout(400);
        await waitForEntrances(page);
        expect(await scan(page)).toEqual([]);
        expect(external).toEqual([]);
      });
    }

    test(`${locale}: homepage in normal motion, after every section has revealed`, async ({ page, baseURL }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      const external = await guardOrigin(page, baseURL!);
      await page.goto(`/${locale}`, { waitUntil: "networkidle" });
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y <= height; y += 400) {
        await page.evaluate((top) => window.scrollTo(0, top), y);
        await page.waitForTimeout(80);
      }
      await page.waitForTimeout(1200);
      expect(await scan(page)).toEqual([]);
      expect(external).toEqual([]);
    });
  }
});

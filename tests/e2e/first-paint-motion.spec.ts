import { test, expect, type Page } from "@playwright/test";
import { installTurnstileMock } from "./turnstile-mock";

const HERO_TITLE = { en: "Your first meeting starts with direction, not a blank page.", ar: "اجتماعك الأول يبدأ باتجاه واضح، لا من صفحة فارغة" } as const;

// Pages whose top heading and main content must never depend on hydration.
const PAGES = [
  { url: "/en", h1: HERO_TITLE.en },
  { url: "/ar", h1: HERO_TITLE.ar },
  { url: "/en/start", h1: "Tell us what you want to build." },
  { url: "/ar/start", h1: "احكِ لنا عمّا تريد بناءه" },
  { url: "/en/about", h1: "We make building software understandable" },
  { url: "/ar/work/arrentio", h1: "تأجير السيارات، خارج محادثات الدردشة" },
];

function stripTags(html: string) {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

// Time-based entrances only: the marquee loops forever and the hero's scroll-linked
// fade runs on a scroll timeline, so neither ever reports "finished".
async function waitForEntranceAnimations(page: Page) {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity || !(a.timeline instanceof DocumentTimeline)),
  );
}

// Lowest effective opacity of an element: its own and every ancestor's.
function effectiveOpacity(el: Element) {
  let min = 1;
  for (let node: Element | null = el; node; node = node.parentElement) {
    min = Math.min(min, Number(getComputedStyle(node).opacity));
  }
  for (const child of Array.from(el.querySelectorAll("span"))) {
    min = Math.min(min, Number(getComputedStyle(child).opacity));
  }
  return min;
}

// With JavaScript disabled nothing can be polled in the page, so wait out the longest
// CSS entrance instead (visual block: 0.2s delay + 0.8s; longest heading ~1.2s).
const LONGEST_ENTRANCE_MS = 1600;

test.describe("server HTML keeps content visible without JavaScript", () => {
  for (const { url, h1 } of PAGES) {
    test(`${url}: heading is in the server HTML and nothing is delivered at opacity 0`, async ({ request }) => {
      const response = await request.get(url);
      expect(response.status()).toBe(200);
      const html = await response.text();

      const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
      expect(h1Match).not.toBeNull();
      expect(stripTags(h1Match![1])).toBe(h1);
      expect(h1Match![0]).not.toMatch(/opacity:\s*0[;"]/);

      expect(html).not.toMatch(/opacity:\s*0[;"]/);
    });
  }
});

test.describe("no JavaScript at all", () => {
  test.use({ javaScriptEnabled: false });

  for (const { url, h1 } of PAGES) {
    test(`${url}: heading renders fully visible from CSS alone`, async ({ page }) => {
      await page.goto(url);
      const heading = page.locator("h1");
      await expect(heading).toBeVisible();
      await expect(heading).toHaveText(h1);
      await page.waitForTimeout(LONGEST_ENTRANCE_MS);
      expect(await heading.evaluate(effectiveOpacity)).toBe(1);
    });
  }

  test("/en/start: the form is visible without hydration", async ({ page }) => {
    await page.goto("/en/start");
    await expect(page.locator("form")).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await page.waitForTimeout(LONGEST_ENTRANCE_MS);
    expect(await page.locator("form").evaluate(effectiveOpacity)).toBe(1);
  });
});

test.describe("reduced motion", () => {
  // Must go through contextOptions: a top-level `reducedMotion` test option is silently ignored.
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  for (const locale of ["en", "ar"] as const) {
    test(`/${locale}: content renders immediately with no entrance, reveal or scroll-linked motion`, async ({ page }) => {
      await page.goto(`/${locale}`, { waitUntil: "networkidle" });
      expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);

      const running = await page.evaluate(() =>
        document
          .getAnimations()
          .filter((a) => a.playState === "running")
          .map((a) => `${(a as CSSAnimation).animationName ?? a.constructor.name} on ${String((a.effect as KeyframeEffect)?.target?.className).slice(0, 50)} dur=${a.effect?.getTiming().duration} delay=${a.effect?.getTiming().delay}`),
      );
      expect(running).toEqual([]);

      // Nothing below the fold was hidden for a scroll replay.
      await expect(page.locator("[data-reveal]")).toHaveCount(0);

      const words = page.locator("h1 span");
      const styles = await words.evaluateAll((spans) => spans.map((s) => [getComputedStyle(s).opacity, getComputedStyle(s).transform]));
      for (const [opacity, transform] of styles) {
        expect(opacity).toBe("1");
        expect(transform).toBe("none");
      }

      // A below-the-fold heading is already visible without scrolling to it.
      const servicesWordOpacity = await page.locator("#services h2 span").first().evaluate((s) => getComputedStyle(s).opacity);
      expect(servicesWordOpacity).toBe("1");

      // Scrolling does not fade or move the hero.
      await page.evaluate(() => window.scrollTo(0, 700));
      await page.waitForTimeout(300);
      const heroGrid = page.locator("main > section").first().locator("> div").first();
      const hero = await heroGrid.evaluate((el) => [getComputedStyle(el).opacity, getComputedStyle(el).transform]);
      expect(hero).toEqual(["1", "none"]);
    });
  }
});

test.describe("default motion is preserved for everyone else", () => {
  test("hero words use the CSS entrance and below-the-fold sections replay their entrance on scroll", async ({ page }) => {
    await page.goto("/en", { waitUntil: "networkidle" });

    const heroAnimation = await page.locator("h1 span").first().evaluate((s) => getComputedStyle(s).animationName);
    expect(heroAnimation).toBe("mt-word");

    const heading = page.locator("#services h2");
    await expect(heading).toHaveAttribute("data-reveal", "armed");
    const hiddenOpacity = await heading.locator("span").first().evaluate((s) => getComputedStyle(s).opacity);
    expect(hiddenOpacity).toBe("0");

    await heading.scrollIntoViewIfNeeded();
    await expect(heading).toHaveAttribute("data-reveal", "play");
    await waitForEntranceAnimations(page);
    const shownOpacity = await heading.locator("span").first().evaluate((s) => getComputedStyle(s).opacity);
    expect(shownOpacity).toBe("1");
  });
});

test.describe("hydration is clean and stays on this origin", () => {
  for (const { url } of PAGES) {
    test(`${url}: no console errors, page errors or unexpected external requests`, async ({ page, baseURL }) => {
      const errors: string[] = [];
      const external: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      page.on("pageerror", (err) => errors.push(err.message));
      page.on("request", (req) => {
        const origin = new URL(req.url()).origin;
        if (origin !== new URL(baseURL!).origin && !req.url().startsWith("data:")) external.push(req.url());
      });
      if (url.endsWith("/start")) await installTurnstileMock(page);

      await page.goto(url, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);

      expect(errors).toEqual([]);
      expect(external).toEqual([]);
    });
  }
});

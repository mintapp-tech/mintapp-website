import { test, expect, devices } from "@playwright/test";
import { installTurnstileMock } from "./turnstile-mock";

// No test in this file lets a submission reach a real backend — the
// Cloudflare script is blocked/mocked and /api/inquiries is never actually
// invoked (these tests stop at "is the form keyboard/viewport usable",
// not "does a submission succeed").

test.describe("keyboard-only progression", () => {
  test("Tab reaches every real field in order and skips the honeypot entirely", async ({ page }) => {
    await installTurnstileMock(page, { autoComplete: false });
    await page.goto("/en/start");

    const nameInput = page.locator('form input:not([type="checkbox"]):not([tabindex="-1"])').nth(0);
    await nameInput.focus();
    await expect(nameInput).toBeFocused();
    await page.keyboard.type("Keyboard User");

    // Company (optional) — Tab forward.
    await page.keyboard.press("Tab");
    const companyInput = page.locator('form input:not([type="checkbox"]):not([tabindex="-1"])').nth(1);
    await expect(companyInput).toBeFocused();

    // Email.
    await page.keyboard.press("Tab");
    const emailInput = page.locator('form input:not([type="checkbox"]):not([tabindex="-1"])').nth(2);
    await expect(emailInput).toBeFocused();
    await page.keyboard.type("keyboard@example.com");

    // Phone (optional).
    await page.keyboard.press("Tab");
    const phoneInput = page.locator('form input:not([type="checkbox"]):not([tabindex="-1"])').nth(3);
    await expect(phoneInput).toBeFocused();

    // Description.
    await page.keyboard.press("Tab");
    const descInput = page.locator("form textarea").first();
    await expect(descInput).toBeFocused();
    await page.keyboard.type("A".repeat(40));

    // None of the above focus stops ever landed on the honeypot — it has
    // tabIndex={-1} specifically so keyboard users (real people) never
    // trip it.
    const honeypotFocused = await page.evaluate(() => {
      const hp = document.querySelector('input[tabindex="-1"]');
      return document.activeElement === hp;
    });
    expect(honeypotFocused).toBe(false);

    // Consent checkbox is keyboard-operable.
    await page.keyboard.press("Tab");
    const consentCheckbox = page.locator('input[type="checkbox"]');
    await expect(consentCheckbox).toBeFocused();
    await page.keyboard.press("Space");
    await expect(consentCheckbox).toBeChecked();
  });
});

test.describe("mobile English viewport", () => {
  // Only the viewport-shape properties — devices["Pixel 7"] as a whole
  // includes defaultBrowserType, which Playwright only allows at project
  // level, not inside a describe-scoped test.use().
  test.use({
    viewport: devices["Pixel 7"].viewport,
    userAgent: devices["Pixel 7"].userAgent,
    isMobile: devices["Pixel 7"].isMobile,
    hasTouch: devices["Pixel 7"].hasTouch,
  });

  test("Start form renders usably on a mobile English viewport", async ({ page }) => {
    await installTurnstileMock(page);
    await page.goto("/en/start");
    await expect(page.locator("form")).toBeVisible();
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(hasHorizontalOverflow).toBe(false);
  });
});

test.describe("mobile Arabic RTL viewport", () => {
  // Only the viewport-shape properties — devices["Pixel 7"] as a whole
  // includes defaultBrowserType, which Playwright only allows at project
  // level, not inside a describe-scoped test.use().
  test.use({
    viewport: devices["Pixel 7"].viewport,
    userAgent: devices["Pixel 7"].userAgent,
    isMobile: devices["Pixel 7"].isMobile,
    hasTouch: devices["Pixel 7"].hasTouch,
  });

  test("Start form renders RTL and usably on a mobile Arabic viewport", async ({ page }) => {
    await installTurnstileMock(page);
    await page.goto("/ar/start");
    const dir = await page.evaluate(() => document.documentElement.getAttribute("dir"));
    expect(dir).toBe("rtl");
    await expect(page.locator("form")).toBeVisible();
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(hasHorizontalOverflow).toBe(false);
  });
});

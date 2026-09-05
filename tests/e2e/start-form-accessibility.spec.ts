import { test, expect, devices, type Page } from "@playwright/test";
import { installTurnstileMock, mockInquiriesRoute } from "./turnstile-mock";

// No test in this file lets a submission reach a real backend — the
// Cloudflare script is blocked/mocked, and any test that needs a successful
// submission mocks /api/inquiries directly rather than ever invoking the
// real route (these tests stop at "is the form/success panel
// keyboard/focus/viewport usable", not "does a submission succeed
// server-side" — that's route.test.ts's job).

async function fillMinimumValidForm(page: Page) {
  const textInputs = page.locator('form input:not([type="checkbox"]):not([tabindex="-1"])');
  await textInputs.nth(0).fill("Test User");
  await textInputs.nth(2).fill("test@example.com");
  await page.locator("form textarea").first().fill("A".repeat(40));
  await page.locator('input[type="checkbox"]').check();
}

async function submitForm(page: Page) {
  await expect(page.locator('button[type="submit"]')).toBeEnabled({ timeout: 5000 });
  await page.locator('button[type="submit"]').click();
}

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

test.describe("success-heading focus after the animated form-to-success transition", () => {
  // Regression coverage for a real, pre-existing defect: a useEffect keyed
  // on the `submitted` state object ran before AnimatePresence's
  // mode="wait" finished mounting the success panel (it delays mounting
  // the incoming child until the outgoing child's exit animation
  // completes), so the heading ref was still null when focus() was called
  // and focus never actually landed. Fixed with a stable-identity callback
  // ref instead, which React invokes exactly when the node mounts. No
  // scheduling/Cal.com code is involved in any of these three tests.

  test("English: document.activeElement is the success heading after submission", async ({ page }) => {
    await installTurnstileMock(page);
    await mockInquiriesRoute(page, () => ({ status: 201, body: { id: "11111111-1111-4111-8111-111111111111" } }));

    await page.goto("/en/start");
    await fillMinimumValidForm(page);
    await submitForm(page);

    const heading = page.getByRole("heading", { name: "We have your idea" });
    await expect(heading).toBeFocused();
  });

  test("Arabic: document.activeElement is the success heading after submission", async ({ page }) => {
    await installTurnstileMock(page);
    await mockInquiriesRoute(page, () => ({ status: 201, body: { id: "11111111-1111-4111-8111-111111111111" } }));

    await page.goto("/ar/start");
    await fillMinimumValidForm(page);
    await submitForm(page);

    const heading = page.getByRole("heading", { name: "وصلتنا فكرتك" });
    await expect(heading).toBeFocused();
  });

  test("a subsequent rerender/settle of the success panel does not steal focus away from the heading", async ({ page }) => {
    await installTurnstileMock(page);
    await mockInquiriesRoute(page, () => ({ status: 201, body: { id: "11111111-1111-4111-8111-111111111111" } }));

    await page.goto("/en/start");
    await fillMinimumValidForm(page);
    await submitForm(page);

    const heading = page.getByRole("heading", { name: "We have your idea" });
    await expect(heading).toBeFocused();

    // Give the exit/enter animation and any settle-time rerenders a full
    // window to complete, then confirm nothing re-fired and moved focus a
    // second time (a stable-identity callback ref only fires on genuine
    // mount/unmount, never on an ordinary rerender).
    await page.waitForTimeout(1000);
    await expect(heading).toBeFocused();
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

import { test, expect } from "@playwright/test";
import { installTurnstileMock, triggerTurnstileCallback, mockInquiriesRoute } from "./turnstile-mock";

// Every test below either blocks the real Cloudflare script outright or
// replaces window.turnstile with a synthetic mock before any page script
// runs, and intercepts /api/inquiries — no request in this file may reach a
// real Cloudflare, Supabase, or Resend endpoint.

async function fillMinimumValidForm(page: import("@playwright/test").Page) {
  const textInputs = page.locator('form input:not([type="checkbox"]):not([tabindex="-1"])');
  await textInputs.nth(0).fill("Test User");
  await textInputs.nth(2).fill("test@example.com");
  await page.locator("form textarea").first().fill("A".repeat(40));
  await page.locator('input[type="checkbox"]').check();
}

test.describe("script-load failure", () => {
  test("blocking the real Cloudflare script shows an accessible retry control, never a silently-stuck button", async ({ page }) => {
    await page.route("**/challenges.cloudflare.com/**", (route) => route.abort());
    await page.goto("/en/start");

    const retryButton = page.getByRole("button", { name: /retry|try again/i });
    await expect(retryButton).toBeVisible({ timeout: 12_000 });

    const alert = page.locator("p[role=\"alert\"]");
    await expect(alert).toContainText(/.+/);
  });
});

test.describe("mocked Turnstile callbacks — no real Cloudflare network calls, no 5-minute wait", () => {
  test("successful completion enables the submit button", async ({ page }) => {
    await installTurnstileMock(page);
    await page.goto("/en/start");
    await fillMinimumValidForm(page);
    await expect(page.locator('button[type="submit"]')).toBeEnabled({ timeout: 5000 });
  });

  test("expired callback clears the token and disables submit again", async ({ page }) => {
    await installTurnstileMock(page);
    await page.goto("/en/start");
    await fillMinimumValidForm(page);
    await expect(page.locator('button[type="submit"]')).toBeEnabled({ timeout: 5000 });

    await triggerTurnstileCallback(page, "expired-callback");
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
  });

  test("timeout callback clears the token and disables submit again", async ({ page }) => {
    await installTurnstileMock(page);
    await page.goto("/en/start");
    await fillMinimumValidForm(page);
    await expect(page.locator('button[type="submit"]')).toBeEnabled({ timeout: 5000 });

    await triggerTurnstileCallback(page, "timeout-callback");
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
  });

  test("error callback clears the token and shows an accessible error message", async ({ page }) => {
    await installTurnstileMock(page, { autoComplete: false });
    await page.goto("/en/start");
    await fillMinimumValidForm(page);
    await expect(page.locator('button[type="submit"]')).toBeDisabled();

    await triggerTurnstileCallback(page, "error-callback");
    await expect(page.locator("p[role=\"alert\"]")).toContainText(/.+/);
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
  });

  test("a turnstile_failed response resets the widget and the next submission carries a fresh token, not the stale one", async ({ page }) => {
    await installTurnstileMock(page);
    let callCount = 0;
    const requests = await mockInquiriesRoute(page, () => {
      callCount += 1;
      if (callCount === 1) {
        return { status: 403, body: { error: "Verification failed.", code: "turnstile_failed" } };
      }
      return { status: 201, body: { id: "fake-id" } };
    });

    await page.goto("/en/start");
    await fillMinimumValidForm(page);
    await expect(page.locator('button[type="submit"]')).toBeEnabled({ timeout: 5000 });

    await page.locator('button[type="submit"]').click();
    await expect(page.locator("p[role=\"alert\"]")).toContainText(/.+/);

    // resetTurnstile() clears the token and calls widget.reset(), which the
    // mock answers by re-invoking the callback with a brand new token.
    await expect(page.locator('button[type="submit"]')).toBeEnabled({ timeout: 5000 });
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText(/./)).toBeTruthy();

    expect(requests.length).toBe(2);
    const firstToken = (JSON.parse(requests[0]) as { turnstileToken: string }).turnstileToken;
    const secondToken = (JSON.parse(requests[1]) as { turnstileToken: string }).turnstileToken;
    expect(secondToken).not.toBe(firstToken);
    expect(secondToken).toMatch(/^mock-token-reset-/);
  });

  test("the real Turnstile token never appears in any browser console message", async ({ page }) => {
    await installTurnstileMock(page);
    const consoleTexts: string[] = [];
    page.on("console", (msg) => consoleTexts.push(msg.text()));

    await page.goto("/en/start");
    await fillMinimumValidForm(page);
    await expect(page.locator('button[type="submit"]')).toBeEnabled({ timeout: 5000 });

    const tokenValue = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const state = (window as any).__turnstileMock;
      return `mock-token-${state.renders[0].id}`;
    });
    const leaked = consoleTexts.some((t) => t.includes(tokenValue));
    expect(leaked).toBe(false);
  });
});

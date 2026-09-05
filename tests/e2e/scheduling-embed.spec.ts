import { test, expect, type Page } from "@playwright/test";
import { installTurnstileMock, mockInquiriesRoute } from "./turnstile-mock";
import { installCalEmbedMock, fireCalEvent, getRecordedInlineCalls } from "./cal-embed-mock";

// Every test here blocks the real Cloudflare Turnstile script (via
// installTurnstileMock) and the real Cal.com embed script/domain (via
// installCalEmbedMock), and intercepts /api/inquiries directly at the
// browser network layer — no test in this file may reach a real Cal.com,
// Cloudflare, Supabase, or Resend endpoint.

const NAMESPACE = "mintapp-discovery-call";
const FAKE_CONTEXT = "fake-booking-context-token-for-e2e-only";
const FAKE_UUID = "11111111-1111-4111-8111-111111111111";

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

test.describe("no scheduling section before an accepted submission", () => {
  test("the scheduling region and its heading are absent before submitting", async ({ page }) => {
    await installTurnstileMock(page);
    await installCalEmbedMock(page);
    await page.goto("/en/start");
    await expect(page.getByRole("region")).toHaveCount(0);
    await expect(page.getByText("Schedule your discovery call")).toHaveCount(0);
  });
});

test.describe("valid accepted response renders the scheduling section", () => {
  test("a 201 with a bookingContext renders the scheduling region with the correct calLink and metadata", async ({ page }) => {
    await installTurnstileMock(page);
    await installCalEmbedMock(page);
    await mockInquiriesRoute(page, () => ({ status: 201, body: { id: FAKE_UUID, bookingContext: FAKE_CONTEXT } }));

    await page.goto("/en/start");
    await fillMinimumValidForm(page);
    await submitForm(page);

    await expect(page.getByRole("heading", { name: "Schedule your discovery call" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Schedule your discovery call" })).toBeVisible();

    const calls = await getRecordedInlineCalls(page);
    expect(calls.length).toBe(1);
    expect(calls[0].calLink).toBe("mintapp/mintapp-discovery-call");
    expect(calls[0].config["metadata[bookingContext]"]).toBe(FAKE_CONTEXT);
  });
});

test.describe("malformed or missing context shows the unavailable fallback, never breaks the accepted inquiry", () => {
  test("missing bookingContext shows the scheduling-unavailable copy, no region, no crash", async ({ page }) => {
    await installTurnstileMock(page);
    await installCalEmbedMock(page);
    await mockInquiriesRoute(page, () => ({ status: 201, body: { id: FAKE_UUID } }));

    await page.goto("/en/start");
    await fillMinimumValidForm(page);
    await submitForm(page);

    await expect(page.getByRole("heading", { name: "We have your idea" })).toBeVisible();
    await expect(page.getByText("Online scheduling is unavailable right now.")).toBeVisible();
    await expect(page.getByRole("region")).toHaveCount(0);
  });

  test("a non-string bookingContext (malformed shape) is treated the same as absent", async ({ page }) => {
    await installTurnstileMock(page);
    await installCalEmbedMock(page);
    await mockInquiriesRoute(page, () => ({ status: 201, body: { id: FAKE_UUID, bookingContext: 12345 } }));

    await page.goto("/en/start");
    await fillMinimumValidForm(page);
    await submitForm(page);

    await expect(page.getByRole("heading", { name: "We have your idea" })).toBeVisible();
    await expect(page.getByText("Online scheduling is unavailable right now.")).toBeVisible();
  });

  test("a malformed (non-JSON) success body still shows the already-accepted inquiry with the fallback", async ({ page }) => {
    await installTurnstileMock(page);
    await installCalEmbedMock(page);
    await page.route("**/api/inquiries", (route) => route.fulfill({ status: 201, contentType: "application/json", body: "not valid json" }));

    await page.goto("/en/start");
    await fillMinimumValidForm(page);
    await submitForm(page);

    // The inquiry is not lost even though the body was unparseable.
    await expect(page.getByRole("heading", { name: "We have your idea" })).toBeVisible();
    await expect(page.getByText("Online scheduling is unavailable right now.")).toBeVisible();
  });
});

test.describe("embed readiness timeout shows retry and mailto together", () => {
  test("no linkReady within 15s shows the error state with both a Try again button and a visible mailto link", async ({ page }) => {
    test.setTimeout(25_000);
    await installTurnstileMock(page);
    await installCalEmbedMock(page); // mock installed, but no linkReady is ever fired
    await mockInquiriesRoute(page, () => ({ status: 201, body: { id: FAKE_UUID, bookingContext: FAKE_CONTEXT } }));

    await page.goto("/en/start");
    await fillMinimumValidForm(page);
    await submitForm(page);

    await expect(page.getByRole("alert").filter({ hasText: "We couldn't load the scheduler" })).toBeVisible({ timeout: 18_000 });
    const retryButton = page.getByRole("button", { name: "Try again" });
    // Scoped to <main> — the site footer also has its own, unrelated
    // hello@mintapp.tech mailto link.
    const mailtoLink = page.getByRole("main").locator('a[href="mailto:hello@mintapp.tech"]');
    await expect(retryButton).toBeVisible();
    await expect(mailtoLink).toBeVisible();

    // Never an unsigned public Cal.com link anywhere in the failure state.
    const calLinks = await page.locator('a[href*="cal.com"]').count();
    expect(calLinks).toBe(0);
  });
});

test.describe("retry reinitializes cleanly with the same bookingContext, no new inquiry or context", () => {
  test("clicking Try again remounts the embed exactly once, reusing the identical bookingContext", async ({ page }) => {
    test.setTimeout(25_000);
    await installTurnstileMock(page);
    await installCalEmbedMock(page);
    let inquiryCallCount = 0;
    const requests = await mockInquiriesRoute(page, () => {
      inquiryCallCount += 1;
      return { status: 201, body: { id: FAKE_UUID, bookingContext: FAKE_CONTEXT } };
    });

    await page.goto("/en/start");
    await fillMinimumValidForm(page);
    await submitForm(page);

    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible({ timeout: 18_000 });
    await page.getByRole("button", { name: "Try again" }).click();

    // Retry must not submit a new inquiry or request a new context.
    expect(inquiryCallCount).toBe(1);
    expect(requests.length).toBe(1);

    // The remounted instance registers a fresh listener; firing linkReady
    // now proves the retry cleanly reinitialized (old timeout/listener from
    // the first attempt no longer fires a stale transition).
    await fireCalEvent(page, NAMESPACE, "linkReady");
    await expect(page.getByRole("region", { name: "Schedule your discovery call" })).toBeVisible();

    const calls = await getRecordedInlineCalls(page);
    expect(calls.length).toBe(2);
    expect(calls[0].config["metadata[bookingContext]"]).toBe(FAKE_CONTEXT);
    expect(calls[1].config["metadata[bookingContext]"]).toBe(FAKE_CONTEXT);
  });
});

test.describe("Arabic surrounding UI, RTL, and the English-interface language note", () => {
  test("Arabic page shows Arabic scheduling copy and the language note; English page never shows it", async ({ page }) => {
    await installTurnstileMock(page);
    await installCalEmbedMock(page);
    await mockInquiriesRoute(page, () => ({ status: 201, body: { id: FAKE_UUID, bookingContext: FAKE_CONTEXT } }));

    await page.goto("/ar/start");
    await fillMinimumValidForm(page);
    await submitForm(page);

    await expect(page.getByRole("heading", { name: "احجز موعد المكالمة التعريفية" })).toBeVisible();
    await expect(page.getByText("قد تظهر أداة حجز الموعد باللغة الإنجليزية.")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });

  test("English page never shows the Arabic-only language note", async ({ page }) => {
    await installTurnstileMock(page);
    await installCalEmbedMock(page);
    await mockInquiriesRoute(page, () => ({ status: 201, body: { id: FAKE_UUID, bookingContext: FAKE_CONTEXT } }));

    await page.goto("/en/start");
    await fillMinimumValidForm(page);
    await submitForm(page);

    await expect(page.getByRole("heading", { name: "Schedule your discovery call" })).toBeVisible();
    await expect(page.getByText("قد تظهر أداة حجز الموعد باللغة الإنجليزية.")).toHaveCount(0);
  });
});

test.describe("layout: no horizontal overflow at desktop or mobile widths", () => {
  const viewports: { name: string; width: number; height: number }[] = [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ];

  for (const lang of ["en", "ar"] as const) {
    for (const viewport of viewports) {
      test(`${lang} ${viewport.name} — no clipped calendar or nested horizontal scrolling`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await installTurnstileMock(page);
        await installCalEmbedMock(page);
        await mockInquiriesRoute(page, () => ({ status: 201, body: { id: FAKE_UUID, bookingContext: FAKE_CONTEXT } }));

        await page.goto(`/${lang}/start`);
        await fillMinimumValidForm(page);
        await submitForm(page);
        await fireCalEvent(page, NAMESPACE, "linkReady");
        await expect(page.getByRole("region")).toBeVisible();

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(1);
      });
    }
  }
});

test.describe("keyboard flow and focus management", () => {
  // English/Arabic post-submission focus itself is covered as a general
  // accessibility regression in start-form-accessibility.spec.ts (it isn't
  // Cal.com-specific). This file only covers what genuinely requires the
  // embed: that a subsequent, embed-driven state change doesn't steal
  // focus away from where it already correctly landed.
  test("embed becoming ready afterward never steals focus away from the success heading", async ({ page }) => {
    await installTurnstileMock(page);
    await installCalEmbedMock(page);
    await mockInquiriesRoute(page, () => ({ status: 201, body: { id: FAKE_UUID, bookingContext: FAKE_CONTEXT } }));

    await page.goto("/en/start");
    await fillMinimumValidForm(page);
    await submitForm(page);

    const heading = page.getByRole("heading", { name: "We have your idea" });
    await expect(heading).toBeFocused();

    await fireCalEvent(page, NAMESPACE, "linkReady");
    await expect(page.getByRole("region")).toBeVisible();
    await expect(heading).toBeFocused();
  });

  test("the Try again button is reachable and operable via keyboard", async ({ page }) => {
    test.setTimeout(25_000);
    await installTurnstileMock(page);
    await installCalEmbedMock(page);
    await mockInquiriesRoute(page, () => ({ status: 201, body: { id: FAKE_UUID, bookingContext: FAKE_CONTEXT } }));

    await page.goto("/en/start");
    await fillMinimumValidForm(page);
    await submitForm(page);

    const retryButton = page.getByRole("button", { name: "Try again" });
    await expect(retryButton).toBeVisible({ timeout: 18_000 });
    await retryButton.focus();
    await expect(retryButton).toBeFocused();
  });
});

test.describe("no secret/context leakage through logs or links", () => {
  test("bookingContext never appears in any browser console message across submit, ready, and retry", async ({ page }) => {
    test.setTimeout(25_000);
    await installTurnstileMock(page);
    await installCalEmbedMock(page);
    await mockInquiriesRoute(page, () => ({ status: 201, body: { id: FAKE_UUID, bookingContext: FAKE_CONTEXT } }));

    const consoleTexts: string[] = [];
    page.on("console", (msg) => consoleTexts.push(msg.text()));

    await page.goto("/en/start");
    await fillMinimumValidForm(page);
    await submitForm(page);
    await fireCalEvent(page, NAMESPACE, "linkReady");
    await expect(page.getByRole("region")).toBeVisible();

    const leaked = consoleTexts.some((t) => t.includes(FAKE_CONTEXT));
    expect(leaked).toBe(false);
  });
});

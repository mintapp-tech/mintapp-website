import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createHmac } from "node:crypto";
import { E2E_BOOKING_CONTEXT_SECRET } from "../../playwright.config";
import { FAKE_SUPABASE_PORT, INQUIRIES, PROBES } from "./fake-supabase.mjs";
import { getRecordedInlineCalls, installCalEmbedMock } from "./cal-embed-mock";

// The page behind the "Choose a call time" button in the acknowledgment email.
// The server decides what it shows from the inquiry's current state. These tests
// run the real server code against a local stand-in for Supabase
// (tests/e2e/fake-supabase.mjs); nothing here can reach a real database.

const DAY = 24 * 60 * 60;
const FAKE_DB = `http://127.0.0.1:${FAKE_SUPABASE_PORT}`;

// A reference issued `ageDays` ago, signed exactly as the real signer does.
function reference(inquiryId: string, ageDays = 1, secret = E2E_BOOKING_CONTEXT_SECRET) {
  const payload = Buffer.from(JSON.stringify({ id: inquiryId, iat: Math.floor(Date.now() / 1000) - ageDays * DAY }), "utf8").toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}
const payloadOf = (token: string) => JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8")) as { id: string; iat: number };
const signatureValid = (token: string) => createHmac("sha256", E2E_BOOKING_CONTEXT_SECRET).update(token.split(".")[0]).digest("base64url") === token.split(".")[1];

// How many times the database was asked about these inquiries (ids only this test uses).
const lookupsOf = async (ids: string[]) => ((await (await fetch(`${FAKE_DB}/__hits`)).json()) as string[]).filter((hit) => ids.includes(hit)).length;

// The rendered page without scripts: Next puts the request URL, and so the reference, into its own
// page data, but the application must never write the reference into anything people read.
const renderedMarkup = (page: Page) =>
  page.evaluate(() => {
    const body = document.body.cloneNode(true) as HTMLElement;
    body.querySelectorAll("script").forEach((script) => script.remove());
    return body.outerHTML;
  });

const COPY = {
  en: { schedule: "Choose a call time", booked: "Your call is already scheduled", closed: "We already have a call for this inquiry", unavailable: "This link can't be used", error: "We couldn't check your booking just now", scheduler: "Schedule your discovery call", restart: "Start a new inquiry" },
  ar: { schedule: "اختر وقت المكالمة", booked: "موعد مكالمتك محجوز بالفعل", closed: "لدينا مكالمة مسجّلة لهذا الطلب", unavailable: "تعذّر استخدام هذا الرابط", error: "تعذّر التحقق من حجزك الآن", scheduler: "احجز موعد المكالمة التعريفية", restart: "أرسل طلبًا جديدًا" },
} as const;

async function open(page: Page, locale: "en" | "ar", ref?: string) {
  await installCalEmbedMock(page);
  await page.goto(`/${locale}/book${ref === undefined ? "" : `?ref=${encodeURIComponent(ref)}`}`);
}
const heading = (page: Page) => page.getByRole("heading", { level: 1 });
const schedulerRegion = (page: Page, locale: "en" | "ar") => page.getByRole("region", { name: COPY[locale].scheduler });

for (const locale of ["en", "ar"] as const) {
  const c = COPY[locale];

  test.describe(`${locale}: recovery link states`, () => {
    for (const [name, inquiry] of [["not booked", INQUIRIES.NOT_BOOKED], ["cancelled", INQUIRIES.CANCELLED]] as const) {
      test(`${name}: shows the scheduler, linked to the same inquiry through a fresh reference`, async ({ page }) => {
        const old = reference(inquiry, 20);
        await open(page, locale, old);
        await expect(heading(page)).toHaveText(c.schedule);
        await expect(schedulerRegion(page, locale)).toBeVisible();
        await expect.poll(async () => (await getRecordedInlineCalls(page)).length).toBe(1);
        const calls = await getRecordedInlineCalls(page);
        expect(calls[0].calLink).toBe("mintapp/mintapp-discovery-call");
        const fresh = String(calls[0].config["metadata[bookingContext]"]);
        expect(signatureValid(fresh)).toBe(true);
        expect(payloadOf(fresh).id).toBe(inquiry); // never detached from its inquiry
        expect(payloadOf(fresh).iat).toBeGreaterThan(payloadOf(old).iat); // a booking started now cannot expire half way
      });
    }

    test("booked: no second scheduler, the existing booking and Cal.com's own page to manage it", async ({ page }) => {
      await open(page, locale, reference(INQUIRIES.BOOKED, 3));
      await expect(heading(page)).toHaveText(c.booked);
      await expect(schedulerRegion(page, locale)).toHaveCount(0);
      expect(await getRecordedInlineCalls(page)).toHaveLength(0); // nothing that could start another booking
      const manage = page.locator('a[href="https://cal.com/booking/gFLmqHeVSGvyGLoE6DK8Wi"]');
      await expect(manage).toHaveCount(1);
      await expect(manage).toHaveAttribute("target", "_blank");
      await expect(manage).toHaveAttribute("rel", /noopener/);
      await expect(page.locator("main")).toContainText("2026"); // the meeting time
      await expect(page.locator('main a[href="mailto:hello@mintapp.tech"]')).toHaveCount(1);
    });

    test("booked, with a booking id that is not a plain Cal.com id: still booked, no management link", async ({ page }) => {
      await open(page, locale, reference(INQUIRIES.BOOKED_ODD_UID));
      await expect(heading(page)).toHaveText(c.booked);
      await expect(page.locator('main a[href^="https://cal.com"]')).toHaveCount(0);
      await expect(schedulerRegion(page, locale)).toHaveCount(0);
    });

    test("completed: no scheduler, asks them to write to us", async ({ page }) => {
      await open(page, locale, reference(INQUIRIES.COMPLETED));
      await expect(heading(page)).toHaveText(c.closed);
      await expect(schedulerRegion(page, locale)).toHaveCount(0);
      expect(await getRecordedInlineCalls(page)).toHaveLength(0);
      await expect(page.locator('main a[href="mailto:hello@mintapp.tech"]')).toHaveCount(1);
    });

    test("a database fault fails closed: no scheduler that could create an unlinked booking", async ({ page }) => {
      await open(page, locale, reference(INQUIRIES.DATABASE_FAULT));
      await expect(heading(page)).toHaveText(c.error);
      await expect(schedulerRegion(page, locale)).toHaveCount(0);
      expect(await getRecordedInlineCalls(page)).toHaveLength(0);
      await expect(page.locator("main")).not.toContainText("synthetic database fault"); // no technical detail
    });

    test("every unusable link gets the same page, and a bad one never reaches the database", async ({ page }) => {
      const probe = PROBES[locale];
      const good = reference(probe.guarded);
      const tampered = good.slice(0, 10) + (good[10] === "A" ? "B" : "A") + good.slice(11);
      // The same signature bytes spelled differently: only the final character has spare bits.
      const [goodPayload, goodSignature] = good.split(".");
      const goodBytes = Buffer.from(goodSignature, "base64url");
      const alternates = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"]
        .map((ch) => goodSignature.slice(0, -1) + ch)
        .filter((spelling) => spelling !== goodSignature && Buffer.from(spelling, "base64url").equals(goodBytes));
      expect(alternates).toHaveLength(3);
      const cases: [string, string | undefined, number][] = [
        ["missing", undefined, 0],
        ["garbage", "not-a-reference", 0],
        ["tampered", tampered, 0],
        ...alternates.map((spelling, i): [string, string, number] => [`non-canonical signature spelling ${i + 1}`, `${goodPayload}.${spelling}`, 0]),
        ["padded signature", `${good}=`, 0],
        ["expired (31 days)", reference(probe.guarded, 31), 0],
        ["signed with another secret", reference(probe.guarded, 1, "someone-elses-secret"), 0],
        ["genuine reference, no such inquiry", reference(probe.unknown), 1],
        ["genuine reference, deleted inquiry", reference(probe.deleted), 1],
      ];
      let firstText: string | null = null;
      for (const [name, ref, expectedLookups] of cases) {
        const before = await lookupsOf(Object.values(probe));
        await open(page, locale, ref);
        await expect(heading(page), name).toHaveText(c.unavailable);
        await expect(schedulerRegion(page, locale), name).toHaveCount(0);
        expect(await getRecordedInlineCalls(page), name).toHaveLength(0);
        expect((await lookupsOf(Object.values(probe))) - before, name).toBe(expectedLookups);
        // The visible page is identical in every case: it cannot tell anyone whether a record exists.
        const text = (await page.locator("main").innerText()).replace(/\s+/g, " ");
        firstText ??= text;
        expect(text, name).toBe(firstText);
        if (ref) expect(await renderedMarkup(page), name).not.toContain(ref);
      }
      await expect(page.locator(`main a[href="/${locale}/start"]`)).toHaveText(c.restart);
      await expect(page.locator('main a[href="mailto:hello@mintapp.tech"]')).toHaveCount(1);
    });

    test("the reference is not echoed back into the page when there is no scheduler", async ({ page }) => {
      const ref = reference(INQUIRIES.BOOKED);
      await open(page, locale, ref);
      await expect(heading(page)).toHaveText(c.booked);
      expect(await renderedMarkup(page)).not.toContain(ref);
    });
  });
}

test.describe("private page: never cached, indexed or passed on", () => {
  test("not cached, not indexed, no referrer, and not in the sitemap", async ({ page, request }) => {
    const response = await page.goto(`/en/book?ref=${encodeURIComponent(reference(INQUIRIES.BOOKED))}`);
    // Production sends no-store; the dev server used here sends no-cache. Either way, nothing caches it.
    const cacheControl = response?.headers()["cache-control"] ?? "";
    expect(cacheControl).toMatch(/no-store|no-cache/);
    expect(cacheControl).not.toMatch(/public|s-maxage|max-age=[1-9]/);
    const robots = await page.locator('meta[name="robots"]').getAttribute("content");
    expect(robots).toContain("noindex");
    expect(robots).toContain("nofollow");
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");
    expect(await (await request.get("/sitemap.xml")).text()).not.toContain("/book");
  });
});

test.describe("every state is accessible, readable and fits every screen", () => {
  const states: [string, string | undefined][] = [
    ["schedule", reference(INQUIRIES.NOT_BOOKED)],
    ["booked", reference(INQUIRIES.BOOKED)],
    ["closed", reference(INQUIRIES.COMPLETED)],
    ["unavailable", undefined],
    ["error", reference(INQUIRIES.DATABASE_FAULT)],
  ];

  for (const locale of ["en", "ar"] as const) {
    for (const [state, ref] of states) {
      test(`${locale} ${state}: no accessibility violations, correct direction, no overflow at 320, 390 and 1280`, async ({ page }) => {
        for (const width of [320, 390, 1280]) {
          await page.setViewportSize({ width, height: 900 });
          await open(page, locale, ref);
          await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
          await expect(heading(page)).toBeVisible();
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px overflow`).toBe(true);
        }
        await page.waitForTimeout(1200);
        const violations = (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze()).violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => `${n.target.join(" ")} :: ${n.any.map((a) => a.message).join("; ")}`),
        }));
        expect(violations).toEqual([]);
      });
    }
  }
});

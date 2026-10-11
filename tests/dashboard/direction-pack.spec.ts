import { test, expect, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { PACK_PORT } from "../../playwright.pack.config";
import { signInAs } from "./helpers";

// The Direction Pack, on the curated review dataset loaded locally exactly as the owner
// will load it (scripts/admin-local.mjs --seed review): the complete Lotus Dental Care
// case presented and exported, the Arabic case previewed, and the longest content the
// Pack allows drawn without clipping. Synthetic data only; no AI service.
const LOTUS = "5eed0000-0000-4000-8000-000000000009"; // en, all three parts approved
const SANABEL = "5eed0000-0000-4000-8000-000000000005"; // ar, in review
const CEDAR = "5eed0000-0000-4000-8000-000000000001"; // en, no Pack yet
const SARA = "5eed0000-0000-4000-8000-000000000002"; // ar, no Pack yet
const OMAR = "omar.demo@mintapp.local";
const ORIGIN = `http://localhost:${PACK_PORT}`;
const SHOTS = "review-evidence/direction-pack";

test.describe.configure({ mode: "serial" });
mkdirSync(SHOTS, { recursive: true });

const signIn = (browser: Browser): Promise<Page> => signInAs(browser, OMAR, ORIGIN);
const axe = async (page: Page, include?: string) => {
  const builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]);
  return (await (include ? builder.include(include) : builder).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
};
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
// Every slide's content fits its 1280 x 720 stage: nothing clipped, nothing spilling.
const clipped = async (page: Page) => {
  await page.waitForLoadState("networkidle");
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>(".dp-slide")).flatMap((slide, i) => {
      const body = slide.querySelector<HTMLElement>(".dp-body");
      const out: string[] = [];
      if (body && (body.scrollHeight > body.clientHeight + 1 || body.scrollWidth > body.clientWidth + 1)) out.push(`slide ${i + 1}: body ${body.scrollWidth}x${body.scrollHeight} in ${body.clientWidth}x${body.clientHeight}`);
      const stage = slide.querySelector<HTMLElement>(".dp-stage")!;
      if (stage.scrollHeight > stage.clientHeight + 1 || stage.scrollWidth > stage.clientWidth + 1) out.push(`slide ${i + 1}: stage overflows`);
      return out;
    }),
  );
};
const pdfInfo = (pdf: Buffer) => {
  const text = pdf.toString("latin1");
  const box = text.match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/);
  return { pages: (text.match(/\/Type\s*\/Page\b(?!s)/g) ?? []).length, width: Number(box?.[1]), height: Number(box?.[2]) };
};

// The longest content the Pack allows, written without any figure, promise or claim.
const words = (lang: "en" | "ar", n: number) => {
  const vocab = lang === "ar" ? ["الحجز", "المواعيد", "العملاء", "الفريق", "الجدول", "الطلبات", "المتابعة", "الاستلام", "الرسائل", "الأولوية"] : ["booking", "schedule", "patients", "front", "desk", "reminders", "clinics", "visits", "changes", "requests"];
  let s = "";
  for (let i = 0; s.length < n; i++) s += (s ? " " : "") + vocab[i % vocab.length];
  return s.slice(0, n).trim();
};
function longest(lang: "en" | "ar", quote: string) {
  const w = (n: number) => words(lang, n);
  const statement = (n: number) => Array.from({ length: n }, () => ({ text: w(300), basis: "assumption" }));
  return {
    language: lang,
    client_facts: Array.from({ length: 12 }, () => ({ text: w(300), evidence: quote })),
    assumptions: Array.from({ length: 10 }, () => ({ text: w(300), reason: w(300) })),
    missing_information: Array.from({ length: 10 }, () => w(200)),
    business_context: statement(4),
    users: Array.from({ length: 4 }, () => ({ group: w(80), needs: w(240), basis: "assumption" })),
    problem: statement(4),
    goals: statement(5),
    design_blueprint: { pattern: lang === "ar" ? "booking_site" : "scheduling_app", direction: w(400), hierarchy: Array.from({ length: 6 }, () => w(200)), responsive_notes: w(300), brand_context: w(240) },
    screens: (lang === "ar" ? ["services", "booking_form", "confirmation", "faq"] : ["booking_form", "schedule_calendar", "record_table", "record_detail"]).map((template, i) => ({
      id: `s${i + 1}`,
      template,
      title: w(80),
      purpose: w(240),
      headline: w(120),
      supporting_text: w(240),
      items: Array.from({ length: template === "confirmation" ? 4 : template === "faq" ? 5 : 6 }, () => ({ title: w(60), text: w(160) })),
      primary_action: w(40),
      secondary_action: w(40),
    })),
    user_flow: Array.from({ length: 6 }, (_, i) => ({ step: w(160), screen: `s${(i % 4) + 1}` })),
    scope_direction: { first_release: Array.from({ length: 8 }, () => w(200)), later: Array.from({ length: 6 }, () => w(200)), not_included: Array.from({ length: 8 }, () => w(200)) },
    proposal_direction: { pattern: lang === "ar" ? "website" : "web_app", approach: w(600), phases: Array.from({ length: 4 }, () => ({ name: w(80), summary: w(300) })), deliverables: Array.from({ length: 8 }, () => w(200)), cost_schedule_factors: Array.from({ length: 8 }, () => w(240)) },
    discovery_questions: Array.from({ length: 10 }, () => ({ question: w(250), purpose: w(250), bank: "operations" })),
    decisions_needed: Array.from({ length: 6 }, () => w(200)),
    risks: Array.from({ length: 6 }, () => ({ risk: w(240), why: w(240) })),
    meeting_agenda: Array.from({ length: 8 }, () => ({ item: w(120), purpose: w(200) })),
    next_steps: Array.from({ length: 5 }, () => w(240)),
  };
}

test("private: the presentation needs a signed-in founder, is never indexed and never cached", async ({ page, request, browser }) => {
  await page.goto(`/present/${LOTUS}`);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator("body")).not.toContainText("Lotus Dental");
  const raw = await request.get(`/present/${LOTUS}`, { maxRedirects: 0 });
  expect([302, 303, 307, 308]).toContain(raw.status());
  const omar = await signIn(browser);
  const res = await omar.goto(`/present/${LOTUS}`);
  // The production build sends "private, no-store" (tests/build); the dev server its own no-cache.
  expect(res!.headers()["cache-control"]).toMatch(/no-store|no-cache/);
  expect(res!.headers()["cache-control"]).not.toMatch(/public|s-maxage|max-age=[1-9]/);
  expect(res!.headers()["x-robots-tag"]).toMatch(/noindex/);
  await expect(omar.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
  await omar.context().close();
});

test("the curated dataset: readable leads in every position, English and Arabic, with and without a company", async ({ browser }) => {
  const page = await signIn(browser);
  await page.goto("/leads");
  await expect(page.locator("[data-lead]")).toHaveCount(10);
  const text = (await page.locator("[data-leads]").textContent()) ?? "";
  expect(text).not.toMatch(/\d{6,}|@/);
  for (const name of ["Lotus Dental Care", "Cedar Physio Clinics", "مخبز السنابل", "سارة منصور", "Brightpath Tutors", "Karim Nassar"]) expect(text).toContain(name);
  for (const stage of ["new", "reviewing", "meeting", "qualified", "proposal", "decision", "closed"]) {
    await page.goto(`/leads?stage=${stage}`);
    expect(await page.locator("[data-lead]").count(), stage).toBeGreaterThan(0);
  }
  await page.goto("/dashboard");
  await expect(page.locator('[data-section="packs"]')).toContainText("مخبز السنابل");
  await page.screenshot({ path: `${SHOTS}/dashboard.png`, fullPage: true });
  await page.context().close();
});

test("the complete case on the Pack tab: three approved parts, an edit and what it changed, checks passed, ready to present", async ({ browser }) => {
  const page = await signIn(browser);
  await page.goto(`/leads/${LOTUS}/pack`);
  await expect(page.locator("#pack-state [data-pack-state]")).toHaveText("Approved for meeting");
  for (const part of ["design", "proposal", "discovery"]) {
    await expect(page.locator(`[data-artifact="${part}"] [data-review]`)).toHaveAttribute("data-review", "approved");
    await expect(page.locator(`[data-artifact="${part}"] [data-checks]`)).toHaveAttribute("data-checks", "passed");
  }
  const design = page.locator('[data-artifact="design"]');
  await expect(design.locator("[data-source]")).toHaveText("Edited by hand");
  await design.locator("[data-changes] > summary").click();
  await expect(design.locator("[data-added]")).toContainText("Fewer missed appointments.");
  await expect(design.locator('[data-basis="client_fact"]').first()).toBeVisible();
  await expect(design.locator('[data-basis="assumption"]').first()).toBeVisible();
  const card = page.locator("[data-direction-pack-card]");
  await expect(card).toHaveAttribute("data-direction-pack-card", "ready");
  await expect(card).toContainText("product direction 4, scope 2, meeting plan 3");
  expect(await axe(page)).toEqual([]);
  await page.screenshot({ path: `${SHOTS}/lotus-pack.png`, fullPage: true });
  await page.context().close();
});

test("present: every slide from cover to agenda, from the approved versions only, fitting the 16:9 stage, with the keyboard", async ({ browser }) => {
  const page = await signIn(browser);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/leads/${LOTUS}/pack`);
  await page.locator("[data-present]").click();
  await expect(page).toHaveURL(new RegExp(`/present/${LOTUS}$`));
  const deck = page.locator("[data-direction-pack]");
  await expect(deck).toHaveAttribute("data-pack-version", "4.2.3");
  await expect(deck).toHaveAttribute("dir", "ltr");
  const slides = page.locator(".dp-slide");
  const count = await slides.count();
  expect(count).toBeGreaterThanOrEqual(15);
  await expect(slides.first()).toContainText("Lotus Dental Care");
  await expect(slides.first()).toContainText("Web application");
  for (const title of ["What we understood", "Users and goals", "What you told us, and what we assume", "Initial product direction", "Concept screen 1 of 4", "Concept screen 4 of 4", "The main user journey", "Recommended first release", "Indicative proposal direction", "Open questions and decisions", "Risks and constraints", "Today's agenda and next steps"]) {
    await expect(deck.locator(".dp-title", { hasText: title }).first(), title).toBeVisible();
  }
  // The proposal direction always says it is not final.
  await expect(deck.locator(".dp-banner").first()).toContainText("not a quote or a commitment");
  // Facts and assumptions stay labelled on the slides.
  await expect(deck.locator('.dp-tag[data-tag="client_fact"]').first()).toBeVisible();
  await expect(deck.locator('.dp-tag[data-tag="assumption"]').first()).toBeVisible();
  // Each slide is a 16:9 box.
  const box = await slides.nth(3).boundingBox();
  expect(Math.abs(box!.width / box!.height - 16 / 9)).toBeLessThan(0.01);
  expect(await clipped(page)).toEqual([]);
  // The keyboard moves between slides.
  await page.locator("body").click({ position: { x: 5, y: 300 } });
  await page.keyboard.press("Home");
  await expect(page.locator("[data-slide-counter]")).toHaveText(`Slide 1 of ${count}`);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("[data-slide-counter]")).toHaveText(`Slide 2 of ${count}`);
  await page.keyboard.press("End");
  await expect(page.locator("[data-slide-counter]")).toHaveText(`Slide ${count} of ${count}`);
  await expect(page.locator("[data-export]")).toHaveCount(2);
  expect(await axe(page)).toEqual([]);
  for (const i of [0, 1, 4, 5, 9]) await slides.nth(i).screenshot({ path: `${SHOTS}/lotus-slide-${i + 1}.png` });
  // A very wide screen fits too.
  await page.setViewportSize({ width: 1920, height: 1080 });
  expect(await clipped(page)).toEqual([]);
  await page.context().close();
});

test("export: real PDFs, one 16:9 page per slide or one A4 page per slide, without the controls", async ({ browser }) => {
  const page = await signIn(browser);
  await page.goto(`/present/${LOTUS}`);
  const count = await page.locator(".dp-slide").count();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".dp-toolbar")).toBeHidden();
  const slides = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  writeFileSync(`${SHOTS}/lotus-direction-pack-16x9.pdf`, slides);
  const s = pdfInfo(slides);
  expect(s.pages).toBe(count);
  expect(Math.round(s.width)).toBe(960);
  expect(Math.round(s.height)).toBe(540);
  // A4, as the "Export PDF (A4)" button sets it.
  await page.evaluate(() => {
    document.querySelector<HTMLElement>(".dp-root")!.dataset.print = "a4";
    document.getElementById("dp-page")!.textContent = "@page{size:A4 landscape;margin:0}";
  });
  const a4 = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  writeFileSync(`${SHOTS}/lotus-direction-pack-a4.pdf`, a4);
  const a = pdfInfo(a4);
  expect(a.pages).toBe(count);
  expect(Math.round(a.width)).toBe(842);
  expect(Math.round(a.height)).toBe(595);
  await page.context().close();
});

test("Arabic: a Pack in review can be previewed right to left, watermarked; it cannot be presented or printed", async ({ browser }) => {
  const page = await signIn(browser);
  await page.goto(`/leads/${SANABEL}/pack`);
  const card = page.locator("[data-direction-pack-card]");
  await expect(card).toHaveAttribute("data-direction-pack-card", "not-ready");
  await expect(card.locator('[data-blocker="not_approved"]')).toHaveCount(2);
  await expect(card.locator("[data-present]")).toHaveCount(0);
  await card.locator("[data-preview]").click();
  await expect(page).toHaveURL(new RegExp(`/present/${SANABEL}\\?mode=preview$`));
  const deck = page.locator("[data-direction-pack]");
  await expect(deck).toHaveAttribute("dir", "rtl");
  await expect(deck).toHaveAttribute("lang", "ar");
  await expect(deck.locator(".dp-title", { hasText: "الاتجاه المبدئي للمنتج" })).toBeVisible();
  await expect(page.locator(".dp-watermark").first()).toBeVisible();
  await expect(page.locator("[data-export]")).toHaveCount(0);
  expect(await clipped(page)).toEqual([]);
  expect(await axe(page)).toEqual([]);
  await page.locator(".dp-slide").nth(4).screenshot({ path: `${SHOTS}/sanabel-preview-slide-5.png` });
  // Printing a preview prints a notice, not the deck.
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".dp-deck")).toBeHidden();
  await expect(page.locator(".dp-print-blocked")).toBeVisible();
  // The approved presentation itself says why it is not ready.
  await page.emulateMedia({ media: "screen" });
  await page.goto(`/present/${SANABEL}`);
  await expect(page.locator("[data-direction-pack-blocked]")).toContainText("not approved yet");
  await page.context().close();
});

test("the longest content the Pack allows, in English and Arabic, is drawn without clipping", async ({ browser }) => {
  test.setTimeout(240_000);
  const page = await signIn(browser);
  for (const [id, lang, quote] of [
    [CEDAR, "en", "Patients book by phone"],
    [SARA, "ar", "أعطي دروسًا خصوصية في الرياضيات"],
  ] as const) {
    await page.goto(`/leads/${id}/pack`);
    await page.locator("#paste-pack").fill(JSON.stringify(longest(lang, quote)));
    await page.getByRole("button", { name: "Check and save the pack" }).click();
    await expect(page.locator('[data-artifact="discovery"] [data-version]')).toBeVisible();
    await page.goto(`/present/${id}?mode=preview`);
    const slides = await page.locator(".dp-slide").count();
    expect(slides, lang).toBeGreaterThan(14);
    expect(await clipped(page), lang).toEqual([]);
    await page.locator(".dp-slide").nth(3).screenshot({ path: `${SHOTS}/longest-${lang}-slide-4.png` });
  }
  await page.context().close();
});

test("reduced motion, phones and the reading column: nothing moves, nothing scrolls sideways, text stays readable", async ({ browser }) => {
  const page = await signIn(browser);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/present/${LOTUS}`);
  await page.keyboard.press("PageDown");
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  for (const [width, height] of [[390, 844], [768, 1024]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto(`/present/${LOTUS}`);
    expect(await overflow(page), `${width}px`).toBeLessThanOrEqual(0);
    const size = await page.locator(".dp-item").first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize) * (parseFloat(getComputedStyle(el.closest(".dp-slide")!).zoom || "1")));
    expect(size, `${width}px`).toBeGreaterThanOrEqual(width < 700 ? 15 : 8);
    if (width < 700) await page.screenshot({ path: `${SHOTS}/lotus-phone.png`, fullPage: false });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/present/${SANABEL}?mode=preview`);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  expect(await axe(page)).toEqual([]);
  await page.context().close();
});

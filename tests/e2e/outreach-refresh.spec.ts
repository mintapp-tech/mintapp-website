import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// The outreach refresh: the free first meeting, five services and the founding
// team, in both languages and at the widths the layout changes at.

const COPY = {
  en: {
    badge: "Free first discovery meeting · No commitment",
    step: "A free discovery meeting that starts from your context",
    services: ["Websites", "Web applications", "Mobile applications", "Product design & UI/UX", "Internal systems & automation"],
    servicesTitle: "Digital products built around real business needs",
    team: "Founding team",
    teamIntro: "supported by designers, engineers and specialists selected around each project",
    names: ["Omar Abdelaziz", "Abdelrahman (Adam) Eba"],
    role: "Founder",
    linkedin: "Omar Abdelaziz on LinkedIn (opens in a new tab)",
  },
  ar: {
    badge: "الاجتماع الاستكشافي الأول مجاني · بدون التزام",
    step: "اجتماع استكشافي مجاني",
    services: ["مواقع إلكترونية", "تطبيقات ويب", "تطبيقات موبايل", "تصميم المنتج وتجربة المستخدم", "الأنظمة الداخلية والأتمتة"],
    servicesTitle: "منتجات رقمية مبنية حول احتياجات عمل حقيقية",
    team: "الفريق المؤسس",
    teamIntro: "مصممون ومهندسون ومتخصصون يتم اختيارهم",
    names: ["عمر عبد العزيز", "Abdelrahman (Adam) Eba"],
    role: "المؤسس",
    linkedin: "عمر عبد العزيز على LinkedIn (يفتح في علامة تبويب جديدة)",
  },
} as const;

const WIDTHS = [
  { name: "large desktop", width: 1920, height: 1080, rows: [3, 2] },
  { name: "laptop", width: 1280, height: 800, rows: [3, 2] },
  { name: "tablet", width: 820, height: 1180, rows: [2, 2, 1] },
  { name: "360px phone", width: 360, height: 760, rows: [1, 1, 1, 1, 1] },
];

const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

// The service cards grouped into visual rows, with how much of the grid each row fills.
async function serviceRows(page: Page) {
  return page.locator("#services h3").first().evaluate((h) => {
    const grid = h.parentElement!.parentElement!;
    const outer = grid.getBoundingClientRect();
    const rows = new Map<number, { count: number; width: number }>();
    for (const card of Array.from(grid.children) as HTMLElement[]) {
      // Layout position, unaffected by the reveal animation's transform.
      const row = rows.get(card.offsetTop) ?? { count: 0, width: 0 };
      rows.set(card.offsetTop, { count: row.count + 1, width: row.width + card.offsetWidth });
    }
    return [...rows.values()].map((r) => ({ count: r.count, fill: r.width / outer.width }));
  });
}

for (const locale of ["en", "ar"] as const) {
  const c = COPY[locale];

  test(`${locale}: the free first meeting sits right under the hero calls to action and in step three`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/${locale}`, { waitUntil: "networkidle" });
    const hero = page.locator("main > section").first();
    const badge = hero.locator("[data-free-meeting]");
    await expect(badge).toHaveText(c.badge);
    await expect(badge).toBeInViewport();
    const cta = hero.locator(`a[href="/${locale}/start"]`);
    const gap = async () => (await badge.boundingBox())!.y - ((await cta.boundingBox())!.y + (await cta.boundingBox())!.height);
    await expect.poll(gap).toBeGreaterThanOrEqual(0);
    await expect.poll(gap).toBeLessThanOrEqual(40);
    await expect(page.locator("#process ol > li").nth(2)).toContainText(c.step);
    await expect(page.locator("#process ol > li")).toHaveCount(4);
  });

  for (const path of ["", "/services", "/start", "/about", "/privacy"]) {
    test(`${locale}${path || "/"}: no meeting duration is advertised`, async ({ page }) => {
      await page.goto(`/${locale}${path}`, { waitUntil: "networkidle" });
      const text = `${await page.locator("body").innerText()} ${await page.locator('meta[name="description"]').getAttribute("content")}`;
      expect(text).not.toMatch(/\b\d+\s*-?\s*min(ute)?s?\b|[0-9٠-٩]+\s*دقيقة|دقيقة[^.]{0,12}[0-9٠-٩]|نصف ساعة/i);
    });
  }

  for (const vp of WIDTHS) {
    test(`${locale} ${vp.name}: five service cards fill every row, with no overflow`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`/${locale}`, { waitUntil: "networkidle" });
      await expect(page.locator("#services h2")).toHaveText(c.servicesTitle);
      await expect(page.locator("#services h3")).toHaveText([...c.services]);
      const rows = await serviceRows(page);
      expect(rows.map((r) => r.count)).toEqual(vp.rows);
      // No card is left alone beside empty space.
      for (const row of rows) expect(row.fill).toBeGreaterThan(0.93);
      expect(await noOverflow(page)).toBe(true);
    });

    test(`${locale} ${vp.name}: the Services page and the founding team fit`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`/${locale}/services`, { waitUntil: "networkidle" });
      await expect(page.locator("main h1")).toHaveCount(1);
      await expect(page.locator("main h2")).toHaveText([...c.services]);
      expect(await noOverflow(page)).toBe(true);
      await page.goto(`/${locale}/about`, { waitUntil: "networkidle" });
      await expect(page.locator("#team article")).toHaveCount(2);
      expect(await noOverflow(page)).toBe(true);
    });
  }

  test(`${locale}: Services page related links point at published case studies, none for internal systems`, async ({ page }) => {
    await page.goto(`/${locale}/services`, { waitUntil: "networkidle" });
    const links = page.locator(`main a[href^="/${locale}/work/"]`);
    await expect(links).toHaveCount(3);
    expect(await links.evaluateAll((els) => els.map((e) => e.getAttribute("href")))).toEqual(["arrentio", "rentop", "whhr"].map((s) => `/${locale}/work/${s}`));
    // Three links with the same visible words each get a distinct name.
    const names = await links.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
    expect(new Set(names).size).toBe(3);
  });

  test(`${locale}: the Fiverr caption names Adam as Co-Founder`, async ({ page }) => {
    await page.goto(`/${locale}`, { waitUntil: "networkidle" });
    await expect(page.locator("#fiverr-reviews")).toContainText(locale === "en" ? "Adam Eba, Co-Founder of Mintapp" : "Adam Eba، الشريك المؤسس في Mintapp");
  });

  test(`${locale}: the founding team lists Omar first with an accessible, safe LinkedIn link`, async ({ page }) => {
    await page.goto(`/${locale}`, { waitUntil: "networkidle" });
    const team = page.locator("#team");
    await expect(team.locator("h2")).toHaveText(c.team);
    await expect(team).toContainText(c.teamIntro);
    await expect(team.locator("h3")).toHaveText([...c.names]);
    const omar = team.locator("article").first();
    await expect(omar.getByText(c.role, { exact: true })).toBeVisible();
    const link = omar.getByRole("link", { name: c.linkedin });
    await expect(link).toHaveAttribute("href", "https://www.linkedin.com/in/omarabdelaziz26");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    await expect(team.locator("article").nth(1).getByRole("link")).toHaveCount(0);
    // The photo is decorative, so the name is announced once.
    const photo = omar.locator("img");
    await expect(photo).toHaveAttribute("alt", "");
    await expect(omar.getByRole("img")).toHaveCount(0);
    await photo.scrollIntoViewIfNeeded();
    await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  });

  test(`${locale}: the changed sections pass the accessibility scan`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const [path, include] of [["", "#process, #testimonials, #team, #services"], ["/services", "main"], ["/about", "#team"]] as const) {
      await page.goto(`/${locale}${path}`, { waitUntil: "networkidle" });
      const results = await new AxeBuilder({ page }).include(include).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(results.violations.map((v) => `${path || "/"} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    }
    await page.goto(`/${locale}`, { waitUntil: "networkidle" });
    const hero = await new AxeBuilder({ page }).include("[data-free-meeting]").withTags(["wcag2aa"]).analyze();
    expect(hero.violations.map((v) => v.id)).toEqual([]);
  });
}

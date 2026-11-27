import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { en } from "./en";
import { ar } from "./ar";

const FIVE = {
  en: ["Websites", "Web applications", "Mobile applications", "Product design & UI/UX", "Internal systems & automation"],
  ar: ["مواقع إلكترونية", "تطبيقات ويب", "تطبيقات موبايل", "تصميم المنتج وتجربة المستخدم", "الأنظمة الداخلية والأتمتة"],
};

// A meeting length in any of the ways it could be written ("min-h-..." classes excluded).
const DURATION = /\b\d+\s*-?\s*min(ute)?s?\b(?!-)|\bthirty[ -]minute|half[ -]an?[ -]hour|[0-9٠-٩]+\s*دقيقة|دقيقة[^.]{0,12}[0-9٠-٩]|نصف ساعة/i;

describe("no public meeting duration", () => {
  test("the matcher catches the wordings that were removed", () => {
    for (const old of ["A 30-minute call", "30 minutes", "مكالمة مدتها 30 دقيقة", "(30 دقيقة)", "٣٠ دقيقة"]) expect(old).toMatch(DURATION);
  });

  test("no application source mentions how long the meeting is", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
          // Code comments about timeouts are not customer-facing.
          const copy = readFileSync(path, "utf8").replace(/\/\/[^\n]*/g, "");
          if (DURATION.test(copy)) offenders.push(path);
        }
      }
    };
    walk(join(process.cwd(), "src"));
    expect(offenders).toEqual([]);
  });
});

describe("homepage positioning copy", () => {
  test("English hero is the approved wording", () => {
    expect(en.hero.eyebrow).toBe("Digital product studio");
    expect(en.hero.freeMeeting).toBe("Free first discovery meeting · No commitment");
    expect(en.hero.title).toBe("Your first meeting starts with direction, not a blank page.");
    expect(en.hero.sub).toBe("Share your idea. If we're the right fit, we review it before the call and arrive with context, questions and a clear next step.");
    expect(en.hero.cta1).toBe("Start a project");
    expect(en.hero.cta2).toBe("View selected work");
    expect(en.hero.fit).toBe("Mintapp works best with founders and teams ready to turn a real business need into a focused digital product.");
    expect(en.tagline).toBe("Software that feels easy");
    expect(en.work.title).toBe("Selected work");
  });

  test("the hero positioning line is about the studio, not a region", () => {
    expect(ar.hero.eyebrow).toBe("استوديو منتجات رقمية");
    expect(ar.hero.freeMeeting).toBe("الاجتماع الاستكشافي الأول مجاني · بدون التزام");
    for (const t of [en, ar]) expect(`${t.hero.eyebrow} ${t.hero.title} ${t.hero.sub}`).not.toMatch(/Egypt|MENA|مصر|المنطقة العربية/);
  });

  test("the geographic line is secondary, outside the hero, and open beyond the region", () => {
    expect(en.footer.based).toBe("Based in Egypt. Working with teams across MENA and beyond.");
    expect(ar.footer.based).toBe("مقرّنا في مصر، ونعمل مع فرق في المنطقة العربية وخارجها.");
    expect(ar.footer.based).toMatch(/وخارجها/);
  });

  test("the direction board asks the six first-call discovery questions", () => {
    expect(en.hero.board.fragments).toEqual([
      "Who is it for?",
      "What problem are we solving?",
      "What already exists?",
      "What matters most first?",
      "What could block progress?",
      "What does success look like?",
    ]);
    expect(ar.hero.board.fragments).toEqual([
      "لمن هذا المنتج؟",
      "ما المشكلة التي نحلّها؟",
      "ما الموجود حاليًا؟",
      "ما الأهم في البداية؟",
      "ما الذي قد يعيق التقدّم؟",
      "كيف يبدو النجاح؟",
    ]);
    for (const t of [en, ar]) {
      expect(t.hero.board.idea).toBeTruthy();
      expect(t.hero.board.direction).toBeTruthy();
      expect(t.hero.board.context).toBeTruthy();
      expect(t.hero.board.next).toBeTruthy();
    }
  });

  test("the old tactical questions are gone", () => {
    const all = [...en.hero.board.fragments, ...ar.hero.board.fragments].join(" | ");
    for (const old of ["Web or mobile?", "What launches first?", "Arabic, English or both?", "Where is the risk?", "ويب أم موبايل؟", "ما الذي يُطلق أولًا؟", "عربي، إنجليزي أم الاثنان؟", "أين تكمن المخاطرة؟"]) {
      expect(all).not.toContain(old);
    }
  });

  test("How it works has the four approved steps, in order", () => {
    expect(en.proc.steps.map((s) => s.title)).toEqual(["Share your idea", "We review and prepare", "Meet with direction", "Build together"]);
    expect(ar.proc.steps).toHaveLength(4);
    expect(ar.proc.steps[1].points).toHaveLength(4);
  });

  test("Services covers the five public services, in order, in both languages", () => {
    expect(en.svc.items.map((s) => s.title)).toEqual(FIVE.en);
    expect(ar.svc.items.map((s) => s.title)).toEqual(FIVE.ar);
    expect(en.svc.title).toBe("Digital products built around real business needs");
    expect(ar.svc.title).toBe("منتجات رقمية مبنية حول احتياجات عمل حقيقية");
    for (const t of [en, ar]) for (const s of t.svc.items) expect([s.need, s.desc, ...s.points].every((x) => x.trim()), s.title).toBe(true);
  });

  test("the Services page lists the same five services and no longer calls automation a side capability", () => {
    expect(en.svcp.cats.map((c) => c.name)).toEqual(FIVE.en);
    expect(ar.svcp.cats.map((c) => c.name)).toEqual(FIVE.ar);
    expect(en.svcp.note).not.toMatch(/automation|headline service/i);
    expect(ar.svcp.note).not.toMatch(/الأتمتة|خدمات منفصلة/);
    // No wording that goes wrong when the number of services changes.
    expect(`${en.svc.title} ${en.svcp.title} ${en.svcp.sub}`).not.toMatch(/\b(two|three|five)\b/i);
    expect(`${ar.svc.title} ${ar.svcp.title} ${ar.svcp.sub}`).not.toMatch(/خدمتان|ثلاثة|خمس/);
  });

  test("the two newer services use the approved English descriptions on both pages", () => {
    const design = "Product strategy, user flows, interfaces and design systems that turn complex ideas into clear, build-ready products.";
    const systems = "Internal systems, dashboards and connected workflows that reduce manual work and give teams one reliable place to operate.";
    expect(en.svc.items.slice(3).map((s) => s.desc)).toEqual([design, systems]);
    expect(en.svcp.cats.slice(3).map((s) => s.desc)).toEqual([design, systems]);
  });

  test("related projects are only published case studies, and internal systems shows none", () => {
    for (const t of [en, ar]) {
      expect(t.svcp.cats.map((c) => c.related?.slug)).toEqual([undefined, "arrentio", "rentop", "whhr", undefined]);
      for (const c of t.svcp.cats) if (c.related) expect(existsSync(join(process.cwd(), "src/app/[locale]/work", c.related.slug, "page.tsx")), c.related.slug).toBe(true);
    }
  });

  test("the Fiverr caption names Adam as Co-Founder", () => {
    expect(en.fiverrReviews.source).toBe("Public reviews of Adam Eba, Co-Founder of Mintapp, quoted as written on his Fiverr profile.");
    expect(ar.fiverrReviews.source).toBe("تقييمات علنية لـ Adam Eba، الشريك المؤسس في Mintapp، منقولة كما كُتبت في ملفه على Fiverr.");
  });

  test("step three says the discovery meeting is free", () => {
    expect(en.proc.steps[2].desc).toBe("A free discovery meeting that starts from your context, our questions and a proposed next step—not a blank page.");
    expect(ar.proc.steps[2].desc).toMatch(/^اجتماع استكشافي مجاني/);
  });

  test.each([
    ["en", en],
    ["ar", ar],
  ] as const)("%s: only the discovery meeting is offered free; no proposal, design, estimate, report or preparation deliverable is promised", (_lang, t) => {
    // The only two approved places that say "free"; both are about the discovery meeting.
    expect(t.hero.freeMeeting).toMatch(/free first discovery meeting|الاجتماع الاستكشافي الأول مجاني/i);
    const stepThree = t.proc.steps[2].desc;
    expect(stepThree).toMatch(/free discovery meeting|اجتماع استكشافي مجاني/i);
    const promises = [
      t.hero.title,
      t.hero.sub,
      t.hero.fit,
      ...Object.values(t.hero.board).flat(),
      ...t.proc.steps.flatMap((s) => [s.title, s.desc === stepThree ? "" : s.desc, ...(s.points ?? [])]),
      ...t.svc.items.flatMap((s) => [s.need, s.desc, ...s.points]),
      t.final.title,
      t.final.sub,
    ].join(" ");
    expect(promises).not.toMatch(/free|proposal|estimate|quote|report|mockup|initial direction|مجان|عرض سعر|تقدير|تقرير|تصور مبدئي|اتجاهًا مبدئيًا/i);
    expect(JSON.stringify(t)).not.toMatch(/free (full )?consultation|free strategy|استشارة مجانية/i);
  });

  test("the note rules out pre-call deliverables in both languages", () => {
    expect(en.proc.note).toMatch(/don't send a proposal, design or estimate/);
    expect(ar.proc.note).toMatch(/^لا نرسل عرضًا أو تصميمًا أو تقديرًا/);
  });

  test.each([
    ["en", en],
    ["ar", ar],
  ] as const)("%s: no em dashes in the new homepage copy", (_lang, t) => {
    const copy = [t.hero.eyebrow, t.hero.title, t.hero.sub, t.hero.fit, t.proc.title, t.proc.note, t.svc.title, t.final.title, t.final.sub]
      // Step three carries the approved wording, which uses one.
      .concat(t.proc.steps.flatMap((s, i) => [s.title, i === 2 ? "" : s.desc, ...(s.points ?? [])]))
      .concat(t.svc.items.flatMap((s) => [s.title, s.need, s.desc, ...s.points]));
    for (const text of copy) expect(text).not.toContain("—");
  });
});

import { describe, expect, test } from "vitest";
import { en } from "./en";
import { ar } from "./ar";

describe("homepage positioning copy", () => {
  test("English hero is the approved wording", () => {
    expect(en.hero.eyebrow).toBe("Digital product studio · Web & mobile");
    expect(en.hero.title).toBe("Your first meeting starts with direction, not a blank page.");
    expect(en.hero.sub).toBe("Share your idea. If we're the right fit, we review it before the call and arrive with context, questions and a clear next step.");
    expect(en.hero.cta1).toBe("Start a project");
    expect(en.hero.cta2).toBe("View selected work");
    expect(en.hero.fit).toBe("Mintapp works best with founders and teams ready to turn a real business need into a focused digital product.");
    expect(en.tagline).toBe("Software that feels easy");
    expect(en.work.title).toBe("Selected work");
  });

  test("the hero positioning line is about the studio, not a region", () => {
    expect(ar.hero.eyebrow).toBe("استوديو منتجات رقمية · للويب والموبايل");
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

  test("Services covers exactly websites, web applications and mobile applications", () => {
    expect(en.svc.items.map((s) => s.title)).toEqual(["Websites", "Web applications", "Mobile applications"]);
    expect(ar.svc.items).toHaveLength(3);
  });

  test.each([
    ["en", en],
    ["ar", ar],
  ] as const)("%s: no free proposal, design, estimate, report or fixed preparation deliverable is promised", (_lang, t) => {
    const promises = [
      t.hero.title,
      t.hero.sub,
      t.hero.fit,
      ...Object.values(t.hero.board).flat(),
      ...t.proc.steps.flatMap((s) => [s.title, s.desc, ...(s.points ?? [])]),
      ...t.svc.items.flatMap((s) => [s.need, s.desc, ...s.points]),
      t.final.title,
      t.final.sub,
    ].join(" ");
    expect(promises).not.toMatch(/free|proposal|estimate|quote|report|mockup|initial direction|مجان|عرض سعر|تقدير|تقرير|تصور مبدئي|اتجاهًا مبدئيًا/i);
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
      .concat(t.proc.steps.flatMap((s) => [s.title, s.desc, ...(s.points ?? [])]))
      .concat(t.svc.items.flatMap((s) => [s.title, s.need, s.desc, ...s.points]));
    for (const text of copy) expect(text).not.toContain("—");
  });
});

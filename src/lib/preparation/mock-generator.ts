import type { GenerationInput } from "./input";
import type { PreparationGenerator } from "./generator";

// A deterministic, clearly labelled stand-in for a language model, so the
// whole workflow can run end to end with no provider. Its "facts" are the
// brief's own sentences, sorted by simple keyword rules; everything else is a
// template marked [MOCK]. It never makes anything up.

const sentencesOf = (text: string) =>
  text
    .split(/(?<=[.!?؟])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);

const RULES = {
  goals: /\b(want|need|would like|goal|aim|looking to|plan to)\b|نريد|نحتاج|نرغب|هدف|نسعى|نخطط/i,
  audience: /\b(customers?|users?|clients?|people|students?|patients?|drivers?|teams?|businesses)\b|العملاء|المستخدمين|عملاء|الطلاب|المرضى|السائقين|الشركات|الناس/i,
  existingMaterials: /\b(existing|already|currently|we have|our (website|app|system)|spreadsheet|excel)\b|حالي|لدينا|موجود|حاليا|جداول/i,
  constraints: /\b(budget|deadline|must|only|limited|cannot|before)\b|ميزانية|يجب|فقط|محدود|قبل/i,
} as const;

const COPY = {
  en: {
    summary: "[MOCK] Automated summary unavailable: this draft was produced by the mock generator from the brief's own sentences.",
    missing: { budget: "Budget range", timeline: "Preferred timeline", audience: "Who the main users are", goals: "What success looks like", existing: "What already exists (product, content, systems)" },
    questions: [
      { question: "[MOCK] Who will use this first, and what do they do today instead?", purpose: "Understand the audience and current workaround." },
      { question: "[MOCK] What would make the first release a success for you?", purpose: "Agree on goals before scope." },
      { question: "[MOCK] What already exists that we should build on or replace?", purpose: "Find existing materials and constraints." },
    ],
    scope: "[MOCK] Scope to be shaped with the client during the meeting.",
    next: "[MOCK] Review and edit this draft before the meeting.",
  },
  ar: {
    summary: "[MOCK] الملخص الآلي غير متاح: أُنتجت هذه المسودة بالمولّد التجريبي من جمل الوصف نفسها.",
    missing: { budget: "نطاق الميزانية", timeline: "الجدول الزمني المفضّل", audience: "من هم المستخدمون الرئيسيون", goals: "كيف يبدو النجاح", existing: "ما الموجود حاليًا (منتج، محتوى، أنظمة)" },
    questions: [
      { question: "[MOCK] من سيستخدم المنتج أولًا، وماذا يفعل اليوم بدلًا منه؟", purpose: "فهم الجمهور والحل الحالي." },
      { question: "[MOCK] ما الذي يجعل الإصدار الأول ناجحًا بالنسبة لك؟", purpose: "الاتفاق على الأهداف قبل النطاق." },
      { question: "[MOCK] ما الموجود حاليًا ويجب البناء عليه أو استبداله؟", purpose: "معرفة المواد والقيود الحالية." },
    ],
    scope: "[MOCK] يُحدَّد النطاق مع العميل خلال الاجتماع.",
    next: "[MOCK] راجع هذه المسودة وعدّلها قبل الاجتماع.",
  },
};

export function createMockGenerator(): PreparationGenerator {
  return {
    id: "mock",
    model: "mock-v1",
    estimateTokens: () => 0,
    async generate(input: GenerationInput) {
      const c = COPY[input.language];
      const description = input.brief.split("\n").slice(input.brief.split("\n").findIndex((l) => l.endsWith(":") && !l.includes(": ")) + 1).join("\n");
      const sentences = sentencesOf(description);
      const pick = (re: RegExp) => sentences.filter((s) => re.test(s)).slice(0, 3).map((s) => ({ text: s, evidence: s }));
      const facts = {
        problem: sentences.slice(0, 1).map((s) => ({ text: s, evidence: s })),
        audience: pick(RULES.audience),
        goals: pick(RULES.goals),
        existingMaterials: pick(RULES.existingMaterials),
        constraints: pick(RULES.constraints),
      };
      const hasLine = (label: RegExp) => input.brief.split("\n").some((l) => label.test(l));
      const missing = [
        !hasLine(/^(Budget range|الميزانية)/) && c.missing.budget,
        !hasLine(/^(Timeline|الجدول الزمني)/) && c.missing.timeline,
        facts.audience.length === 0 && c.missing.audience,
        facts.goals.length === 0 && c.missing.goals,
        facts.existingMaterials.length === 0 && c.missing.existing,
      ].filter((m): m is string => Boolean(m));
      return {
        ok: true,
        model: "mock-v1",
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, reported: true },
        raw: {
          language: input.language,
          summary: c.summary,
          clientFacts: facts,
          assumptions: [],
          missingInformation: missing,
          meetingQuestions: c.questions,
          suggestedScope: { summary: c.scope, firstRelease: [] },
          nextStep: c.next,
        },
      };
    },
  };
}

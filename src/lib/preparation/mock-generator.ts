import type { GenerationInput } from "./input";
import type { PreparationGenerator } from "./generator";
import type { PackStep } from "@/lib/pack/steps";
import { PATTERNS, kindFromProjectType, type PatternId, type ProjectKind } from "@/lib/pack/patterns";

// A deterministic, clearly labelled stand-in for a language model, so the whole
// Pre-meeting Pack workflow can run end to end with no provider (local runs and
// tests). Its client facts are the brief's own sentences; everything else is a
// template marked [MOCK]. It never makes anything up and never writes a figure.

const sentencesOf = (text: string) =>
  text
    .split(/(?<=[.!?؟])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3 && !/\d|[٠-٩]/.test(s));

const PATTERN_FOR: Record<ProjectKind, PatternId> = { website: "studio_site", web_app: "operations_app", mobile_app: "mobile_app" };

const COPY = {
  en: {
    audience: "[MOCK] The people the brief describes.",
    goal: "[MOCK] The outcome the brief describes.",
    hierarchy: ["[MOCK] The main task first", "[MOCK] Supporting information second"],
    brand: "[MOCK] No brand material was provided.",
    responsive: "[MOCK] Phone first, then wider screens.",
    unsupported: "[MOCK] The project type is not decided yet, so the design is prepared by hand.",
    screen: (n: string) => ({ title: `[MOCK] ${n}`, purpose: "[MOCK] Placeholder screen from the mock generator.", headline: "[MOCK] Headline", items: [{ title: "[MOCK] Item", text: "[MOCK] Short description." }], primary_action: "[MOCK] Continue" }),
    flow: "[MOCK] The user moves to the next screen.",
    proposal: {
      understanding: "[MOCK] Understanding of the problem, to be confirmed in the meeting.",
      recommended_solution: "[MOCK] A first release focused on the main task.",
      first_release_scope: ["[MOCK] The main task, end to end"],
      deliverables: ["[MOCK] Designs for the main screens"],
      assumptions: ["[MOCK] The client will confirm the users and the main task."],
      exclusions: ["[MOCK] Anything not discussed in the meeting"],
      cost_schedule_factors: ["[MOCK] The number of user roles", "[MOCK] Integrations with existing systems"],
      next_step: "[MOCK] Confirm scope in the first meeting.",
    },
    questions: [
      { question: "[MOCK] Who will use this first, and what do they do today instead?", purpose: "[MOCK] Understand the audience and the current workaround." },
      { question: "[MOCK] What would make the first release a success for you?", purpose: "[MOCK] Agree on goals before scope." },
      { question: "[MOCK] What already exists that we should build on or replace?", purpose: "[MOCK] Find existing materials and constraints." },
    ],
    agenda: [
      { item: "[MOCK] The problem in the client's words", purpose: "[MOCK] Confirm understanding." },
      { item: "[MOCK] First release and next step", purpose: "[MOCK] Agree what happens next." },
    ],
    confirm: ["[MOCK] Users and roles", "[MOCK] The first release"],
    missing: "[MOCK] Anything the brief does not say about users, goals or existing systems.",
  },
  ar: {
    audience: "[MOCK] الأشخاص الذين يصفهم الطلب.",
    goal: "[MOCK] النتيجة التي يصفها الطلب.",
    hierarchy: ["[MOCK] المهمة الرئيسية أولًا", "[MOCK] المعلومات المساندة ثانيًا"],
    brand: "[MOCK] لم تُقدَّم مواد للهوية البصرية.",
    responsive: "[MOCK] الجوال أولًا ثم الشاشات الأوسع.",
    unsupported: "[MOCK] نوع المشروع غير محدد بعد، لذا يُعدّ التصميم يدويًا.",
    screen: (n: string) => ({ title: `[MOCK] ${n}`, purpose: "[MOCK] شاشة بديلة من المولّد التجريبي.", headline: "[MOCK] عنوان", items: [{ title: "[MOCK] عنصر", text: "[MOCK] وصف قصير." }], primary_action: "[MOCK] متابعة" }),
    flow: "[MOCK] ينتقل المستخدم إلى الشاشة التالية.",
    proposal: {
      understanding: "[MOCK] فهم المشكلة، ويُؤكَّد في الاجتماع.",
      recommended_solution: "[MOCK] إصدار أول يركّز على المهمة الرئيسية.",
      first_release_scope: ["[MOCK] المهمة الرئيسية من البداية إلى النهاية"],
      deliverables: ["[MOCK] تصميمات الشاشات الرئيسية"],
      assumptions: ["[MOCK] سيؤكد العميل المستخدمين والمهمة الرئيسية."],
      exclusions: ["[MOCK] كل ما لم يُناقش في الاجتماع"],
      cost_schedule_factors: ["[MOCK] عدد أدوار المستخدمين", "[MOCK] التكامل مع الأنظمة الحالية"],
      next_step: "[MOCK] تأكيد النطاق في الاجتماع الأول.",
    },
    questions: [
      { question: "[MOCK] من سيستخدم المنتج أولًا، وماذا يفعل اليوم بدلًا منه؟", purpose: "[MOCK] فهم الجمهور والحل الحالي." },
      { question: "[MOCK] ما الذي يجعل الإصدار الأول ناجحًا بالنسبة لك؟", purpose: "[MOCK] الاتفاق على الأهداف قبل النطاق." },
      { question: "[MOCK] ما الموجود حاليًا ويجب البناء عليه أو استبداله؟", purpose: "[MOCK] معرفة المواد والقيود الحالية." },
    ],
    agenda: [
      { item: "[MOCK] المشكلة بكلمات العميل", purpose: "[MOCK] تأكيد الفهم." },
      { item: "[MOCK] الإصدار الأول والخطوة التالية", purpose: "[MOCK] الاتفاق على ما يلي." },
    ],
    confirm: ["[MOCK] المستخدمون والأدوار", "[MOCK] الإصدار الأول"],
    missing: "[MOCK] ما لا يذكره الطلب عن المستخدمين والأهداف والأنظمة الحالية.",
  },
} as const;

// The whole labelled pack; each step returns its own part of it.
export function mockPack(input: GenerationInput) {
  const c = COPY[input.language];
  const lines = input.brief.split("\n");
  const description = lines.slice(lines.findIndex((l) => l.endsWith(":") && !l.includes(": ")) + 1).join("\n");
  const facts = sentencesOf(description)
    .slice(0, 4)
    .map((s) => ({ text: s, evidence: s }));
  const kind = kindFromProjectType(input.projectType);
  const pattern = kind ? PATTERN_FOR[kind] : null;
  const templates = pattern ? PATTERNS[pattern].templates.slice(0, 3) : [];
  const screens = templates.map((template, i) => ({ id: `s${i + 1}`, template, ...c.screen(template.replaceAll("_", " ")) }));
  return {
    language: input.language,
    client_facts: facts,
    assumptions: [],
    missing_information: [c.missing],
    design_blueprint: {
      pattern,
      ...(pattern ? {} : { unsupported_reason: c.unsupported }),
      audience: c.audience,
      primary_goal: c.goal,
      hierarchy: [...c.hierarchy],
      responsive_notes: c.responsive,
      brand_context: c.brand,
    },
    screens,
    user_flow: screens.map((s) => ({ step: c.flow, screen: s.id })),
    proposal: {
      ...c.proposal,
      first_release_scope: [...c.proposal.first_release_scope],
      phases: [],
      deliverables: [...c.proposal.deliverables],
      assumptions: [...c.proposal.assumptions],
      exclusions: [...c.proposal.exclusions],
      cost_schedule_factors: [...c.proposal.cost_schedule_factors],
    },
    discovery_questions: c.questions.map((q) => ({ ...q })),
    risks: [],
    client_decisions: [],
    meeting_agenda: c.agenda.map((a) => ({ ...a })),
    confirm_before_pricing: [...c.confirm],
  };
}

const PART: Record<PackStep, (p: ReturnType<typeof mockPack>) => Record<string, unknown>> = {
  analysis: (p) => ({ language: p.language, client_facts: p.client_facts, assumptions: p.assumptions, missing_information: p.missing_information }),
  design: (p) => ({ language: p.language, design_blueprint: p.design_blueprint, screens: p.screens, user_flow: p.user_flow }),
  proposal: (p) => ({ language: p.language, proposal: p.proposal }),
  discovery: (p) => ({ language: p.language, discovery_questions: p.discovery_questions, risks: p.risks, client_decisions: p.client_decisions, meeting_agenda: p.meeting_agenda, confirm_before_pricing: p.confirm_before_pricing }),
};

export function createMockGenerator(): PreparationGenerator {
  return {
    id: "mock",
    model: "mock-v1",
    estimateTokens: () => 0,
    async generate(step, input) {
      return { ok: true, model: "mock-v1", usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, reported: true }, raw: PART[step](mockPack(input)) };
    },
  };
}
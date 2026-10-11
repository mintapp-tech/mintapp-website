import type { GenerationInput } from "./input";
import type { PreparationGenerator } from "./generator";
import type { PackStep } from "@/lib/pack/steps";
import { PATTERNS, kindFromProjectType, type PatternId, type ProjectKind, type ProposalPatternId } from "@/lib/pack/library";

// A deterministic, clearly labelled stand-in for a language model, so the whole
// Pre-meeting Pack workflow can run end to end with no provider (local runs and
// tests). Its client facts are the brief's own sentences; everything else is a
// template marked [MOCK]. It never makes anything up and never writes a figure.
// The [MOCK] marks are placeholder text on purpose: a mock Pack can be reviewed
// but never presented to a client.

const sentencesOf = (text: string) =>
  text
    .split(/(?<=[.!?؟])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3 && !/\d|[٠-٩]/.test(s));

const PATTERN_FOR: Record<ProjectKind, PatternId> = { website: "studio_site", web_app: "crm_app", mobile_app: "mobile_discovery" };

const COPY = {
  en: {
    context: "[MOCK] The business as the brief describes it.",
    users: { group: "[MOCK] Main users", needs: "[MOCK] What the brief says they need." },
    problem: "[MOCK] The problem the brief describes.",
    goal: "[MOCK] The outcome the brief describes.",
    direction: "[MOCK] A first direction focused on the main task.",
    hierarchy: ["[MOCK] The main task first", "[MOCK] Supporting information second"],
    brand: "[MOCK] No brand material was provided.",
    responsive: "[MOCK] Phone first, then wider screens.",
    unsupported: "[MOCK] The project type is not decided yet, so the design is prepared by hand.",
    screen: (n: string) => ({ title: `[MOCK] ${n}`, purpose: "[MOCK] Placeholder screen from the mock generator.", headline: "[MOCK] Headline", items: [{ title: "[MOCK] Item", text: "[MOCK] Short description." }], primary_action: "[MOCK] Continue" }),
    flow: "[MOCK] The user moves to the next screen.",
    scope: { first_release: ["[MOCK] The main task, end to end"], later: ["[MOCK] Anything that can wait"], not_included: ["[MOCK] Anything not discussed in the meeting"] },
    proposal: {
      approach: "[MOCK] A first release focused on the main task, confirmed in the meeting.",
      phases: [{ name: "[MOCK] First release", summary: "[MOCK] The main task, designed and built." }],
      deliverables: ["[MOCK] Designs for the main screens"],
      cost_schedule_factors: ["[MOCK] The number of user roles", "[MOCK] Integrations with existing systems"],
    },
    questions: [
      { question: "[MOCK] Who will use this first, and what do they do today instead?", purpose: "[MOCK] Understand the audience and the current workaround.", bank: "users" },
      { question: "[MOCK] Where does the current way of working break down?", purpose: "[MOCK] Find the real problem.", bank: "operations" },
      { question: "[MOCK] What already exists that we should build on or replace?", purpose: "[MOCK] Find existing materials and constraints.", bank: "integrations" },
    ],
    decision: "[MOCK] Which users come first",
    risk: { risk: "[MOCK] The current habit continues alongside the new tool.", why: "[MOCK] Change takes time." },
    agenda: [
      { item: "[MOCK] The problem in the client's words", purpose: "[MOCK] Confirm understanding." },
      { item: "[MOCK] First release and next step", purpose: "[MOCK] Agree what happens next." },
    ],
    next: "[MOCK] Confirm the first release after the meeting.",
    missing: "[MOCK] Anything the brief does not say about users, goals or existing systems.",
  },
  ar: {
    context: "[MOCK] النشاط كما يصفه الطلب.",
    users: { group: "[MOCK] المستخدمون الرئيسيون", needs: "[MOCK] ما يقول الطلب إنهم يحتاجونه." },
    problem: "[MOCK] المشكلة التي يصفها الطلب.",
    goal: "[MOCK] النتيجة التي يصفها الطلب.",
    direction: "[MOCK] اتجاه أول يركّز على المهمة الرئيسية.",
    hierarchy: ["[MOCK] المهمة الرئيسية أولًا", "[MOCK] المعلومات المساندة ثانيًا"],
    brand: "[MOCK] لم تُقدَّم مواد للهوية البصرية.",
    responsive: "[MOCK] الجوال أولًا ثم الشاشات الأوسع.",
    unsupported: "[MOCK] نوع المشروع غير محدد بعد، لذا يُعدّ التصميم يدويًا.",
    screen: (n: string) => ({ title: `[MOCK] ${n}`, purpose: "[MOCK] شاشة بديلة من المولّد التجريبي.", headline: "[MOCK] عنوان", items: [{ title: "[MOCK] عنصر", text: "[MOCK] وصف قصير." }], primary_action: "[MOCK] متابعة" }),
    flow: "[MOCK] ينتقل المستخدم إلى الشاشة التالية.",
    scope: { first_release: ["[MOCK] المهمة الرئيسية من البداية إلى النهاية"], later: ["[MOCK] ما يمكن تأجيله"], not_included: ["[MOCK] كل ما لم يُناقش في الاجتماع"] },
    proposal: {
      approach: "[MOCK] إصدار أول يركّز على المهمة الرئيسية، ويُؤكَّد في الاجتماع.",
      phases: [{ name: "[MOCK] الإصدار الأول", summary: "[MOCK] تصميم المهمة الرئيسية وبناؤها." }],
      deliverables: ["[MOCK] تصميمات الشاشات الرئيسية"],
      cost_schedule_factors: ["[MOCK] عدد أدوار المستخدمين", "[MOCK] التكامل مع الأنظمة الحالية"],
    },
    questions: [
      { question: "[MOCK] من سيستخدم المنتج أولًا، وماذا يفعل اليوم بدلًا منه؟", purpose: "[MOCK] فهم الجمهور والحل الحالي.", bank: "users" },
      { question: "[MOCK] أين تتعثر طريقة العمل الحالية؟", purpose: "[MOCK] معرفة المشكلة الحقيقية.", bank: "operations" },
      { question: "[MOCK] ما الموجود حاليًا ويجب البناء عليه أو استبداله؟", purpose: "[MOCK] معرفة المواد والقيود الحالية.", bank: "integrations" },
    ],
    decision: "[MOCK] أي المستخدمين يأتي أولًا",
    risk: { risk: "[MOCK] استمرار العادة الحالية بجانب الأداة الجديدة.", why: "[MOCK] التغيير يحتاج وقتًا." },
    agenda: [
      { item: "[MOCK] المشكلة بكلمات العميل", purpose: "[MOCK] تأكيد الفهم." },
      { item: "[MOCK] الإصدار الأول والخطوة التالية", purpose: "[MOCK] الاتفاق على ما يلي." },
    ],
    next: "[MOCK] تأكيد الإصدار الأول بعد الاجتماع.",
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
  const proposalPattern: ProposalPatternId = kind ?? "existing_product";
  return {
    language: input.language,
    client_facts: facts.length ? facts : [{ text: description.trim().slice(0, 300), evidence: description.trim().slice(0, 300) }],
    assumptions: [],
    missing_information: [c.missing],
    business_context: [{ text: c.context, basis: "assumption" as const }],
    users: [{ ...c.users, basis: "assumption" as const }],
    problem: [{ text: c.problem, basis: "assumption" as const }],
    goals: [{ text: c.goal, basis: "assumption" as const }],
    design_blueprint: {
      pattern,
      ...(pattern ? {} : { unsupported_reason: c.unsupported }),
      direction: c.direction,
      hierarchy: [...c.hierarchy],
      responsive_notes: c.responsive,
      brand_context: c.brand,
    },
    screens,
    user_flow: screens.map((s) => ({ step: c.flow, screen: s.id })),
    scope_direction: { first_release: [...c.scope.first_release], later: [...c.scope.later], not_included: [...c.scope.not_included] },
    proposal_direction: { pattern: proposalPattern, ...c.proposal, phases: c.proposal.phases.map((p) => ({ ...p })), deliverables: [...c.proposal.deliverables], cost_schedule_factors: [...c.proposal.cost_schedule_factors] },
    discovery_questions: c.questions.map((q) => ({ ...q })),
    decisions_needed: [c.decision],
    risks: [{ ...c.risk }],
    meeting_agenda: c.agenda.map((a) => ({ ...a })),
    next_steps: [c.next],
  };
}

const PART: Record<PackStep, (p: ReturnType<typeof mockPack>) => Record<string, unknown>> = {
  analysis: (p) => ({ language: p.language, client_facts: p.client_facts, assumptions: p.assumptions, missing_information: p.missing_information, business_context: p.business_context, users: p.users, problem: p.problem, goals: p.goals }),
  design: (p) => ({ language: p.language, design_blueprint: p.design_blueprint, screens: p.screens, user_flow: p.user_flow }),
  proposal: (p) => ({ language: p.language, scope_direction: p.scope_direction, proposal_direction: p.proposal_direction }),
  discovery: (p) => ({ language: p.language, discovery_questions: p.discovery_questions, decisions_needed: p.decisions_needed, risks: p.risks, meeting_agenda: p.meeting_agenda, next_steps: p.next_steps }),
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

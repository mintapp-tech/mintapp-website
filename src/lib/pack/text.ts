import type { DesignArtifact, DiscoveryArtifact, ProposalArtifact, TextArtifact } from "./schema";

// A stored artifact as headed sections and as plain text, in the artifact's own
// language: what the team reads on the Pre-meeting Pack tab, and what a founder
// edits by hand (saving it makes a new, text version). Pure.

type Lang = "en" | "ar";
export interface Section {
  title: string;
  lines: string[];
}

const H = {
  en: {
    understanding: "Our understanding",
    solution: "Recommended solution",
    scope: "First release scope",
    phases: "Phases",
    deliverables: "Deliverables",
    assumptions: "Assumptions",
    exclusions: "Not included",
    factors: "What will shape cost and schedule",
    next: "Next step",
    facts: "What the client told us",
    missing: "Missing information",
    questions: "Questions to ask",
    purpose: "Why",
    risks: "Risks",
    decisions: "Decisions the client needs to make",
    agenda: "Meeting agenda",
    confirm: "Confirm before pricing",
    audience: "Audience",
    goal: "Primary goal",
    hierarchy: "Content hierarchy",
    responsive: "Responsive direction",
    brand: "Brand context",
    flow: "User flow",
    screen: "Screen",
    unsupported: "No library pattern fits",
  },
  ar: {
    understanding: "فهمنا للمشروع",
    solution: "الحل المقترح",
    scope: "نطاق الإصدار الأول",
    phases: "المراحل",
    deliverables: "المخرجات",
    assumptions: "الافتراضات",
    exclusions: "ما لا يشمله",
    factors: "ما سيحدد التكلفة والجدول الزمني",
    next: "الخطوة التالية",
    facts: "ما أخبرنا به العميل",
    missing: "معلومات ناقصة",
    questions: "أسئلة للعميل",
    purpose: "الغرض",
    risks: "المخاطر",
    decisions: "قرارات على العميل اتخاذها",
    agenda: "جدول الاجتماع",
    confirm: "ما يجب تأكيده قبل التسعير",
    audience: "الجمهور",
    goal: "الهدف الأساسي",
    hierarchy: "ترتيب المحتوى",
    responsive: "التوجّه المتجاوب",
    brand: "سياق العلامة التجارية",
    flow: "مسار المستخدم",
    screen: "الشاشة",
    unsupported: "لا يناسبه أي نمط في المكتبة",
  },
} as const;

const s = (title: string, lines: readonly string[]): Section[] => (lines.length ? [{ title, lines: [...lines] }] : []);
const bullets = (items: readonly string[]) => items.map((i) => `- ${i}`);

function proposalSections(a: ProposalArtifact): Section[] {
  const h = H[a.language];
  const p = a.proposal;
  return [
    ...s(h.understanding, [p.understanding]),
    ...s(h.solution, [p.recommended_solution]),
    ...s(h.scope, bullets(p.first_release_scope)),
    ...s(h.phases, p.phases.map((x) => `- ${x.name}: ${x.summary}`)),
    ...s(h.deliverables, bullets(p.deliverables)),
    ...s(h.assumptions, bullets(p.assumptions)),
    ...s(h.exclusions, bullets(p.exclusions)),
    ...s(h.factors, bullets(p.cost_schedule_factors)),
    ...s(h.next, [p.next_step]),
  ];
}

function discoverySections(a: DiscoveryArtifact): Section[] {
  const h = H[a.language];
  return [
    ...s(h.facts, bullets(a.client_facts.map((f) => f.text))),
    ...s(h.assumptions, a.assumptions.map((x) => `- ${x.text} (${x.reason})`)),
    ...s(h.missing, bullets(a.missing_information)),
    ...s(h.questions, a.discovery_questions.map((q) => `- ${q.question} — ${h.purpose}: ${q.purpose}`)),
    ...s(h.risks, a.risks.map((r) => `- ${r.risk}: ${r.why}`)),
    ...s(h.decisions, bullets(a.client_decisions)),
    ...s(h.agenda, a.meeting_agenda.map((x, i) => `${i + 1}. ${x.item}: ${x.purpose}`)),
    ...s(h.confirm, bullets(a.confirm_before_pricing)),
  ];
}

function designSections(a: DesignArtifact): Section[] {
  const h = H[a.language];
  const b = a.blueprint;
  const ids = new Map(a.screens.map((x, i) => [x.id, i + 1]));
  return [
    ...(b.pattern ? [] : s(h.unsupported, [b.unsupported_reason ?? ""])),
    ...s(h.audience, [b.audience]),
    ...s(h.goal, [b.primary_goal]),
    ...s(h.hierarchy, b.hierarchy.map((x, i) => `${i + 1}. ${x}`)),
    ...(b.responsive_notes ? s(h.responsive, [b.responsive_notes]) : []),
    ...s(h.brand, [b.brand_context]),
    ...s(h.flow, a.user_flow.map((u) => `- ${h.screen} ${ids.get(u.screen) ?? "?"}: ${u.step}`)),
    ...a.screens.flatMap((x, i) =>
      s(`${h.screen} ${i + 1}: ${x.title}`, [x.purpose, `${x.headline}${x.supporting_text ? ` — ${x.supporting_text}` : ""}`, ...x.items.map((it) => `- ${it.title}: ${it.text}`)]),
    ),
  ];
}

// The headed sections of a structured artifact; null for a text version or an unknown shape.
export function artifactSections(content: unknown): Section[] | null {
  const c = content as { format?: string } | null;
  switch (c?.format) {
    case "pack-proposal":
      return proposalSections(c as ProposalArtifact);
    case "pack-discovery":
      return discoverySections(c as DiscoveryArtifact);
    case "pack-design":
      return designSections(c as DesignArtifact);
    default:
      return null;
  }
}

// Any stored artifact content, as text. Unknown shapes become an empty string.
export function artifactText(content: unknown): string {
  const sections = artifactSections(content);
  if (sections) return sections.map((x) => [x.title, ...x.lines].join("\n")).join("\n\n");
  const c = content as Partial<TextArtifact> | null;
  return c?.format === "text" && typeof c.body === "string" ? c.body : "";
}

// The language a stored artifact is written in (text versions: unknown).
export const artifactLanguage = (content: unknown): Lang | null => {
  const l = (content as { language?: unknown } | null)?.language;
  return l === "en" || l === "ar" ? l : null;
};

import { DISCOVERY_BANKS, PROPOSAL_PATTERNS, patternInfo, type DiscoveryBankId, type ProposalPatternId } from "./library";
import { ARTIFACT_SCHEMAS, type ArtifactKind, type DirectionArtifact, type MeetingArtifact, type PackArtifact, type ScopeArtifact, type SectionKey, type StatementBasis } from "./schema";
import { FIELD_LABELS, SECTION_LABELS, type FieldKey, type Lang } from "./labels";

// A stored version for people to read: its sections as items with their basis
// (the structured view the dashboard shows), as plain lines (for comparing two
// versions), and the views of older formats kept readable in a version's history.
// Pure, so it is unit-tested.

export interface ViewItem {
  text: string;
  basis?: StatementBasis;
  // A sub-heading inside the section (a field of the blueprint, a scope list).
  field?: FieldKey;
  // A second line: the quote, the reason, the purpose.
  note?: { field: FieldKey; text: string };
  // A screen's details.
  lines?: string[];
}
export interface ViewSection {
  key: SectionKey;
  items: ViewItem[];
}

const grounded = (s: { text: string; basis: "client_fact" | "assumption"; evidence?: string }): ViewItem => ({ text: s.text, basis: s.basis, note: s.evidence ? { field: "evidence", text: s.evidence } : undefined });

function designView(d: DirectionArtifact, lang: Lang): ViewSection[] {
  const b = d.blueprint;
  const info = b.pattern ? patternInfo(b.pattern) : null;
  const order = new Map(d.screens.map((s, i) => [s.id, i + 1]));
  const rec = (field: FieldKey, text: string): ViewItem => ({ field, text, basis: "recommendation" });
  return [
    { key: "client_facts", items: d.client_facts.map((f) => ({ text: f.text, basis: "client_fact", note: { field: "evidence", text: f.evidence } })) },
    { key: "business_context", items: d.business_context.map(grounded) },
    { key: "users", items: d.users.map((u) => ({ text: `${u.group}: ${u.needs}`, basis: u.basis, note: u.evidence ? { field: "evidence", text: u.evidence } : undefined })) },
    { key: "problem", items: d.problem.map(grounded) },
    { key: "goals", items: d.goals.map(grounded) },
    { key: "assumptions", items: d.assumptions.map((a) => ({ text: a.text, basis: "assumption", note: { field: "reason", text: a.reason } })) },
    { key: "missing_information", items: d.missing_information.map((m) => ({ text: m, basis: "question" })) },
    {
      key: "design_blueprint",
      items: [
        ...(info ? [rec("pattern", info[lang])] : [rec("unsupported", b.unsupported_reason ?? "")]),
        rec("direction", b.direction),
        ...b.hierarchy.map((h) => rec("hierarchy", h)),
        rec("responsive", b.responsive_notes),
        rec("brand", b.brand_context),
      ],
    },
    {
      key: "screens",
      items: d.screens.map((s, i) => ({
        field: "screen",
        text: `${i + 1}. ${s.title}`,
        basis: "recommendation",
        lines: [s.purpose, `${s.headline}${s.supporting_text ? ` — ${s.supporting_text}` : ""}`, ...s.items.map((it) => `${it.title}: ${it.text}`), ...[s.primary_action, s.secondary_action].filter((a): a is string => !!a)],
      })),
    },
    { key: "user_flow", items: d.user_flow.map((u) => ({ text: `${order.get(u.screen) ?? "?"} · ${u.step}`, basis: "recommendation" })) },
  ];
}

function scopeView(s: ScopeArtifact, lang: Lang): ViewSection[] {
  const rec = (field: FieldKey, text: string): ViewItem => ({ field, text, basis: "recommendation" });
  const p = s.proposal_direction;
  return [
    {
      key: "scope_direction",
      items: [...s.scope_direction.first_release.map((x) => rec("first_release", x)), ...s.scope_direction.later.map((x) => rec("later", x)), ...s.scope_direction.not_included.map((x) => rec("not_included", x))],
    },
    {
      key: "proposal_direction",
      items: [
        rec("proposal_pattern", PROPOSAL_PATTERNS[p.pattern as ProposalPatternId][lang]),
        rec("approach", p.approach),
        ...p.phases.map((x) => rec("phases", `${x.name}: ${x.summary}`)),
        ...p.deliverables.map((x) => rec("deliverables", x)),
        ...p.cost_schedule_factors.map((x) => rec("factors", x)),
      ],
    },
  ];
}

function meetingView(m: MeetingArtifact, lang: Lang): ViewSection[] {
  return [
    { key: "discovery_questions", items: m.discovery_questions.map((q) => ({ text: q.question, basis: "question", field: "topic", note: { field: "purpose", text: `${q.purpose} (${DISCOVERY_BANKS[q.bank as DiscoveryBankId][lang]})` } })) },
    { key: "decisions_needed", items: m.decisions_needed.map((d) => ({ text: d, basis: "question" })) },
    { key: "risks", items: m.risks.map((r) => ({ text: r.risk, basis: "assumption", note: { field: "why", text: r.why } })) },
    { key: "meeting_agenda", items: m.meeting_agenda.map((a, i) => ({ text: `${i + 1}. ${a.item}`, basis: "recommendation", note: { field: "purpose", text: a.purpose } })) },
    { key: "next_steps", items: m.next_steps.map((n) => ({ text: n, basis: "recommendation" })) },
  ];
}

// The structured view of a current-format version; null for an older format or text.
export function artifactView(kind: ArtifactKind, content: unknown, lang: Lang): ViewSection[] | null {
  const parsed = ARTIFACT_SCHEMAS[kind].safeParse(content);
  if (!parsed.success) return null;
  const c = parsed.data as PackArtifact;
  const view = kind === "design" ? designView(c as DirectionArtifact, lang) : kind === "proposal" ? scopeView(c as ScopeArtifact, lang) : meetingView(c as MeetingArtifact, lang);
  return view.filter((s) => s.items.length > 0);
}

// ----- Older formats, kept readable in a version's history

export interface Section {
  title: string;
  lines: string[];
}

const H = {
  en: { understanding: "Our understanding", solution: "Recommended solution", scope: "First release scope", phases: "Phases", deliverables: "Deliverables", assumptions: "Assumptions", exclusions: "Not included", factors: "What will shape cost and schedule", next: "Next step", facts: "What the client told us", missing: "Missing information", questions: "Questions to ask", purpose: "Why", risks: "Risks", decisions: "Decisions the client needs to make", agenda: "Meeting agenda", confirm: "Confirm before pricing", audience: "Audience", goal: "Primary goal", hierarchy: "Content hierarchy", responsive: "Responsive direction", brand: "Brand context", flow: "User flow", screen: "Screen", unsupported: "No library pattern fits" },
  ar: { understanding: "فهمنا للمشروع", solution: "الحل المقترح", scope: "نطاق الإصدار الأول", phases: "المراحل", deliverables: "المخرجات", assumptions: "الافتراضات", exclusions: "ما لا يشمله", factors: "ما سيحدد التكلفة والجدول الزمني", next: "الخطوة التالية", facts: "ما أخبرنا به العميل", missing: "معلومات ناقصة", questions: "أسئلة للعميل", purpose: "الغرض", risks: "المخاطر", decisions: "قرارات على العميل اتخاذها", agenda: "جدول الاجتماع", confirm: "ما يجب تأكيده قبل التسعير", audience: "الجمهور", goal: "الهدف الأساسي", hierarchy: "ترتيب المحتوى", responsive: "التوجّه المتجاوب", brand: "سياق العلامة التجارية", flow: "مسار المستخدم", screen: "الشاشة", unsupported: "لا يناسبه أي نمط في المكتبة" },
} as const;

const s = (title: string, lines: readonly string[]): Section[] => (lines.length ? [{ title, lines: [...lines] }] : []);
const bullets = (items: readonly string[] = []) => items.map((i) => `- ${i}`);

/* eslint-disable @typescript-eslint/no-explicit-any -- the first format is read loosely and only displayed */
function legacySections(c: any): Section[] | null {
  const h = H[c.language === "ar" ? "ar" : "en"];
  if (c.format === "pack-proposal" && c.proposal) {
    const p = c.proposal;
    return [
      ...s(h.understanding, [p.understanding]),
      ...s(h.solution, [p.recommended_solution]),
      ...s(h.scope, bullets(p.first_release_scope)),
      ...s(h.phases, (p.phases ?? []).map((x: any) => `- ${x.name}: ${x.summary}`)),
      ...s(h.deliverables, bullets(p.deliverables)),
      ...s(h.assumptions, bullets(p.assumptions)),
      ...s(h.exclusions, bullets(p.exclusions)),
      ...s(h.factors, bullets(p.cost_schedule_factors)),
      ...s(h.next, [p.next_step]),
    ];
  }
  if (c.format === "pack-discovery" && Array.isArray(c.client_facts)) {
    return [
      ...s(h.facts, bullets(c.client_facts.map((f: any) => f.text))),
      ...s(h.assumptions, (c.assumptions ?? []).map((x: any) => `- ${x.text} (${x.reason})`)),
      ...s(h.missing, bullets(c.missing_information)),
      ...s(h.questions, (c.discovery_questions ?? []).map((q: any) => `- ${q.question} — ${h.purpose}: ${q.purpose}`)),
      ...s(h.risks, (c.risks ?? []).map((r: any) => `- ${r.risk}: ${r.why}`)),
      ...s(h.decisions, bullets(c.client_decisions)),
      ...s(h.agenda, (c.meeting_agenda ?? []).map((x: any, i: number) => `${i + 1}. ${x.item}: ${x.purpose}`)),
      ...s(h.confirm, bullets(c.confirm_before_pricing)),
    ];
  }
  if (c.format === "pack-design" && c.blueprint && "audience" in c.blueprint) {
    const b = c.blueprint;
    const ids = new Map((c.screens ?? []).map((x: any, i: number) => [x.id, i + 1]));
    return [
      ...(b.pattern ? [] : s(h.unsupported, [b.unsupported_reason ?? ""])),
      ...s(h.audience, [b.audience]),
      ...s(h.goal, [b.primary_goal]),
      ...s(h.hierarchy, (b.hierarchy ?? []).map((x: string, i: number) => `${i + 1}. ${x}`)),
      ...(b.responsive_notes ? s(h.responsive, [b.responsive_notes]) : []),
      ...s(h.brand, [b.brand_context]),
      ...s(h.flow, (c.user_flow ?? []).map((u: any) => `- ${h.screen} ${ids.get(u.screen) ?? "?"}: ${u.step}`)),
      ...(c.screens ?? []).flatMap((x: any, i: number) => s(`${h.screen} ${i + 1}: ${x.title}`, [x.purpose, `${x.headline}${x.supporting_text ? ` — ${x.supporting_text}` : ""}`, ...(x.items ?? []).map((it: any) => `- ${it.title}: ${it.text}`)])),
    ];
  }
  return null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// The headed sections of a version in the first format; null for anything else.
export function legacyArtifactSections(content: unknown): Section[] | null {
  const c = content as { format?: string; v?: number } | null;
  if (!c || typeof c !== "object" || c.v === 2) return null;
  try {
    return legacySections(c);
  } catch {
    return null;
  }
}

// ----- Plain text, for comparison and for anything that only needs words

// Every line of a version: "Section heading: text". Current format, first format
// or a text version; an unknown shape gives no lines.
export function artifactLines(kind: ArtifactKind, content: unknown, lang: Lang): string[] {
  const view = artifactView(kind, content, lang);
  if (view) {
    return view.flatMap((sec) =>
      sec.items.flatMap((it) => {
        const head = `${SECTION_LABELS[lang][sec.key]}${it.field ? ` · ${FIELD_LABELS[lang][it.field]}` : ""}`;
        return [`${head}: ${it.text}`, ...(it.note ? [`${head} · ${FIELD_LABELS[lang][it.note.field]}: ${it.note.text}`] : []), ...(it.lines ?? []).map((l) => `${head} · ${it.text}: ${l}`)];
      }),
    );
  }
  const legacy = legacyArtifactSections(content);
  if (legacy) return legacy.flatMap((x) => x.lines.map((l) => `${x.title}: ${l.replace(/^- /, "")}`));
  const t = content as { format?: string; body?: unknown } | null;
  return t?.format === "text" && typeof t.body === "string" ? t.body.split(/\n+/).map((l) => l.trim()).filter(Boolean) : [];
}

// The language a stored version is written in (text versions: unknown).
export const artifactLanguage = (content: unknown): Lang | null => {
  const l = (content as { language?: unknown } | null)?.language;
  return l === "en" || l === "ar" ? l : null;
};

export interface Change {
  added: string[];
  removed: string[];
}

// What changed from one version to the next, line by line (order is ignored: a
// moved line is not a change).
export function compareVersions(kind: ArtifactKind, previous: unknown, next: unknown, lang: Lang): Change {
  const count = (lines: string[]) => lines.reduce((m, l) => m.set(l, (m.get(l) ?? 0) + 1), new Map<string, number>());
  const before = count(artifactLines(kind, previous, lang));
  const after = count(artifactLines(kind, next, lang));
  const added: string[] = [];
  const removed: string[] = [];
  for (const [line, n] of after) for (let i = before.get(line) ?? 0; i < n; i++) added.push(line);
  for (const [line, n] of before) for (let i = after.get(line) ?? 0; i < n; i++) removed.push(line);
  return { added, removed };
}

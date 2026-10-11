import { z } from "zod";
import { figuresIn, normalizeForMatch } from "@/lib/preparation/draft";
import type { BriefLanguage } from "@/lib/preparation/input";
import { PATTERNS, PROPOSAL_PATTERNS, TEMPLATES, isDiscoveryBankId, isPatternId, isProposalPatternId, isTemplateId, kindFromProjectType, patternInfo, type PatternId, type ProjectKind, type ProposalPatternId } from "./library";

// The Pre-meeting Pack: one strict, versioned structure, the single source of truth
// for the Direction Pack (the client presentation and its PDF are only renderings of
// an approved version). Automated preparation produces it in four bounded steps
// (src/lib/pack/steps.ts); the manual Claude path returns it as one object; a
// founder edits it section by section. Every route goes through validatePack or
// validateArtifact before anything is saved.
//
// Seventeen sections, stored as three artifacts (the three working areas):
//
//   Initial product direction ("design")       client_facts, assumptions, missing_information,
//                                               business_context, users, problem, goals,
//                                               design_blueprint, screens, user_flow
//   Draft scope and proposal direction          scope_direction, proposal_direction
//     ("proposal")
//   Discovery and meeting plan ("discovery")   discovery_questions, decisions_needed, risks,
//                                               meeting_agenda, next_steps
//
// Every statement has exactly one basis (classifyPack): a supplied client fact
// (quoting the brief), a Mintapp assumption, a Mintapp recommendation, or a
// question requiring confirmation.

export const PACK_FORMAT_VERSION = 2;

const text = (max: number) => z.string().trim().min(1).max(max);
const list = <T extends z.ZodType>(item: T, min: number, max: number) => z.array(item).min(min).max(max);
const screenId = z.string().regex(/^s[1-4]$/);

export const languageSchema = z.enum(["en", "ar"]);
// Where a statement about the client comes from: the brief (quoted) or our inference.
export const basisSchema = z.enum(["client_fact", "assumption"]);
const grounded = z.object({ text: text(300), basis: basisSchema, evidence: text(300).optional() }).strict();

// ----- The seventeen sections, in three parts

export const understandingPart = {
  client_facts: list(z.object({ text: text(300), evidence: text(300) }).strict(), 1, 12),
  assumptions: list(z.object({ text: text(300), reason: text(300) }).strict(), 0, 10),
  missing_information: list(text(200), 0, 10),
  business_context: list(grounded, 1, 4),
  users: list(z.object({ group: text(80), needs: text(240), basis: basisSchema, evidence: text(300).optional() }).strict(), 1, 4),
  problem: list(grounded, 1, 4),
  goals: list(grounded, 1, 5),
};

const screen = z
  .object({
    id: screenId,
    template: z.string().refine(isTemplateId, "unknown_template"),
    title: text(80),
    purpose: text(240),
    headline: text(120),
    supporting_text: text(240).optional(),
    items: list(z.object({ title: text(60), text: text(160) }).strict(), 0, 6),
    primary_action: text(40).optional(),
    secondary_action: text(40).optional(),
  })
  .strict();

export const designPart = {
  design_blueprint: z
    .object({
      // null when no pattern in the library fits: the design is then prepared by hand.
      pattern: z.union([z.string().refine(isPatternId, "unknown_pattern"), z.null()]),
      unsupported_reason: text(240).optional(),
      direction: text(400),
      hierarchy: list(text(200), 1, 6),
      responsive_notes: text(300),
      brand_context: text(240),
    })
    .strict(),
  screens: list(screen, 0, 4),
  user_flow: list(z.object({ step: text(160), screen: screenId }).strict(), 0, 6),
};

export const scopePart = {
  scope_direction: z
    .object({
      first_release: list(text(200), 1, 8),
      later: list(text(200), 0, 6),
      not_included: list(text(200), 0, 8),
    })
    .strict(),
  proposal_direction: z
    .object({
      pattern: z.string().refine(isProposalPatternId, "unknown_proposal_pattern"),
      approach: text(600),
      phases: list(z.object({ name: text(80), summary: text(300) }).strict(), 1, 4),
      deliverables: list(text(200), 1, 8),
      cost_schedule_factors: list(text(240), 1, 8),
    })
    .strict(),
};

export const meetingPart = {
  discovery_questions: list(z.object({ question: text(250), purpose: text(250), bank: z.string().refine(isDiscoveryBankId, "unknown_bank") }).strict(), 3, 10),
  decisions_needed: list(text(200), 0, 6),
  risks: list(z.object({ risk: text(240), why: text(240) }).strict(), 0, 6),
  meeting_agenda: list(z.object({ item: text(120), purpose: text(200) }).strict(), 2, 8),
  next_steps: list(text(240), 1, 5),
};

export const SECTIONS = {
  design: ["client_facts", "assumptions", "missing_information", "business_context", "users", "problem", "goals", "design_blueprint", "screens", "user_flow"],
  proposal: ["scope_direction", "proposal_direction"],
  discovery: ["discovery_questions", "decisions_needed", "risks", "meeting_agenda", "next_steps"],
} as const;
export type ArtifactKind = keyof typeof SECTIONS;
export type SectionKey = (typeof SECTIONS)[ArtifactKind][number];
export const SECTION_KEYS: SectionKey[] = [...SECTIONS.design, ...SECTIONS.proposal, ...SECTIONS.discovery];

// The whole Pack as one object (the manual Claude path; the presentation's input).
export const packSchema = z.object({ language: languageSchema, ...understandingPart, ...designPart, ...scopePart, ...meetingPart }).strict();
export type Pack = z.infer<typeof packSchema>;

// ----- The three stored artifacts (format 2)

const stored = <F extends string, S extends z.ZodRawShape>(format: F, shape: S) => z.object({ format: z.literal(format), v: z.literal(PACK_FORMAT_VERSION), language: languageSchema, ...shape }).strict();

export const directionArtifactSchema = stored("pack-design", { ...understandingPart, blueprint: designPart.design_blueprint, screens: designPart.screens, user_flow: designPart.user_flow });
export const scopeArtifactSchema = stored("pack-proposal", scopePart);
export const meetingArtifactSchema = stored("pack-discovery", meetingPart);

export type DirectionArtifact = z.infer<typeof directionArtifactSchema>;
export type ScopeArtifact = z.infer<typeof scopeArtifactSchema>;
export type MeetingArtifact = z.infer<typeof meetingArtifactSchema>;
export type PackArtifact = DirectionArtifact | ScopeArtifact | MeetingArtifact;

export const ARTIFACT_SCHEMAS = { design: directionArtifactSchema, proposal: scopeArtifactSchema, discovery: meetingArtifactSchema } as const;
export const ARTIFACT_FORMATS = { design: "pack-design", proposal: "pack-proposal", discovery: "pack-discovery" } as const;

type Understanding = Pick<Pack, keyof typeof understandingPart>;
type Design = Pick<Pack, keyof typeof designPart>;

export const directionArtifact = (language: BriefLanguage, u: Understanding, d: Design): DirectionArtifact => ({
  format: "pack-design",
  v: PACK_FORMAT_VERSION,
  language,
  client_facts: u.client_facts,
  assumptions: u.assumptions,
  missing_information: u.missing_information,
  business_context: u.business_context,
  users: u.users,
  problem: u.problem,
  goals: u.goals,
  blueprint: d.design_blueprint,
  screens: d.screens,
  user_flow: d.user_flow,
});
export const scopeArtifact = (language: BriefLanguage, s: Pick<Pack, keyof typeof scopePart>): ScopeArtifact => ({ format: "pack-proposal", v: PACK_FORMAT_VERSION, language, scope_direction: s.scope_direction, proposal_direction: s.proposal_direction });
export const meetingArtifact = (language: BriefLanguage, m: Pick<Pack, keyof typeof meetingPart>): MeetingArtifact => ({
  format: "pack-discovery",
  v: PACK_FORMAT_VERSION,
  language,
  discovery_questions: m.discovery_questions,
  decisions_needed: m.decisions_needed,
  risks: m.risks,
  meeting_agenda: m.meeting_agenda,
  next_steps: m.next_steps,
});

export function splitPack(pack: Pack): { design: DirectionArtifact; proposal: ScopeArtifact; discovery: MeetingArtifact } {
  return { design: directionArtifact(pack.language, pack, pack), proposal: scopeArtifact(pack.language, pack), discovery: meetingArtifact(pack.language, pack) };
}

// The three artifacts back into one Pack (the Direction Pack's input).
export function joinPack(design: DirectionArtifact, proposal: ScopeArtifact, discovery: MeetingArtifact): Pack {
  const { format: _f1, v: _v1, blueprint, ...understanding } = design;
  const { format: _f2, v: _v2, language: _l2, ...scope } = proposal;
  const { format: _f3, v: _v3, language: _l3, ...meeting } = discovery;
  void [_f1, _v1, _f2, _v2, _l2, _f3, _v3, _l3];
  return { ...understanding, design_blueprint: blueprint, ...scope, ...meeting };
}

// ----- Problems: anything that stops a version from being saved

export type PackProblem =
  | { kind: "schema"; path: string }
  | { kind: "wrong_language" }
  | { kind: "wrong_script"; section: string }
  | { kind: "ungrounded_fact"; section: string; index: number }
  | { kind: "unsupported_number"; section: string; value: string }
  | { kind: "commitment"; section: string }
  | { kind: "unsupported_claim"; section: string }
  | { kind: "markup"; section: string }
  | { kind: "pattern_kind"; pattern: string }
  | { kind: "proposal_kind"; pattern: string }
  | { kind: "template_not_in_pattern"; screen: string; template: string }
  | { kind: "screens"; detail: string }
  | { kind: "flow_screen"; screen: string };

export const PROBLEM_KINDS = ["schema", "wrong_language", "wrong_script", "ungrounded_fact", "unsupported_number", "commitment", "unsupported_claim", "markup", "pattern_kind", "proposal_kind", "template_not_in_pattern", "screens", "flow_screen"] as const;

// Promises the team never makes before discovery, in any section, assumptions included.
// ("Warranty" is deliberately not here: it is often the client's own business.)
const COMMITMENT =
  /\b(guarantee[sd]?|guaranteeing|fixed[- ]price|fixed (cost|fee)|we will deliver|will be (delivered|ready|live|launched) (by|in|within|on)|go[- ]live (by|on|in)|free of charge|at no (extra )?cost|unlimited revisions|risk[- ]free)\b|نضمن|مضمون|ضمان|سعر ثابت|نلتزم بتسليم|سنسلّم|سنسلم|مجانًا|مجانا|بدون أي تكلفة/i;
// Proof we cannot stand behind before a meeting: endorsements and superlatives.
const CLAIM =
  /\b(trusted by|loved by|testimonials?|award[- ]winning|best[- ]in[- ]class|world[- ]class|industry[- ]leading|market[- ]leading|number one|five[- ]star|5[- ]star)\b|#1\b|يثق بنا|موثوق من قبل|شهادات العملاء|حائز على جائزة|الأفضل في السوق|الأول في السوق|رقم واحد|خمس نجوم/i;
// Markup, links and ways to reach someone never belong in a Pack.
const MARKUP = /<\/?[a-z][^>]*>|\]\(|https?:\/\/|\bwww\.|javascript:|[\w.+-]+@[\w-]+\.[\w.]+|```/i;
// Text that reads as unfinished: allowed while working, never presented.
const PLACEHOLDER = /lorem ipsum|\b(TBD|TBC|TODO|FIXME)\b|\[[^\]]{1,40}\]|\{\{|xxx|نص تجريبي|يُحدَّد لاحقًا/i;
const ARABIC = /[؀-ۿ]/;

export interface PackContext {
  brief: string;
  language: BriefLanguage;
  projectType?: string | null;
}

// Every string a person reads, with its path (ids, bases and pattern names are not prose).
const NOT_PROSE = new Set(["id", "template", "pattern", "screen", "bank", "basis", "format", "v", "language"]);
function proseEntries(value: unknown, path: string, out: [string, string][]) {
  if (typeof value === "string") out.push([path, value]);
  else if (Array.isArray(value)) value.forEach((v, i) => proseEntries(v, `${path}.${i}`, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (NOT_PROSE.has(k)) continue;
      proseEntries(v, path ? `${path}.${k}` : k, out);
    }
  }
}
const sectionOf = (path: string) => (path.startsWith("blueprint") ? "design_blueprint" : path.split(".")[0]);

export function languageProblems(language: string, ctx: PackContext): PackProblem[] {
  return language === ctx.language ? [] : [{ kind: "wrong_language" }];
}

// A client fact (and any statement marked as one) must quote the brief.
export function groundingProblems(u: Partial<Understanding>, ctx: PackContext): PackProblem[] {
  const source = normalizeForMatch(ctx.brief);
  const quoted = (evidence: string | undefined) => {
    const e = normalizeForMatch(evidence ?? "");
    return e.length > 0 && source.includes(e);
  };
  const problems: PackProblem[] = [];
  (u.client_facts ?? []).forEach((f, index) => {
    if (!quoted(f.evidence)) problems.push({ kind: "ungrounded_fact", section: "client_facts", index });
  });
  for (const section of ["business_context", "users", "problem", "goals"] as const) {
    (u[section] ?? []).forEach((s, index) => {
      if (s.basis === "client_fact" && !quoted(s.evidence)) problems.push({ kind: "ungrounded_fact", section, index });
    });
  }
  return problems;
}

// No figure the client did not state, no promise, no invented proof, no markup or
// contact detail, anywhere; and the whole thing in the brief's own script.
export function proseProblems(content: object, ctx: PackContext): PackProblem[] {
  const stated = new Set(figuresIn(ctx.brief));
  const all: [string, string][] = [];
  proseEntries(content, "", all);
  const problems: PackProblem[] = [];
  const seen = new Set<string>();
  const add = (p: PackProblem) => {
    const key = JSON.stringify(p);
    if (!seen.has(key)) {
      seen.add(key);
      problems.push(p);
    }
  };
  let foreign = 0;
  for (const [path, value] of all) {
    const section = sectionOf(path);
    for (const n of figuresIn(value)) if (!stated.has(n)) add({ kind: "unsupported_number", section, value: n });
    if (COMMITMENT.test(value)) add({ kind: "commitment", section });
    if (CLAIM.test(value)) add({ kind: "unsupported_claim", section });
    if (MARKUP.test(value)) add({ kind: "markup", section });
    if ((ctx.language === "ar") !== ARABIC.test(value)) foreign++;
  }
  // Names and brand words may stay in another script; most of the text may not.
  if (all.length >= 4 && foreign / all.length > 0.25) add({ kind: "wrong_script", section: "all" });
  return problems;
}

// The design: a library pattern that suits the client's own answer, its own
// templates only, two to four screens, and a flow through those screens.
export function designProblems(d: { design_blueprint: Pack["design_blueprint"]; screens: Pack["screens"]; user_flow: Pack["user_flow"] }, ctx: PackContext): PackProblem[] {
  const problems: PackProblem[] = [];
  const pattern = d.design_blueprint.pattern as PatternId | null;
  if (pattern) {
    const kind: ProjectKind | null = kindFromProjectType(ctx.projectType);
    if (kind && PATTERNS[pattern].kind !== kind) problems.push({ kind: "pattern_kind", pattern });
    for (const s of d.screens) {
      if (!(PATTERNS[pattern].templates as readonly string[]).includes(s.template)) problems.push({ kind: "template_not_in_pattern", screen: s.id, template: s.template });
      const max = TEMPLATES[s.template as keyof typeof TEMPLATES]?.maxItems ?? 0;
      if (s.items.length > max) problems.push({ kind: "screens", detail: `${s.id}_too_many_items` });
    }
    if (d.screens.length < 2) problems.push({ kind: "screens", detail: "too_few" });
    const ids = d.screens.map((s) => s.id);
    if (new Set(ids).size !== ids.length) problems.push({ kind: "screens", detail: "duplicate_ids" });
    if (d.user_flow.length < 2) problems.push({ kind: "screens", detail: "flow_too_short" });
    for (const step of d.user_flow) if (!ids.includes(step.screen)) problems.push({ kind: "flow_screen", screen: step.screen });
  } else {
    if (!d.design_blueprint.unsupported_reason) problems.push({ kind: "screens", detail: "unsupported_without_reason" });
    if (d.screens.length > 0) problems.push({ kind: "screens", detail: "screens_without_pattern" });
  }
  return problems;
}

// The proposal direction follows a proposal pattern that suits the client's own
// answer (an existing product suits any kind).
export function proposalProblems(p: Pick<Pack, "proposal_direction">, ctx: PackContext): PackProblem[] {
  const kind = kindFromProjectType(ctx.projectType);
  const pattern = PROPOSAL_PATTERNS[p.proposal_direction.pattern as ProposalPatternId];
  return kind && pattern.kind && pattern.kind !== kind ? [{ kind: "proposal_kind", pattern: p.proposal_direction.pattern }] : [];
}

export function packProblems(pack: Pack, ctx: PackContext): PackProblem[] {
  return [...languageProblems(pack.language, ctx), ...groundingProblems(pack, ctx), ...proseProblems(pack, ctx), ...designProblems(pack, ctx), ...proposalProblems(pack, ctx)];
}

export type PackValidation = { ok: true; pack: Pack } | { ok: false; problems: PackProblem[] };

export const schemaProblems = (issues: z.core.$ZodIssue[]): PackProblem[] => issues.slice(0, 6).map((i) => ({ kind: "schema", path: i.path.join(".") || i.message }));

export function validatePack(raw: unknown, ctx: PackContext): PackValidation {
  const parsed = packSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, problems: schemaProblems(parsed.error.issues) };
  const problems = packProblems(parsed.data, ctx);
  return problems.length ? { ok: false, problems } : { ok: true, pack: parsed.data };
}

// One stored or edited artifact, checked exactly as it would be inside a Pack.
export type ArtifactValidation<K extends ArtifactKind> = { ok: true; content: z.infer<(typeof ARTIFACT_SCHEMAS)[K]> } | { ok: false; problems: PackProblem[] };

export function artifactProblems(kind: ArtifactKind, content: PackArtifact, ctx: PackContext): PackProblem[] {
  const problems = [...languageProblems(content.language, ctx), ...proseProblems(content, ctx)];
  if (kind === "design") {
    const d = content as DirectionArtifact;
    problems.push(...groundingProblems(d, ctx), ...designProblems({ design_blueprint: d.blueprint, screens: d.screens, user_flow: d.user_flow }, ctx));
  } else if (kind === "proposal") problems.push(...proposalProblems(content as ScopeArtifact, ctx));
  return problems;
}

export function validateArtifact<K extends ArtifactKind>(kind: K, raw: unknown, ctx: PackContext): ArtifactValidation<K> {
  const parsed = ARTIFACT_SCHEMAS[kind].safeParse(raw);
  if (!parsed.success) return { ok: false, problems: schemaProblems(parsed.error.issues) };
  const problems = artifactProblems(kind, parsed.data as PackArtifact, ctx);
  return problems.length ? { ok: false, problems } : { ok: true, content: parsed.data as z.infer<(typeof ARTIFACT_SCHEMAS)[K]> };
}

// ----- Classification: every statement has exactly one basis

export type StatementBasis = "client_fact" | "assumption" | "recommendation" | "question";
export interface Statement {
  section: SectionKey;
  path: string;
  text: string;
  basis: StatementBasis;
}

// The basis of each section; "per_item" sections carry it on each statement.
export const SECTION_BASIS: Record<SectionKey, StatementBasis | "per_item"> = {
  client_facts: "client_fact",
  assumptions: "assumption",
  missing_information: "question",
  business_context: "per_item",
  users: "per_item",
  problem: "per_item",
  goals: "per_item",
  design_blueprint: "recommendation",
  screens: "recommendation",
  user_flow: "recommendation",
  scope_direction: "recommendation",
  proposal_direction: "recommendation",
  discovery_questions: "question",
  decisions_needed: "question",
  risks: "assumption",
  meeting_agenda: "recommendation",
  next_steps: "recommendation",
};

// The basis of one statement, from its section and path.
export function basisAt(pack: Pick<Pack, "business_context" | "users" | "problem" | "goals">, section: SectionKey, path: string): StatementBasis {
  const basis = SECTION_BASIS[section];
  if (basis !== "per_item") return section === "discovery_questions" && path.endsWith(".purpose") ? "recommendation" : basis;
  // The quote behind a statement is the client's own words.
  if (path.endsWith(".evidence")) return "client_fact";
  const item = (pack[section as "business_context" | "users" | "problem" | "goals"] as { basis: "client_fact" | "assumption" }[])[Number(path.split(".")[1])];
  return item.basis;
}

export function classifyPack(pack: Pack): Statement[] {
  const out: Statement[] = [];
  for (const section of SECTION_KEYS) {
    const entries: [string, string][] = [];
    proseEntries(pack[section], section, entries);
    for (const [path, value] of entries) out.push({ section, path, text: value, basis: basisAt(pack, section, path) });
  }
  return out;
}

// ----- Findings: shown to the reviewer, never blocking a save

export type Finding =
  | { kind: "placeholder"; section: string }
  | { kind: "hand_design" }
  | { kind: "open_points"; count: number }
  | { kind: "assumption_heavy"; facts: number; assumptions: number }
  | { kind: "few_topics"; banks: number }
  | { kind: "no_risks" }
  | { kind: "legacy_format" };

// Findings that stop a version from being presented to a client.
export const PRESENTATION_BLOCKERS: Finding["kind"][] = ["placeholder", "hand_design", "legacy_format"];

export function artifactFindings(kind: ArtifactKind, content: unknown): Finding[] {
  const parsed = ARTIFACT_SCHEMAS[kind].safeParse(content);
  if (!parsed.success) return [{ kind: "legacy_format" }];
  const c = parsed.data as PackArtifact;
  const findings: Finding[] = [];
  const all: [string, string][] = [];
  proseEntries(c, "", all);
  for (const section of new Set(all.filter(([, v]) => PLACEHOLDER.test(v)).map(([p]) => sectionOf(p)))) findings.push({ kind: "placeholder", section });
  if (kind === "design") {
    const d = c as DirectionArtifact;
    if (!d.blueprint.pattern) findings.push({ kind: "hand_design" });
    if (d.missing_information.length > 0) findings.push({ kind: "open_points", count: d.missing_information.length });
    if (d.assumptions.length > d.client_facts.length) findings.push({ kind: "assumption_heavy", facts: d.client_facts.length, assumptions: d.assumptions.length });
  }
  if (kind === "discovery") {
    const m = c as MeetingArtifact;
    const banks = new Set(m.discovery_questions.map((q) => q.bank)).size;
    if (banks < 3) findings.push({ kind: "few_topics", banks });
    if (m.risks.length === 0) findings.push({ kind: "no_risks" });
  }
  return findings;
}

export const blocksPresentation = (findings: Finding[]) => findings.some((f) => PRESENTATION_BLOCKERS.includes(f.kind));

// ----- Drawing a stored design (format 2, or the first format in a version's history)

export interface DesignView {
  language: BriefLanguage;
  pattern: string;
  kind: ProjectKind;
  name: { en: string; ar: string };
  notes: { direction?: string; audience?: string; goal?: string; hierarchy: string[]; responsive?: string; brand: string };
  screens: Pack["screens"];
  user_flow: Pack["user_flow"];
}

const legacyBlueprint = z
  .object({
    pattern: z.string().nullable(),
    unsupported_reason: z.string().optional(),
    audience: z.string(),
    primary_goal: z.string(),
    hierarchy: z.array(z.string()),
    responsive_notes: z.string().optional(),
    brand_context: z.string(),
  })
  .strict();

// A stored design, re-checked before it is ever drawn: anything that is not a
// library pattern with its own library templates is not drawn.
export function renderableDesign(content: unknown): DesignView | null {
  const c = content as { format?: string; v?: number; language?: string; blueprint?: unknown; screens?: unknown; user_flow?: unknown } | null;
  if (!c || c.format !== "pack-design") return null;
  const shape = z.object({ language: languageSchema, screens: designPart.screens, user_flow: designPart.user_flow }).safeParse({ language: c.language, screens: c.screens, user_flow: c.user_flow });
  if (!shape.success) return null;
  let pattern: string | null;
  let notes: DesignView["notes"];
  if (c.v === PACK_FORMAT_VERSION) {
    const b = designPart.design_blueprint.safeParse(c.blueprint);
    if (!b.success) return null;
    pattern = b.data.pattern;
    notes = { direction: b.data.direction, hierarchy: b.data.hierarchy, responsive: b.data.responsive_notes, brand: b.data.brand_context };
  } else {
    const b = legacyBlueprint.safeParse(c.blueprint);
    if (!b.success) return null;
    pattern = b.data.pattern;
    notes = { audience: b.data.audience, goal: b.data.primary_goal, hierarchy: b.data.hierarchy, responsive: b.data.responsive_notes, brand: b.data.brand_context };
  }
  const info = pattern ? patternInfo(pattern) : null;
  if (!pattern || !info || shape.data.screens.length === 0) return null;
  if (!shape.data.screens.every((s) => (info.templates as readonly string[]).includes(s.template))) return null;
  return { language: shape.data.language, pattern, kind: info.kind, name: { en: info.en, ar: info.ar }, notes, screens: shape.data.screens, user_flow: shape.data.user_flow };
}

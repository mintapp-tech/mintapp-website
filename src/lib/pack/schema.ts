import { z } from "zod";
import { figuresIn, normalizeForMatch } from "@/lib/preparation/draft";
import type { BriefLanguage } from "@/lib/preparation/input";
import { PATTERNS, TEMPLATES, isPatternId, isTemplateId, kindFromProjectType, type PatternId, type ProjectKind } from "./patterns";

// The Pre-meeting Pack's content rules. Automated preparation produces it in
// four bounded steps (src/lib/pack/steps.ts); the manual Claude path returns it
// as one object. Both are validated here before anything is saved. Client facts,
// assumptions and recommendations are kept apart; every fact quotes the brief;
// no figure may appear that the client did not state; the design uses only
// pattern and template ids from the library. The result is three artifacts
// (initial design, draft proposal, discovery pack).

const text = (max: number) => z.string().trim().min(1).max(max);
const list = <T extends z.ZodType>(item: T, min: number, max: number) => z.array(item).min(min).max(max);

// ----- Parts, shared by the four steps and the single manual object

export const languageSchema = z.enum(["en", "ar"]);

export const factsPart = {
  client_facts: list(z.object({ text: text(300), evidence: text(300) }).strict(), 0, 12),
  assumptions: list(z.object({ text: text(300), reason: text(300) }).strict(), 0, 10),
  missing_information: list(text(200), 0, 10),
};

const screen = z
  .object({
    id: z.string().regex(/^s[1-4]$/),
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
      audience: text(240),
      primary_goal: text(240),
      hierarchy: list(text(200), 1, 6),
      responsive_notes: text(300).optional(),
      brand_context: text(240),
    })
    .strict(),
  screens: list(screen, 0, 4),
  user_flow: list(z.object({ step: text(160), screen: z.string().regex(/^s[1-4]$/) }).strict(), 0, 6),
};

export const proposalPart = {
  proposal: z
    .object({
      understanding: text(600),
      recommended_solution: text(600),
      first_release_scope: list(text(200), 1, 8),
      phases: list(z.object({ name: text(80), summary: text(300) }).strict(), 0, 4),
      deliverables: list(text(200), 1, 8),
      assumptions: list(text(240), 0, 8),
      exclusions: list(text(200), 0, 8),
      cost_schedule_factors: list(text(240), 1, 8),
      next_step: text(300),
    })
    .strict(),
};

export const discoveryPart = {
  discovery_questions: list(z.object({ question: text(250), purpose: text(250) }).strict(), 3, 10),
  risks: list(z.object({ risk: text(240), why: text(240) }).strict(), 0, 6),
  client_decisions: list(text(200), 0, 6),
  meeting_agenda: list(z.object({ item: text(120), purpose: text(200) }).strict(), 2, 8),
  confirm_before_pricing: list(text(200), 1, 8),
};

// The whole pack as one object (the manual Claude path).
export const packSchema = z.object({ language: languageSchema, ...factsPart, ...designPart, ...proposalPart, ...discoveryPart }).strict();

export type PackResponse = z.infer<typeof packSchema>;

export type PackProblem =
  | { kind: "schema"; path: string }
  | { kind: "wrong_language" }
  | { kind: "ungrounded_fact"; index: number }
  | { kind: "unsupported_number"; section: string; value: string }
  | { kind: "commitment"; section: string }
  | { kind: "pattern_kind"; pattern: string }
  | { kind: "template_not_in_pattern"; screen: string; template: string }
  | { kind: "screens"; detail: string }
  | { kind: "flow_screen"; screen: string };

// Promises the team never makes before a meeting.
const COMMITMENT = /\b(guarantee[sd]?|guaranteeing|warrant(y|ies)|fixed[- ]price|we will deliver by|risk[- ]free)\b|نضمن|مضمون|ضمان|سعر ثابت|نلتزم بتسليم/i;

function strings(value: unknown, path: string, out: [string, string][]) {
  if (typeof value === "string") out.push([path, value]);
  else if (Array.isArray(value)) value.forEach((v, i) => strings(v, `${path}.${i}`, out));
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) strings(v, path ? `${path}.${k}` : k, out);
}

export interface PackContext {
  brief: string;
  language: BriefLanguage;
  projectType?: string | null;
}

// ----- Checks, one per kind of content

export function languageProblems(language: string, ctx: PackContext): PackProblem[] {
  return language === ctx.language ? [] : [{ kind: "wrong_language" }];
}

// Every fact quotes the brief.
export function factProblems(facts: { evidence: string }[], ctx: PackContext): PackProblem[] {
  const source = normalizeForMatch(ctx.brief);
  const problems: PackProblem[] = [];
  facts.forEach((f, index) => {
    const evidence = normalizeForMatch(f.evidence);
    if (!evidence || !source.includes(evidence)) problems.push({ kind: "ungrounded_fact", index });
  });
  return problems;
}

// No figure anywhere unless the client stated it (no invented prices, dates,
// durations, quantities or metrics), and no promise. Ids are not prose.
export function proseProblems(prose: Record<string, unknown>, ctx: PackContext): PackProblem[] {
  const stated = new Set(figuresIn(ctx.brief));
  const all: [string, string][] = [];
  strings(prose, "", all);
  const problems: PackProblem[] = [];
  for (const [path, value] of all) {
    for (const n of figuresIn(value)) if (!stated.has(n)) problems.push({ kind: "unsupported_number", section: path.split(".")[0], value: n });
    if (COMMITMENT.test(value)) problems.push({ kind: "commitment", section: path.split(".")[0] });
  }
  return problems;
}

// The prose of a design, without its ids.
export const designProse = (d: Pick<PackResponse, "design_blueprint" | "screens" | "user_flow">) => ({
  design_blueprint: { ...d.design_blueprint, pattern: null },
  screens: d.screens.map((sc) => ({ title: sc.title, purpose: sc.purpose, headline: sc.headline, supporting_text: sc.supporting_text, items: sc.items, primary_action: sc.primary_action, secondary_action: sc.secondary_action })),
  user_flow: d.user_flow.map((u) => u.step),
});

// The design: a library pattern that suits the client's own answer, its own
// templates only, two to four screens, and a flow through those screens.
export function designProblems(d: Pick<PackResponse, "design_blueprint" | "screens" | "user_flow">, ctx: PackContext): PackProblem[] {
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

export function packProblems(pack: PackResponse, ctx: PackContext): PackProblem[] {
  const { language: _language, design_blueprint, screens, user_flow, ...rest } = pack;
  void _language;
  return [
    ...languageProblems(pack.language, ctx),
    ...factProblems(pack.client_facts, ctx),
    ...proseProblems({ ...rest, ...designProse({ design_blueprint, screens, user_flow }) }, ctx),
    ...designProblems(pack, ctx),
  ];
}

export type PackValidation = { ok: true; pack: PackResponse } | { ok: false; problems: PackProblem[] };

export const schemaProblems = (issues: z.core.$ZodIssue[]): PackProblem[] => issues.slice(0, 6).map((i) => ({ kind: "schema", path: i.path.join(".") || i.message }));

export function validatePack(raw: unknown, ctx: PackContext): PackValidation {
  const parsed = packSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, problems: schemaProblems(parsed.error.issues) };
  const problems = packProblems(parsed.data, ctx);
  return problems.length ? { ok: false, problems } : { ok: true, pack: parsed.data };
}

// ----- The three stored artifacts

export const PACK_FORMAT_VERSION = 1;

export interface DesignArtifact {
  format: "pack-design";
  v: number;
  language: BriefLanguage;
  blueprint: PackResponse["design_blueprint"];
  screens: PackResponse["screens"];
  user_flow: PackResponse["user_flow"];
}
export interface ProposalArtifact {
  format: "pack-proposal";
  v: number;
  language: BriefLanguage;
  proposal: PackResponse["proposal"];
}
export interface DiscoveryArtifact {
  format: "pack-discovery";
  v: number;
  language: BriefLanguage;
  client_facts: PackResponse["client_facts"];
  assumptions: PackResponse["assumptions"];
  missing_information: PackResponse["missing_information"];
  discovery_questions: PackResponse["discovery_questions"];
  risks: PackResponse["risks"];
  client_decisions: PackResponse["client_decisions"];
  meeting_agenda: PackResponse["meeting_agenda"];
  confirm_before_pricing: PackResponse["confirm_before_pricing"];
}
export interface TextArtifact {
  format: "text";
  body: string;
}

type Facts = Pick<PackResponse, "client_facts" | "assumptions" | "missing_information">;

export const designArtifact = (language: BriefLanguage, d: Pick<PackResponse, "design_blueprint" | "screens" | "user_flow">): DesignArtifact => ({
  format: "pack-design",
  v: PACK_FORMAT_VERSION,
  language,
  blueprint: d.design_blueprint,
  screens: d.screens,
  user_flow: d.user_flow,
});
export const proposalArtifact = (language: BriefLanguage, p: Pick<PackResponse, "proposal">): ProposalArtifact => ({ format: "pack-proposal", v: PACK_FORMAT_VERSION, language, proposal: p.proposal });
export const discoveryArtifact = (language: BriefLanguage, facts: Facts, d: Pick<PackResponse, "discovery_questions" | "risks" | "client_decisions" | "meeting_agenda" | "confirm_before_pricing">): DiscoveryArtifact => ({
  format: "pack-discovery",
  v: PACK_FORMAT_VERSION,
  language,
  client_facts: facts.client_facts,
  assumptions: facts.assumptions,
  missing_information: facts.missing_information,
  discovery_questions: d.discovery_questions,
  risks: d.risks,
  client_decisions: d.client_decisions,
  meeting_agenda: d.meeting_agenda,
  confirm_before_pricing: d.confirm_before_pricing,
});

export function splitPack(pack: PackResponse): { design: DesignArtifact; proposal: ProposalArtifact; discovery: DiscoveryArtifact } {
  return { design: designArtifact(pack.language, pack), proposal: proposalArtifact(pack.language, pack), discovery: discoveryArtifact(pack.language, pack, pack) };
}

// A stored design artifact, re-checked before it is ever rendered: anything that
// is not a library pattern with library templates is not drawn.
export function renderableDesign(content: unknown): DesignArtifact | null {
  const c = content as Partial<DesignArtifact> | null;
  if (!c || c.format !== "pack-design" || !c.blueprint || !Array.isArray(c.screens) || !Array.isArray(c.user_flow)) return null;
  const parsed = z
    .object({ blueprint: designPart.design_blueprint, screens: designPart.screens, user_flow: designPart.user_flow, language: languageSchema })
    .safeParse({ blueprint: c.blueprint, screens: c.screens, user_flow: c.user_flow, language: c.language });
  if (!parsed.success || !parsed.data.blueprint.pattern) return null;
  const pattern = PATTERNS[parsed.data.blueprint.pattern as PatternId];
  if (!parsed.data.screens.every((s) => (pattern.templates as readonly string[]).includes(s.template))) return null;
  return { format: "pack-design", v: c.v ?? PACK_FORMAT_VERSION, ...parsed.data };
}

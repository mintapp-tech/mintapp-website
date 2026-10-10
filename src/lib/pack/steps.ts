import { z } from "zod";
import type { GenerationInput } from "@/lib/preparation/input";
import { catalogueText } from "./patterns";
import {
  designArtifact,
  designPart,
  designProblems,
  designProse,
  discoveryArtifact,
  discoveryPart,
  factProblems,
  factsPart,
  languageProblems,
  languageSchema,
  proposalArtifact,
  proposalPart,
  proseProblems,
  schemaProblems,
  type DesignArtifact,
  type DiscoveryArtifact,
  type PackContext,
  type PackProblem,
  type ProposalArtifact,
} from "./schema";

// Automated preparation in four bounded requests instead of one large one:
//
//   1. analysis   the brief's facts (each quoting it), assumptions, missing information
//   2. design     the initial-design specification (library pattern, 2-4 screens, flow)
//   3. proposal   the draft proposal
//   4. discovery  questions, risks, decisions, agenda, what to confirm before pricing
//
// Each request gets the sanitised brief (and, after step 1, its validated facts),
// returns one strict JSON object, has its own output ceiling, and is validated
// and saved on its own. Step 1 must succeed first; steps 2-4 are independent, so
// one failing never discards the others. The manual Claude path still uses the
// single object in prompt.ts.

export const PACK_STEPS = ["analysis", "design", "proposal", "discovery"] as const;
export type PackStep = (typeof PACK_STEPS)[number];
export const STEP_PROMPT_VERSION = "pack-steps-v1";

// Output ceilings (max_tokens) per request. Reasoning models count their hidden
// reasoning inside these, so they leave room for it; the gateway raises anything
// below 2,048 to 2,048. Tuned on the synthetic evaluation (docs/two-founder-crm.md).
export const STEP_MAX_TOKENS: Record<PackStep, number> = { analysis: 4000, design: 6000, proposal: 4000, discovery: 4000 };

export const analysisSchema = z.object({ language: languageSchema, ...factsPart }).strict();
export const designStepSchema = z.object({ language: languageSchema, ...designPart }).strict();
export const proposalStepSchema = z.object({ language: languageSchema, ...proposalPart }).strict();
export const discoveryStepSchema = z.object({ language: languageSchema, ...discoveryPart }).strict();

export type Analysis = z.infer<typeof analysisSchema>;
type StepValue = { analysis: Analysis; design: z.infer<typeof designStepSchema>; proposal: z.infer<typeof proposalStepSchema>; discovery: z.infer<typeof discoveryStepSchema> };

// What a later step is given: the validated analysis.
export interface StepContext {
  analysis?: Analysis;
}

const SCHEMAS = { analysis: analysisSchema, design: designStepSchema, proposal: proposalStepSchema, discovery: discoveryStepSchema };

export type StepValidation<S extends PackStep> = { ok: true; value: StepValue[S] } | { ok: false; problems: PackProblem[] };

export function validateStep<S extends PackStep>(step: S, raw: unknown, ctx: PackContext): StepValidation<S> {
  const parsed = SCHEMAS[step].safeParse(raw);
  if (!parsed.success) return { ok: false, problems: schemaProblems(parsed.error.issues) };
  const v = parsed.data as StepValue[PackStep];
  const problems: PackProblem[] = [...languageProblems(v.language, ctx)];
  if (step === "analysis") {
    const a = v as Analysis;
    problems.push(...factProblems(a.client_facts, ctx), ...proseProblems({ client_facts: a.client_facts, assumptions: a.assumptions, missing_information: a.missing_information }, ctx));
  } else if (step === "design") {
    const d = v as StepValue["design"];
    problems.push(...proseProblems(designProse(d), ctx), ...designProblems(d, ctx));
  } else {
    const { language: _l, ...prose } = v;
    void _l;
    problems.push(...proseProblems(prose, ctx));
  }
  return problems.length ? { ok: false, problems } : { ok: true, value: v as StepValue[S] };
}

// The artifact a validated step becomes (discovery also carries the analysis).
export function artifactFor(step: "design" | "proposal" | "discovery", value: unknown, analysis: Analysis): DesignArtifact | ProposalArtifact | DiscoveryArtifact {
  if (step === "design") return designArtifact(analysis.language, value as StepValue["design"]);
  if (step === "proposal") return proposalArtifact(analysis.language, value as StepValue["proposal"]);
  return discoveryArtifact(analysis.language, analysis, value as StepValue["discovery"]);
}

// ----- Prompts

const SHAPES: Record<PackStep, string> = {
  analysis: `{
  "language": "en" | "ar",
  "client_facts": [{ "text": string, "evidence": string }],
  "assumptions": [{ "text": string, "reason": string }],
  "missing_information": [string]
}`,
  design: `{
  "language": "en" | "ar",
  "design_blueprint": {
    "pattern": "<one pattern id from the catalogue>" | null,
    "unsupported_reason": string (only when pattern is null),
    "audience": string, "primary_goal": string, "hierarchy": [string],
    "responsive_notes": string (optional), "brand_context": string
  },
  "screens": [{
    "id": "s1" | "s2" | "s3" | "s4",
    "template": "<one template id allowed by the chosen pattern>",
    "title": string, "purpose": string, "headline": string, "supporting_text": string (optional),
    "items": [{ "title": string, "text": string }],
    "primary_action": string (optional), "secondary_action": string (optional)
  }],
  "user_flow": [{ "step": string, "screen": "s1" | "s2" | "s3" | "s4" }]
}`,
  proposal: `{
  "language": "en" | "ar",
  "proposal": {
    "understanding": string, "recommended_solution": string,
    "first_release_scope": [string], "phases": [{ "name": string, "summary": string }],
    "deliverables": [string], "assumptions": [string], "exclusions": [string],
    "cost_schedule_factors": [string], "next_step": string
  }
}`,
  discovery: `{
  "language": "en" | "ar",
  "discovery_questions": [{ "question": string, "purpose": string }],
  "risks": [{ "risk": string, "why": string }],
  "client_decisions": [string],
  "meeting_agenda": [{ "item": string, "purpose": string }],
  "confirm_before_pricing": [string]
}`,
};

const TASKS: Record<PackStep, string[]> = {
  analysis: [
    "Task: read the brief and list what it actually says.",
    '- "client_facts": only what the brief states, at most 10; "evidence" must be an exact, contiguous quote copied from the brief.',
    '- Anything you infer goes in "assumptions" with the reason (at most 6); anything unknown that matters for a first meeting goes in "missing_information" (at most 8). Never present an assumption as a fact.',
  ],
  design: [
    "Task: a first visual direction, not a product. Choose ONE pattern from the catalogue below that suits the brief and the client's project type, then 2 to 4 screens using only that pattern's templates, the most important first. Each screen fills short text slots (headline, a few items, an action label). No code, HTML, CSS, colours or image descriptions.",
    '- If no pattern fits, set "pattern" to null, give "unsupported_reason", and return an empty "screens" and "user_flow": the team will prepare the design by hand.',
    '- "brand_context": say what brand material the brief mentions; if none, say so. Do not invent a brand.',
    "Pattern catalogue:",
    catalogueText(),
  ],
  proposal: [
    'Task: an internal first draft of a proposal, for discussion only, not a quote or commitment: modest and tied to the brief. "cost_schedule_factors" lists what will affect cost or schedule (factors only, never figures). At most 6 items in any list.',
  ],
  discovery: [
    'Task: prepare the first meeting. "discovery_questions": 3 to 8 specific questions, each with its purpose. "risks": at most 5. "client_decisions": at most 5 decisions the client must take, each one short sentence. "meeting_agenda": 2 to 6 items. "confirm_before_pricing": at most 6 things to confirm before final scope and pricing.',
  ],
};

export function stepSystemPrompt(step: PackStep, language: "en" | "ar"): string {
  const name = language === "ar" ? "Arabic" : "English";
  return [
    "You help Mintapp, a two-person digital product studio, prepare privately for a first meeting with a prospective client.",
    `Return ONE JSON object with exactly this shape and no other keys:`,
    SHAPES[step],
    ...TASKS[step],
    "Rules:",
    `- Write every value in ${name} and set "language" to "${language}". Ids stay as given.`,
    "- Never invent a price, cost, budget, deadline, duration, date, metric, quantity or requirement. Do not write any number that does not appear in the brief. Never promise or guarantee anything.",
    "- Be concise: short, plain sentences and the fewest list items that cover the brief.",
    "- This is internal. Do not address the client and never include contact details.",
    "Return only the JSON object.",
  ].join("\n");
}

// The analysis, as the later steps see it (compact JSON).
const analysisNote = (a: Analysis) =>
  JSON.stringify({ client_facts: a.client_facts.map((f) => f.text), assumptions: a.assumptions.map((x) => x.text), missing_information: a.missing_information });

export function stepMessages(step: PackStep, input: GenerationInput, context: StepContext) {
  if (step !== "analysis" && !context.analysis) throw new Error("analysis_required");
  const brief = `Client brief:\n"""\n${input.brief}\n"""`;
  const user = step === "analysis" ? brief : `${brief}\n\nWhat the brief establishes (already checked):\n${analysisNote(context.analysis!)}`;
  return [
    { role: "system" as const, content: stepSystemPrompt(step, input.language) },
    { role: "user" as const, content: user },
  ];
}

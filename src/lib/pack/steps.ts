import { z } from "zod";
import type { GenerationInput } from "@/lib/preparation/input";
import { partSystemPrompt, type PackPart } from "./prompt";
import {
  designPart,
  designProblems,
  directionArtifact,
  groundingProblems,
  languageProblems,
  languageSchema,
  meetingArtifact,
  meetingPart,
  proposalProblems,
  proseProblems,
  schemaProblems,
  scopeArtifact,
  scopePart,
  understandingPart,
  type DirectionArtifact,
  type MeetingArtifact,
  type PackContext,
  type PackProblem,
  type ScopeArtifact,
} from "./schema";

// Automated preparation in four bounded requests instead of one large one:
//
//   1. analysis   the understanding: facts (each quoting the brief), assumptions, missing
//                 information, business context, users, problem, goals
//   2. design     the product direction (library pattern, 2-4 screens, flow)
//   3. proposal   the scope and proposal direction
//   4. discovery  questions, decisions, risks, agenda, next steps
//
// Each request gets the sanitised brief (and, after step 1, its validated
// understanding), returns one strict JSON object, has its own output ceiling, and is
// validated and saved on its own. Step 1 must succeed first; steps 2-4 are
// independent, so one failing never discards the others. Step 1's result is stored
// with the design ("Initial product direction"). The manual Claude path uses the
// single object in prompt.ts; both share the same instructions.

export const PACK_STEPS = ["analysis", "design", "proposal", "discovery"] as const;
export type PackStep = (typeof PACK_STEPS)[number];
export const STEP_PROMPT_VERSION = "pack-steps-v2";

// Output ceilings (max_tokens) per request. Reasoning models count their hidden
// reasoning inside these, so they leave room for it; the gateway raises anything
// below 2,048 to 2,048. The analysis grew with the understanding sections.
export const STEP_MAX_TOKENS: Record<PackStep, number> = { analysis: 5000, design: 6000, proposal: 4000, discovery: 4000 };

const PART: Record<PackStep, PackPart> = { analysis: "understanding", design: "design", proposal: "scope", discovery: "meeting" };

export const analysisSchema = z.object({ language: languageSchema, ...understandingPart }).strict();
export const designStepSchema = z.object({ language: languageSchema, ...designPart }).strict();
export const proposalStepSchema = z.object({ language: languageSchema, ...scopePart }).strict();
export const discoveryStepSchema = z.object({ language: languageSchema, ...meetingPart }).strict();

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
  const problems: PackProblem[] = [...languageProblems(v.language, ctx), ...proseProblems(v, ctx)];
  if (step === "analysis") problems.push(...groundingProblems(v as Analysis, ctx));
  else if (step === "design") problems.push(...designProblems(v as StepValue["design"], ctx));
  else if (step === "proposal") problems.push(...proposalProblems(v as StepValue["proposal"], ctx));
  return problems.length ? { ok: false, problems } : { ok: true, value: v as StepValue[S] };
}

// The artifact a validated step becomes (the design carries the analysis).
export function artifactFor(step: "design" | "proposal" | "discovery", value: unknown, analysis: Analysis): DirectionArtifact | ScopeArtifact | MeetingArtifact {
  if (step === "design") return directionArtifact(analysis.language, analysis, value as StepValue["design"]);
  if (step === "proposal") return scopeArtifact(analysis.language, value as StepValue["proposal"]);
  return meetingArtifact(analysis.language, value as StepValue["discovery"]);
}

export function stepSystemPrompt(step: PackStep, language: "en" | "ar"): string {
  return partSystemPrompt(PART[step], language);
}

// The analysis, as the later steps see it (compact JSON).
const analysisNote = (a: Analysis) =>
  JSON.stringify({
    client_facts: a.client_facts.map((f) => f.text),
    assumptions: a.assumptions.map((x) => x.text),
    missing_information: a.missing_information,
    business_context: a.business_context.map((s) => s.text),
    users: a.users.map((u) => `${u.group}: ${u.needs}`),
    problem: a.problem.map((s) => s.text),
    goals: a.goals.map((s) => s.text),
  });

export function stepMessages(step: PackStep, input: GenerationInput, context: StepContext) {
  if (step !== "analysis" && !context.analysis) throw new Error("analysis_required");
  const brief = `Client brief:\n"""\n${input.brief}\n"""`;
  const user = step === "analysis" ? brief : `${brief}\n\nWhat the brief establishes (already checked):\n${analysisNote(context.analysis!)}`;
  return [
    { role: "system" as const, content: stepSystemPrompt(step, input.language) },
    { role: "user" as const, content: user },
  ];
}

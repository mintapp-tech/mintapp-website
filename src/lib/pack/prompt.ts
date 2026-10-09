import type { GenerationInput } from "@/lib/preparation/input";
import { catalogueText } from "./patterns";

// Instructions for the Pre-meeting Pack. The same text is used for CodeCraft and
// for the manual Claude Pro path (copied by a founder), so both produce the same
// shape. Everything here is enforced again by src/lib/pack/schema.ts.

export const PACK_PROMPT_VERSION = "pack-v1";

const SHAPE = `{
  "language": "en" | "ar",
  "client_facts": [{ "text": string, "evidence": string }],
  "assumptions": [{ "text": string, "reason": string }],
  "missing_information": [string],
  "design_blueprint": {
    "pattern": "<one pattern id from the catalogue>" | null,
    "unsupported_reason": string (only when pattern is null),
    "audience": string,
    "primary_goal": string,
    "hierarchy": [string],
    "responsive_notes": string (optional),
    "brand_context": string
  },
  "screens": [{
    "id": "s1" | "s2" | "s3" | "s4",
    "template": "<one template id allowed by the chosen pattern>",
    "title": string, "purpose": string, "headline": string, "supporting_text": string (optional),
    "items": [{ "title": string, "text": string }],
    "primary_action": string (optional), "secondary_action": string (optional)
  }],
  "user_flow": [{ "step": string, "screen": "s1" | "s2" | "s3" | "s4" }],
  "proposal": {
    "understanding": string, "recommended_solution": string,
    "first_release_scope": [string], "phases": [{ "name": string, "summary": string }],
    "deliverables": [string], "assumptions": [string], "exclusions": [string],
    "cost_schedule_factors": [string], "next_step": string
  },
  "discovery_questions": [{ "question": string, "purpose": string }],
  "risks": [{ "risk": string, "why": string }],
  "client_decisions": [string],
  "meeting_agenda": [{ "item": string, "purpose": string }],
  "confirm_before_pricing": [string]
}`;

export function packSystemPrompt(language: "en" | "ar"): string {
  const name = language === "ar" ? "Arabic" : "English";
  return [
    "You help Mintapp, a two-person digital product studio, prepare privately for a first meeting with a prospective client.",
    "You receive the client's own brief. Produce a Pre-meeting Pack as ONE JSON object with exactly this shape and no other keys:",
    SHAPE,
    "Rules:",
    `- Write every value in ${name} and set "language" to "${language}". Pattern, template and screen ids stay as given.`,
    '- "client_facts": only what the brief states; "evidence" must be an exact, contiguous quote copied from the brief.',
    '- Anything you infer goes in "assumptions" with the reason; anything unknown goes in "missing_information". Never present an assumption as a fact.',
    "- Never invent a price, cost, budget, deadline, duration, date, metric, quantity or requirement. Do not write any number that does not appear in the brief. Never promise or guarantee anything.",
    "- The design is a first visual direction, not a product: choose ONE pattern from the catalogue below that suits the brief and the client's project type, then 2 to 4 screens using only that pattern's templates, the most important first. Each screen fills short text slots (headline, a few items, an action label). No code, HTML, CSS, colours or image descriptions.",
    '- If no pattern fits, set "pattern" to null, give "unsupported_reason", and return an empty "screens" and "user_flow": the team will prepare the design by hand.',
    '- "brand_context": say what brand material the brief mentions; if none, say so. Do not invent a brand.',
    '- "proposal" is an internal first draft for discussion, not a quote or commitment: modest, tied to the brief, with what affects cost or schedule listed in "cost_schedule_factors" (factors only, no figures).',
    '- "discovery_questions": 3 to 10 specific questions, each with its purpose. "meeting_agenda": 2 to 8 items. "confirm_before_pricing": what must be confirmed before final scope and pricing.',
    "- This is internal. Do not address the client and never include contact details.",
    "Pattern catalogue:",
    catalogueText(),
    "Return only the JSON object.",
  ].join("\n");
}

export function buildPackMessages(input: GenerationInput) {
  return [
    { role: "system" as const, content: packSystemPrompt(input.language) },
    { role: "user" as const, content: `Client brief:\n"""\n${input.brief}\n"""` },
  ];
}

// What a founder copies into their own Claude Pro chat: the same instructions and
// the same sanitised brief, in one block.
export function manualPackPrompt(input: GenerationInput): string {
  return `${packSystemPrompt(input.language)}\n\nClient brief:\n"""\n${input.brief}\n"""`;
}

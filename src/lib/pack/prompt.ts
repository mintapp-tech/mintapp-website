import type { GenerationInput } from "@/lib/preparation/input";
import { bankCatalogueText, catalogueText, proposalCatalogueText } from "./library";

// The instructions for the Pre-meeting Pack, in one place: the four automated steps
// (steps.ts) and the manual Claude path (one object, copied by a founder or read by
// Claude Code from docs/pack-rules/) are built from these same pieces, so both
// produce the same format. Everything here is enforced again by schema.ts.

export const PACK_PROMPT_VERSION = "pack-v2";

export type PackPart = "understanding" | "design" | "scope" | "meeting";

const STATEMENT = `{ "text": string, "basis": "client_fact" | "assumption", "evidence": string (only for client_fact: an exact quote from the brief) }`;

export const PART_SHAPES: Record<PackPart, string> = {
  understanding: `  "client_facts": [{ "text": string, "evidence": string }],
  "assumptions": [{ "text": string, "reason": string }],
  "missing_information": [string],
  "business_context": [${STATEMENT}],
  "users": [{ "group": string, "needs": string, "basis": "client_fact" | "assumption", "evidence": string (only for client_fact) }],
  "problem": [${STATEMENT}],
  "goals": [${STATEMENT}]`,
  design: `  "design_blueprint": {
    "pattern": "<one product pattern id from the catalogue>" | null,
    "unsupported_reason": string (only when pattern is null),
    "direction": string, "hierarchy": [string], "responsive_notes": string, "brand_context": string
  },
  "screens": [{
    "id": "s1" | "s2" | "s3" | "s4",
    "template": "<one template id allowed by the chosen pattern>",
    "title": string, "purpose": string, "headline": string, "supporting_text": string (optional),
    "items": [{ "title": string, "text": string }],
    "primary_action": string (optional), "secondary_action": string (optional)
  }],
  "user_flow": [{ "step": string, "screen": "s1" | "s2" | "s3" | "s4" }]`,
  scope: `  "scope_direction": { "first_release": [string], "later": [string], "not_included": [string] },
  "proposal_direction": {
    "pattern": "<one proposal pattern id from the catalogue>",
    "approach": string, "phases": [{ "name": string, "summary": string }],
    "deliverables": [string], "cost_schedule_factors": [string]
  }`,
  meeting: `  "discovery_questions": [{ "question": string, "purpose": string, "bank": "<one discovery bank id>" }],
  "decisions_needed": [string],
  "risks": [{ "risk": string, "why": string }],
  "meeting_agenda": [{ "item": string, "purpose": string }],
  "next_steps": [string]`,
};

export const PART_TASKS: Record<PackPart, string[]> = {
  understanding: [
    '- "client_facts": only what the brief states, at most 10; "evidence" must be an exact, contiguous quote copied from the brief.',
    '- "business_context", "users", "problem", "goals": each statement says whether the client said it ("client_fact", with an exact quote as "evidence") or we infer it ("assumption", no evidence). One to four of each (goals up to five).',
    '- Anything else you infer goes in "assumptions" with the reason (at most 6); anything unknown that matters for a first meeting goes in "missing_information" (at most 8). Never present an assumption as a fact.',
  ],
  design: [
    "- The design is a first visual direction, not a product: choose ONE product pattern from the catalogue below that suits the brief and the client's project type, then 2 to 4 screens using only that pattern's templates, the most important first. Each screen fills short text slots (headline, a few items, an action label). No code, HTML, CSS, colours or image descriptions.",
    '- "direction": the product direction in two or three sentences. "responsive_notes": how it works on phones and on desktops (never desktop only).',
    '- If no pattern fits, set "pattern" to null, give "unsupported_reason", and return an empty "screens" and "user_flow": the team will prepare the design by hand.',
    '- "brand_context": say what brand material the brief mentions; if none, say so. Do not invent a brand.',
    "Product pattern catalogue:",
    catalogueText(),
  ],
  scope: [
    '- An indicative direction for discussion, never a quote or commitment: modest and tied to the brief. Choose ONE proposal pattern from the catalogue below that suits the project. "first_release" is what we recommend first; "later" can wait; "not_included" is what the first release leaves out. "cost_schedule_factors" lists what will affect cost or schedule (factors only, never figures). At most 6 items in any list, 1 to 3 phases.',
    "Proposal pattern catalogue:",
    proposalCatalogueText(),
  ],
  meeting: [
    '- "discovery_questions": 3 to 8 specific questions, each with its purpose and the discovery bank it belongs to; cover the topics that matter for this brief. "decisions_needed": at most 5 decisions the client must take. "risks": at most 5, each with why. "meeting_agenda": 2 to 6 items. "next_steps": 1 to 3 concrete next steps after the meeting.',
    "Discovery banks:",
    bankCatalogueText(),
  ],
};

export function commonRules(language: "en" | "ar"): string[] {
  const name = language === "ar" ? "Arabic" : "English";
  return [
    "Rules:",
    `- Write every value in ${name} and set "language" to "${language}". Ids (pattern, template, screen, bank, basis) stay as given.`,
    "- Never invent a price, cost, budget, deadline, duration, date, metric, quantity or requirement. Do not write any number that does not appear in the brief.",
    "- Never promise or guarantee anything, not even inside an assumption. No fixed price, no delivery date.",
    "- No invented proof: no statistics, testimonials, customers, users, awards or capabilities the brief does not state.",
    "- No markup, links, email addresses or phone numbers. No placeholder text such as lorem ipsum, TBD or bracketed notes.",
    "- Be concise: short, plain sentences and the fewest list items that cover the brief.",
    "- This is internal. Do not address the client and never include contact details.",
  ];
}

const INTRO = "You help Mintapp, a two-person digital product studio, prepare privately for a first meeting with a prospective client.";

export function packSystemPrompt(language: "en" | "ar"): string {
  const parts: PackPart[] = ["understanding", "design", "scope", "meeting"];
  return [
    INTRO,
    "You receive the client's own brief. Produce a Pre-meeting Pack as ONE JSON object with exactly this shape and no other keys:",
    `{\n  "language": "en" | "ar",\n${parts.map((p) => PART_SHAPES[p]).join(",\n")}\n}`,
    ...commonRules(language),
    "- The whole object should stay well under 1,500 words.",
    ...parts.flatMap((p) => PART_TASKS[p]),
    "Return only the JSON object.",
  ].join("\n");
}

export function partSystemPrompt(part: PackPart, language: "en" | "ar"): string {
  return [INTRO, "Return ONE JSON object with exactly this shape and no other keys:", `{\n  "language": "en" | "ar",\n${PART_SHAPES[part]}\n}`, ...PART_TASKS[part], ...commonRules(language), "Return only the JSON object."].join("\n");
}

export function buildPackMessages(input: GenerationInput) {
  return [
    { role: "system" as const, content: packSystemPrompt(input.language) },
    { role: "user" as const, content: `Client brief:\n"""\n${input.brief}\n"""` },
  ];
}

// What a founder copies into their own Claude chat: the same instructions and the
// same sanitised brief, in one block.
export function manualPackPrompt(input: GenerationInput): string {
  return `${packSystemPrompt(input.language)}\n\nClient brief:\n"""\n${input.brief}\n"""`;
}

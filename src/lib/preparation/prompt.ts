import type { GenerationInput } from "./input";

// Instructions for a language-model generator. The output is validated
// afterwards (draft.ts), so these rules are enforced, not just requested.

const SHAPE = `{
  "language": "en" | "ar",
  "summary": string,
  "clientFacts": {
    "problem": [{ "text": string, "evidence": string }],
    "audience": [{ "text": string, "evidence": string }],
    "goals": [{ "text": string, "evidence": string }],
    "existingMaterials": [{ "text": string, "evidence": string }],
    "constraints": [{ "text": string, "evidence": string }]
  },
  "assumptions": [{ "text": string, "reason": string }],
  "missingInformation": [string],
  "meetingQuestions": [{ "question": string, "purpose": string }],
  "suggestedScope": { "summary": string, "firstRelease": [string] },
  "nextStep": string,
  "proposalOutline": [{ "title": string, "notes": string }],
  "designDirection": [string]
}`;

export function buildMessages(input: GenerationInput) {
  const language = input.language === "ar" ? "Arabic" : "English";
  const system = [
    "You help a digital product studio prepare privately for a first meeting with a prospective client.",
    "You receive the client's own project brief. Produce an internal preparation draft as one JSON object with exactly this shape and no other keys:",
    SHAPE,
    "Rules:",
    `- Write every value in ${language}, and set "language" to "${input.language}".`,
    '- "clientFacts" holds only what the brief states. For each fact, "evidence" must be an exact, contiguous quote copied from the brief. If the brief does not state something, leave that list empty.',
    '- Anything you infer goes in "assumptions", with the reason. Anything unknown goes in "missingInformation".',
    "- Do not invent prices, costs, budgets, deadlines, durations, dates, metrics, research findings, market data or requirements. Do not write any number that does not appear in the brief.",
    '- "meetingQuestions": 3 to 8 specific questions that would help the first meeting, each with its purpose.',
    '- "suggestedScope" and "nextStep" are suggestions for the team to review, not commitments. Keep them modest and tied to the brief.',
    '- "proposalOutline" and "designDirection" are optional and short; omit them when the brief is too thin.',
    "- Never include contact details, and do not address the client: this draft is internal.",
    "Return only the JSON object.",
  ].join("\n");
  const user = `Client brief:\n"""\n${input.brief}\n"""`;
  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
}

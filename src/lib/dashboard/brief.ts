import { buildGenerationInput, type InquiryForPreparation } from "@/lib/preparation/input";
import { draftSchema, figuresIn } from "@/lib/preparation/draft";
import { clientProjectType } from "./project-type";
import { budgetLabel, timelineLabel } from "@/lib/form-options";

// The structured brief shown in the dashboard and copied into a team
// member's own Claude chat. Built only from the preparation input (the brief
// and the client's structured answers), so contact details never appear.

export interface StructuredBrief {
  language: "en" | "ar";
  provided: { label: string; value: string }[];
  missing: string[];
  description: string;
  text: string;
}

const FIELDS: [keyof InquiryForPreparation, string][] = [
  ["project_type", "Project type"],
  ["budget_range", "Estimated budget (client-stated)"],
  ["timeline", "Timeline (client-stated)"],
  ["country", "Country"],
];

export function structuredBrief(inquiry: InquiryForPreparation): StructuredBrief {
  const input = buildGenerationInput(inquiry);
  // Project type counts as provided only when it is one of the form's own choices.
  const has = (key: keyof InquiryForPreparation) => Boolean(key === "project_type" ? clientProjectType(inquiry.project_type) : inquiry[key]);
  // Budget and timeline are stored as codes: show what they mean, in the brief's language.
  const shown = (key: keyof InquiryForPreparation) =>
    key === "budget_range" ? budgetLabel(inquiry.budget_range, input.language) : key === "timeline" ? timelineLabel(inquiry.timeline, input.language) : String(inquiry[key]);
  const provided = FIELDS.filter(([key]) => has(key)).map(([key, label]) => ({ label, value: shown(key) ?? "" }));
  const missing = FIELDS.filter(([key]) => !has(key)).map(([, label]) => label.replace(/ \(client-stated\)$/, ""));
  return { language: input.language, provided, missing, description: inquiry.project_description.trim(), text: input.brief };
}

// What to paste into Claude. The same rules the automated path enforces,
// asking for Markdown a person can read, edit and paste back.
export function claudePrompt(brief: StructuredBrief): string {
  const language = brief.language === "ar" ? "Arabic" : "English";
  return [
    "You are helping a digital product studio prepare privately for a first meeting with a prospective client. Below is the client's own project brief.",
    `Write an internal preparation note in ${language}, in Markdown, with these sections:`,
    "1. Summary (2-3 sentences)",
    "2. Client facts: only what the brief states, each with the exact words from the brief in quotes",
    "3. Assumptions: what you infer, each with the reason",
    "4. Missing information",
    "5. Questions for the meeting (3-8), each with its purpose",
    "6. Suggested scope for a first release (a suggestion for the team, not a commitment)",
    "7. Suggested next step",
    "8. Optional: proposal outline and initial design direction, only if the brief supports them",
    "Rules: do not invent prices, costs, deadlines, durations, dates, metrics, research findings or requirements, and do not use any number that is not in the brief. Keep client facts separate from your assumptions and suggestions. This note is internal: do not address the client.",
    "",
    "Client brief:",
    '"""',
    brief.text,
    '"""',
  ].join("\n");
}

// Text shown and edited for any draft version.
export function draftText(content: unknown): string {
  if (content && typeof content === "object" && (content as { format?: unknown }).format === "text") return String((content as { body?: unknown }).body ?? "");
  const parsed = draftSchema.safeParse(content);
  if (!parsed.success) return JSON.stringify(content, null, 2);
  const d = parsed.data;
  const list = (items: string[]) => (items.length ? items.map((i) => `- ${i}`).join("\n") : "- (none)");
  const facts = Object.entries(d.clientFacts).flatMap(([section, items]) => items.map((f) => `- ${section}: ${f.text} ("${f.evidence}")`));
  return [
    `## Summary\n${d.summary}`,
    `## Client facts\n${facts.length ? facts.join("\n") : "- (none)"}`,
    `## Assumptions\n${list(d.assumptions.map((a) => `${a.text} (because: ${a.reason})`))}`,
    `## Missing information\n${list(d.missingInformation)}`,
    `## Questions for the meeting\n${list(d.meetingQuestions.map((q) => `${q.question} (purpose: ${q.purpose})`))}`,
    `## Suggested scope\n${d.suggestedScope.summary}\n${list(d.suggestedScope.firstRelease)}`,
    `## Next step\n${d.nextStep}`,
    d.proposalOutline?.length ? `## Proposal outline\n${list(d.proposalOutline.map((p) => `${p.title}: ${p.notes}`))}` : "",
    d.designDirection?.length ? `## Initial design direction\n${list(d.designDirection)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

// Figures in a team-written draft that the client never stated. Shown as a
// reminder (people may add figures deliberately); automation rejects them.
export function unstatedFigures(text: string, brief: string): string[] {
  const stated = new Set(figuresIn(brief));
  // Numbers that only number a list line ("1. Summary", "2) Facts") are format, not claims.
  const withoutListNumbers = text.replace(/^\s*\d+[.)]\s/gm, "");
  return [...new Set(figuresIn(withoutListNumbers).filter((n) => !stated.has(n)))];
}

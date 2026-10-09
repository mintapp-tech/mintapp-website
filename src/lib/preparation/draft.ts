import { z } from "zod";
import type { BriefLanguage } from "./input";

// The shape of a private meeting-preparation draft. Client-provided facts are
// kept apart from assumptions and suggestions, and every fact must quote the
// brief verbatim. Drafts are for the Mintapp team only.

const text = (max: number) => z.string().trim().min(1).max(max);
const fact = z.object({ text: text(300), evidence: text(300) }).strict();

export const draftSchema = z
  .object({
    language: z.enum(["en", "ar"]),
    summary: text(600),
    clientFacts: z
      .object({
        problem: z.array(fact).max(6),
        audience: z.array(fact).max(6),
        goals: z.array(fact).max(6),
        existingMaterials: z.array(fact).max(6),
        constraints: z.array(fact).max(6),
      })
      .strict(),
    assumptions: z.array(z.object({ text: text(300), reason: text(300) }).strict()).max(8),
    missingInformation: z.array(text(200)).max(10),
    meetingQuestions: z.array(z.object({ question: text(250), purpose: text(250) }).strict()).min(3).max(10),
    suggestedScope: z.object({ summary: text(500), firstRelease: z.array(text(200)).max(8) }).strict(),
    nextStep: text(300),
    proposalOutline: z.array(z.object({ title: text(120), notes: text(300) }).strict()).max(8).optional(),
    designDirection: z.array(text(250)).max(6).optional(),
  })
  .strict();

export type PreparationDraft = z.infer<typeof draftSchema>;

export type DraftProblem =
  | { kind: "schema"; path: string }
  | { kind: "wrong_language" }
  | { kind: "ungrounded_fact"; section: string; index: number }
  | { kind: "unsupported_number"; section: string; value: string };

// Comparable form of Arabic and English text: no diacritics or tatweel,
// unified alef/yaa forms, Western digits, no punctuation, single spaces.
export function normalizeForMatch(input: string): string {
  return input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// Figures in a text, as digit strings with separators removed: "4,000",
// "4000" and "٤٬٠٠٠" are all "4000"; decimals stay whole ("2.5"). Separators
// inside one number stay together, so "$4,000" is one figure, not "4" and "000".
export function figuresIn(value: string): string[] {
  const western = value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/٬/g, ",")
    .replace(/٫/g, ".");
  return (western.match(/\d+(?:,\d{3})*(?:\.\d+)?/g) ?? []).map((n) => n.replace(/,/g, ""));
}

const numbersIn = figuresIn;

// Every way a draft can be unacceptable for this brief. Empty means it may be saved.
export function draftProblems(draft: PreparationDraft, brief: string, language: BriefLanguage): DraftProblem[] {
  const problems: DraftProblem[] = [];
  if (draft.language !== language) problems.push({ kind: "wrong_language" });

  const source = normalizeForMatch(brief);
  for (const [section, facts] of Object.entries(draft.clientFacts)) {
    facts.forEach((f, index) => {
      const evidence = normalizeForMatch(f.evidence);
      if (!evidence || !source.includes(evidence)) problems.push({ kind: "ungrounded_fact", section, index });
    });
  }

  // No figure may appear anywhere unless the client stated it: this is what
  // keeps invented prices, deadlines, durations and metrics out.
  const stated = new Set(numbersIn(brief));
  const check = (section: string, value: string | undefined) => {
    for (const n of numbersIn(value ?? "")) if (!stated.has(n)) problems.push({ kind: "unsupported_number", section, value: n });
  };
  check("summary", draft.summary);
  draft.assumptions.forEach((a) => (check("assumptions", a.text), check("assumptions", a.reason)));
  draft.missingInformation.forEach((m) => check("missingInformation", m));
  draft.meetingQuestions.forEach((q) => (check("meetingQuestions", q.question), check("meetingQuestions", q.purpose)));
  check("suggestedScope", draft.suggestedScope.summary);
  draft.suggestedScope.firstRelease.forEach((item) => check("suggestedScope", item));
  check("nextStep", draft.nextStep);
  draft.proposalOutline?.forEach((p) => (check("proposalOutline", p.title), check("proposalOutline", p.notes)));
  draft.designDirection?.forEach((d) => check("designDirection", d));
  for (const facts of Object.values(draft.clientFacts)) facts.forEach((f) => check("clientFacts", f.text));
  return problems;
}

export type DraftValidation = { ok: true; draft: PreparationDraft } | { ok: false; problems: DraftProblem[] };

export function validateDraft(raw: unknown, brief: string, language: BriefLanguage): DraftValidation {
  const parsed = draftSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, problems: parsed.error.issues.slice(0, 5).map((i) => ({ kind: "schema", path: i.path.join(".") })) };
  const problems = draftProblems(parsed.data, brief, language);
  return problems.length ? { ok: false, problems } : { ok: true, draft: parsed.data };
}

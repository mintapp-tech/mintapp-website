import { z } from "zod";
import { PACK_MESSAGES } from "@/lib/admin/pack-messages";
import {
  APPROVAL_CHECKLIST,
  COMPONENTS,
  DISCOVERY_BANKS,
  DISCOVERY_BANK_IDS,
  FOUNDATION_RULES,
  PATTERNS,
  PATTERN_IDS,
  PROPOSAL_PATTERNS,
  PROPOSAL_PATTERN_IDS,
  QUALITY_RULES,
  RUBRIC,
  TEMPLATES,
  TEMPLATE_IDS,
  TEMPLATE_NOTES,
} from "./library";
import { SECTION_LABELS } from "./labels";
import { packSystemPrompt } from "./prompt";
import { PROBLEM_KINDS, SECTION_BASIS, SECTIONS, packSchema } from "./schema";

// The rules Claude Code reads for manual preparation (docs/pack-rules/), generated
// from the same modules the application uses, so there is one source of truth:
// change the library or the schema, then run `npm run pack:rules`. A test fails if
// the committed files are out of date.

const HEADER = "<!-- Generated from src/lib/pack by `npm run pack:rules`. Do not edit by hand: change the code, then regenerate. -->";

const list = (items: readonly string[]) => items.map((i) => `- ${i}`).join("\n");

export function libraryMarkdown(): string {
  const p = PACK_MESSAGES.en;
  return [
    HEADER,
    "",
    "# Mintapp design library and Pack rules",
    "",
    "The canonical standard for every Pre-meeting Pack, whether prepared automatically or by hand with Claude. The application enforces everything marked as checked automatically; the reviewer checks the rest with the rubric and the approval checklist.",
    "",
    "## 1. The Pack: seventeen sections in three working areas",
    "",
    "| Working area | Section | Basis of its statements |",
    "| --- | --- | --- |",
    ...(["design", "proposal", "discovery"] as const).flatMap((area) =>
      SECTIONS[area].map((s) => `| ${area === "design" ? "Initial product direction" : area === "proposal" ? "Draft scope and proposal direction" : "Discovery and meeting plan"} | \`${s}\` (${SECTION_LABELS.en[s]}) | ${SECTION_BASIS[s] === "per_item" ? "each statement: client_fact (with an exact quote) or assumption" : SECTION_BASIS[s].replace("_", " ")} |`),
    ),
    "",
    "Every statement is one of: a supplied **client fact** (with an exact, contiguous quote from the brief), a Mintapp **assumption**, a Mintapp **recommendation**, or a **question** requiring confirmation. The exact shape is in `pack.schema.json`; the instructions are in `instructions.md`.",
    "",
    "## 2. What the validator refuses (nothing is saved)",
    "",
    ...PROBLEM_KINDS.map((k) => `- \`${k}\`: ${p.problems[k]}`),
    "",
    "## 3. What can be saved but never presented",
    "",
    `- Placeholder text: ${p.findings.placeholder}`,
    `- A design no library pattern fits: ${p.findings.hand_design}`,
    `- An older format: ${p.findings.legacy_format}`,
    "",
    "## 4. Foundations",
    "",
    ...FOUNDATION_RULES.flatMap((f) => [`### ${f.en} (${f.ar})`, "", list(f.rules), ""]),
    "## 5. Components",
    "",
    ...COMPONENTS.flatMap((c) => [`### ${c.en} (${c.ar})`, "", c.purpose, "", list(c.rules), "", `Drawn by: ${c.part}.${c.templates.length ? ` Used in: ${c.templates.join(", ")}.` : ""}`, ""]),
    "## 6. Product patterns",
    "",
    ...PATTERN_IDS.flatMap((id) => {
      const x = PATTERNS[id];
      return [`### \`${id}\`: ${x.en} (${x.ar})`, "", `- Kind: ${x.kind}`, `- For: ${x.fits}`, `- Not for: ${x.avoid}`, `- Screen templates (choose 2 to 4): ${x.templates.join(", ")}`, ""];
    }),
    "## 7. Screen templates",
    "",
    "| Template | Draws | Kinds | Items at most |",
    "| --- | --- | --- | --- |",
    ...TEMPLATE_IDS.map((id) => `| \`${id}\` | ${TEMPLATE_NOTES[id]} | ${TEMPLATES[id].kinds.join(", ")} | ${TEMPLATES[id].maxItems} |`),
    "",
    "## 8. Proposal patterns (indicative direction only; never a price, duration or commitment)",
    "",
    ...PROPOSAL_PATTERN_IDS.flatMap((id) => {
      const x = PROPOSAL_PATTERNS[id];
      return [`### \`${id}\`: ${x.en} (${x.ar})`, "", `- Kind: ${x.kind ?? "any"}`, `- For: ${x.fits}`, `- Typical phases: ${x.phases.join("; ")}`, `- Deliverables: ${x.deliverables.join("; ")}`, `- What shapes cost and schedule: ${x.factors.join("; ")}`, `- Usually not in a first release: ${x.usuallyExcluded.join("; ")}`, ""];
    }),
    "## 9. Discovery banks",
    "",
    ...DISCOVERY_BANK_IDS.flatMap((id) => {
      const b = DISCOVERY_BANKS[id];
      return [`### \`${id}\`: ${b.en} (${b.ar})`, "", b.why, "", ...b.examples.map((q) => `- ${q.en} / ${q.ar}`), ""];
    }),
    "## 10. Quality rules",
    "",
    ...QUALITY_RULES.map((r) => `- **${r.rule}** ${r.why} (${r.check === "automatic" ? "checked automatically" : r.check === "review" ? "checked by the reviewer" : "checked automatically and by the reviewer"}${r.enforcement ? `: ${r.enforcement}` : ""})`),
    "",
    "## 11. Review rubric",
    "",
    ...RUBRIC.map((r) => `- **${r.en} (${r.ar})**: ${r.question.en} / ${r.question.ar}`),
    "",
    "## 12. Approval checklist (confirmed by the founder who did not write the version)",
    "",
    ...APPROVAL_CHECKLIST.map((c) => `- ${c.en} / ${c.ar}`),
    "",
  ].join("\n");
}

export function instructionsMarkdown(): string {
  return [
    HEADER,
    "",
    "# Pack instructions",
    "",
    "The exact instructions automation and the copied Claude prompt use. For a manual Pack, follow the one in the brief's language, then append the brief from `source/brief.md`. Return ONE JSON object.",
    "",
    "## English brief",
    "",
    "```text",
    packSystemPrompt("en"),
    "```",
    "",
    "## Arabic brief",
    "",
    "```text",
    packSystemPrompt("ar"),
    "```",
    "",
  ].join("\n");
}

export function schemaJson(): string {
  return `${JSON.stringify({ $comment: "Generated from src/lib/pack/schema.ts by `npm run pack:rules`. The application also checks every rule in library.md, which a JSON Schema cannot express.", ...z.toJSONSchema(packSchema) }, null, 2)}\n`;
}

export const RULE_FILES: Record<string, () => string> = {
  "library.md": libraryMarkdown,
  "instructions.md": instructionsMarkdown,
  "pack.schema.json": schemaJson,
};

import { describe, expect, test } from "vitest";
import { writeFileSync } from "node:fs";
import { buildGenerationInput } from "./input";
import { draftSchema, draftProblems, normalizeForMatch } from "./draft";
import { selectGenerator } from "./config";
import { SYNTHETIC_BRIEFS } from "./synthetic-briefs";

// LIVE evaluation against the configured provider, with SYNTHETIC briefs only.
// Skipped unless explicitly requested; it spends real tokens.
//
//   PREPARATION_LIVE_EVAL=1 PREPARATION_GENERATOR=codecraft CODECRAFT_MODEL=<exact id> \
//     node --env-file=.env.local node_modules/vitest/vitest.mjs run src/lib/preparation/eval.live.test.ts
//
// Stops early once PREPARATION_EVAL_MAX_TOKENS (default 60000) is used.

const enabled = process.env.PREPARATION_LIVE_EVAL === "1";

describe.runIf(enabled)("live preparation evaluation (synthetic briefs only)", () => {
  test(
    "each synthetic brief",
    async () => {
      const selection = selectGenerator(process.env, { syntheticOnly: true });
      if (!selection.enabled) throw new Error(`generator not available: ${selection.reason}`);
      const cap = Number(process.env.PREPARATION_EVAL_MAX_TOKENS ?? 60_000);
      let used = 0;
      const rows = [];

      for (const brief of SYNTHETIC_BRIEFS) {
        if (used >= cap) break;
        const input = buildGenerationInput(brief.inquiry);
        const started = Date.now();
        const result = await selection.generator.generate(input);
        const ms = Date.now() - started;
        const tokens = result.usage?.totalTokens ?? 0;
        used += tokens;
        if (!result.ok) {
          rows.push({ id: brief.id, ok: false, failure: result.failure, tokens, ms });
          if (result.pauseAutomation) break;
          continue;
        }
        const parsed = draftSchema.safeParse(result.raw);
        if (!parsed.success) {
          rows.push({ id: brief.id, ok: false, failure: "schema", paths: parsed.error.issues.slice(0, 3).map((i) => i.path.join(".")), tokens, ms });
          continue;
        }
        const d = parsed.data;
        const problems = draftProblems(d, input.brief, input.language);
        const factText = normalizeForMatch(Object.values(d.clientFacts).flat().map((f) => `${f.text} ${f.evidence}`).join(" "));
        const recalled = brief.expectFacts.filter((f) => factText.includes(normalizeForMatch(f))).length;
        rows.push({
          id: brief.id,
          kind: brief.kind,
          ok: problems.length === 0,
          model: result.model,
          ungroundedFacts: problems.filter((p) => p.kind === "ungrounded_fact").length,
          unsupportedNumbers: problems.filter((p) => p.kind === "unsupported_number").map((p) => (p.kind === "unsupported_number" ? `${p.section}:${p.value}` : "")),
          wrongLanguage: problems.some((p) => p.kind === "wrong_language"),
          factRecall: `${recalled}/${brief.expectFacts.length}`,
          facts: Object.values(d.clientFacts).flat().length,
          assumptions: d.assumptions.length,
          missing: d.missingInformation.length,
          questions: d.meetingQuestions.length,
          tokens,
          usageReported: result.usage.reported,
          ms,
          draft: d,
        });
      }

      const report = { generatedAt: new Date().toISOString(), totalTokens: used, rows };
      if (process.env.PREPARATION_EVAL_REPORT) writeFileSync(process.env.PREPARATION_EVAL_REPORT, JSON.stringify(report, null, 2));
      console.table(rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== "draft"))));
      console.log(`total tokens: ${used}`);
      expect(rows.length).toBeGreaterThan(0);
    },
    15 * 60_000,
  );
});

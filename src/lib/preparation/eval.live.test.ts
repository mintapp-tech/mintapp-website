import { describe, expect, test } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { buildGenerationInput } from "./input";
import { normalizeForMatch } from "./draft";
import { selectGenerator } from "./config";
import { SYNTHETIC_BRIEFS } from "./synthetic-briefs";
import { packSchema, packProblems } from "@/lib/pack/schema";

// LIVE evaluation of the Pre-meeting Pack against the configured provider, with
// SYNTHETIC briefs only. Skipped unless explicitly requested; it spends real tokens.
//
//   PREPARATION_LIVE_EVAL=1 PREPARATION_GENERATOR=codecraft CODECRAFT_MODEL=<exact id> \
//   PREPARATION_EVAL_BRIEFS=en-complete-clinic,ar-complete-school PREPARATION_EVAL_REPORT=review-evidence/codecraft-eval.json \
//     node --env-file=.env.local node_modules/vitest/vitest.mjs run src/lib/preparation/eval.live.test.ts
//
// Hard cap: PREPARATION_EVAL_MAX_TOKENS (default 60000). Before every request the
// worst case (prompt estimate plus the output limit) is checked against what is
// left, so the cap is never exceeded even if a request uses everything it may.
// CODECRAFT_CLIENT_DATA_APPROVED is not needed and must not be set: only the
// synthetic briefs below are ever sent.

const enabled = process.env.PREPARATION_LIVE_EVAL === "1";

describe.runIf(enabled)("live Pre-meeting Pack evaluation (synthetic briefs only)", () => {
  test(
    "each selected synthetic brief",
    async () => {
      if (process.env.CODECRAFT_CLIENT_DATA_APPROVED === "true") throw new Error("Refusing: the evaluation runs with client-data approval off.");
      const selection = selectGenerator(process.env, { syntheticOnly: true });
      if (!selection.enabled) throw new Error(`generator not available: ${selection.reason}`);
      const cap = Number(process.env.PREPARATION_EVAL_MAX_TOKENS ?? 60_000);
      const wanted = (process.env.PREPARATION_EVAL_BRIEFS ?? "en-complete-clinic,ar-complete-school").split(",");
      const briefs = SYNTHETIC_BRIEFS.filter((b) => wanted.includes(b.id));
      let used = 0;
      const rows = [];

      for (const brief of briefs) {
        const input = buildGenerationInput(brief.inquiry);
        const worstCase = selection.generator.estimateTokens(input);
        if (used + worstCase > cap) {
          rows.push({ id: brief.id, skipped: `cap: ${used} used + ${worstCase} worst case > ${cap}` });
          continue;
        }
        const started = Date.now();
        const result = await selection.generator.generate(input);
        const ms = Date.now() - started;
        const tokens = result.usage?.totalTokens ?? worstCase;
        used += tokens;
        if (!result.ok) {
          rows.push({ id: brief.id, ok: false, failure: result.failure, tokens, ms });
          if (result.pauseAutomation) break;
          continue;
        }
        const parsed = packSchema.safeParse(result.raw);
        if (!parsed.success) {
          rows.push({ id: brief.id, ok: false, failure: "schema", paths: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`), tokens, ms, raw: result.raw });
          continue;
        }
        const p = parsed.data;
        const problems = packProblems(p, { brief: input.brief, language: input.language, projectType: input.projectType });
        const factText = normalizeForMatch(p.client_facts.map((f) => `${f.text} ${f.evidence}`).join(" "));
        rows.push({
          id: brief.id,
          ok: problems.length === 0,
          model: result.model,
          problems,
          pattern: p.design_blueprint.pattern,
          screens: p.screens.map((s) => s.template),
          factRecall: `${brief.expectFacts.filter((f) => factText.includes(normalizeForMatch(f))).length}/${brief.expectFacts.length}`,
          facts: p.client_facts.length,
          assumptions: p.assumptions.length,
          questions: p.discovery_questions.length,
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          tokens,
          usageReported: result.usage.reported,
          ms,
          pack: p,
        });
      }

      const report = { generatedAt: new Date().toISOString(), model: selection.generator.model, cap, totalTokens: used, rows };
      if (process.env.PREPARATION_EVAL_REPORT) {
        mkdirSync(dirname(process.env.PREPARATION_EVAL_REPORT), { recursive: true });
        writeFileSync(process.env.PREPARATION_EVAL_REPORT, JSON.stringify(report, null, 2));
      }
      console.log(JSON.stringify(rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== "pack" && k !== "raw"))), null, 1));
      console.log(`total tokens: ${used} of ${cap}`);
      expect(used).toBeLessThanOrEqual(cap);
      expect(rows.length).toBeGreaterThan(0);
    },
    20 * 60_000,
  );
});

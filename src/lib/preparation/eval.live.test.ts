import { describe, expect, test } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { buildGenerationInput } from "./input";
import { normalizeForMatch } from "./draft";
import { DEFAULT_CODECRAFT_BASE_URL, selectGenerator } from "./config";
import { chatJson, estimatePromptTokens } from "./codecraft-generator";
import { SYNTHETIC_BRIEFS } from "./synthetic-briefs";
import { buildPackMessages } from "@/lib/pack/prompt";
import { packSchema, packProblems } from "@/lib/pack/schema";
import { PACK_STEPS, STEP_MAX_TOKENS, validateStep, type Analysis, type StepContext } from "@/lib/pack/steps";

// LIVE evaluation of automated preparation against CodeCraft, with SYNTHETIC
// briefs only. It never runs in the normal suite: it is skipped unless
// PREPARATION_LIVE_EVAL=1, because it spends real tokens.
//
//   PREPARATION_LIVE_EVAL=1 PREPARATION_GENERATOR=codecraft CODECRAFT_MODEL=<exact id> \
//   PREPARATION_EVAL_MODE=staged|single PREPARATION_EVAL_BRIEFS=en-complete-clinic,ar-complete-school \
//   PREPARATION_EVAL_MAX_TOKENS=60000 PREPARATION_EVAL_REPORT=review-evidence/codecraft-eval.json \
//   [PREPARATION_EVAL_STEPS=analysis,design] [CODECRAFT_REASONING_MAX_TOKENS=1024] \
//     node --env-file=.env.local node_modules/vitest/vitest.mjs run src/lib/preparation/eval.live.test.ts
//
// staged  the four bounded requests the worker makes (analysis, design, proposal, discovery)
// single  the earlier one-request pack, kept only to diagnose why it was cut off
//         (PREPARATION_EVAL_SINGLE_MAX_TOKENS, default 8192)
//
// Hard cap: PREPARATION_EVAL_MAX_TOKENS (default 60000) for the whole run. Before
// every request the worst case (prompt estimate plus its output ceiling) is
// checked against what is left, so the cap holds even if a request uses all it
// may. Usage is the provider's reported count. CODECRAFT_CLIENT_DATA_APPROVED is
// not needed and the run refuses to start if it is set.

const enabled = process.env.PREPARATION_LIVE_EVAL === "1";

describe.runIf(enabled)("live preparation evaluation (synthetic briefs only)", () => {
  test(
    "each selected synthetic brief",
    async () => {
      if (process.env.CODECRAFT_CLIENT_DATA_APPROVED === "true") throw new Error("Refusing: the evaluation runs with client-data approval off.");
      const selection = selectGenerator(process.env, { syntheticOnly: true });
      if (!selection.enabled || selection.generator.id !== "codecraft") throw new Error("CodeCraft is not configured for the evaluation.");
      const generator = selection.generator;
      const mode = process.env.PREPARATION_EVAL_MODE === "single" ? "single" : "staged";
      const cap = Number(process.env.PREPARATION_EVAL_MAX_TOKENS ?? 60_000);
      const wanted = (process.env.PREPARATION_EVAL_BRIEFS ?? "en-complete-clinic,ar-complete-school").split(",");
      const briefs = SYNTHETIC_BRIEFS.filter((b) => wanted.includes(b.id));
      let used = 0;
      const rows: Record<string, unknown>[] = [];
      const room = (worst: number) => used + worst <= cap;

      for (const brief of briefs) {
        const input = buildGenerationInput(brief.inquiry);
        const ctx = { brief: input.brief, language: input.language, projectType: input.projectType };

        if (mode === "single") {
          const maxTokens = Number(process.env.PREPARATION_EVAL_SINGLE_MAX_TOKENS ?? 8192);
          const messages = buildPackMessages(input);
          const worst = estimatePromptTokens(messages.map((m) => m.content).join("\n")) + maxTokens;
          if (!room(worst)) {
            rows.push({ brief: brief.id, request: "single", skipped: `cap: ${used} + ${worst} > ${cap}` });
            continue;
          }
          const result = await chatJson(
            { apiKey: process.env.CODECRAFT_API_KEY!.trim(), baseUrl: process.env.CODECRAFT_BASE_URL?.trim() || DEFAULT_CODECRAFT_BASE_URL, model: generator.model, timeoutMs: 180_000 },
            messages,
            maxTokens,
          );
          used += result.usage?.totalTokens ?? worst;
          const parsed = result.ok ? packSchema.safeParse(result.raw) : null;
          rows.push({
            brief: brief.id,
            request: "single",
            ok: result.ok && !!parsed?.success,
            failure: result.ok ? undefined : result.failure,
            usage: result.usage,
            meta: result.meta,
            problems: parsed?.success ? packProblems(parsed.data, ctx) : parsed ? parsed.error.issues.slice(0, 5).map((i) => i.path.join(".")) : undefined,
          });
          if (!result.ok && result.pauseAutomation) break;
          continue;
        }

        // Staged, exactly as the worker runs it.
        const context: StepContext = {};
        const packRow: Record<string, unknown> = { brief: brief.id, steps: {} as Record<string, unknown> };
        let packTokens = 0;
        let stop = false;
        const only = process.env.PREPARATION_EVAL_STEPS?.split(",");
        for (const step of PACK_STEPS) {
          if (step !== "analysis" && !context.analysis) break;
          if (only && !only.includes(step)) continue;
          const worst = generator.estimateTokens(step, input, context);
          if (!room(worst) || packTokens + worst > selection.packTokenCap) {
            (packRow.steps as Record<string, unknown>)[step] = { skipped: `cap: run ${used}+${worst}/${cap}, pack ${packTokens}+${worst}/${selection.packTokenCap}` };
            continue;
          }
          const result = await generator.generate(step, input, context);
          const tokens = result.usage?.totalTokens ?? worst;
          used += tokens;
          packTokens += tokens;
          const validation = result.ok ? validateStep(step, result.raw, ctx) : null;
          if (step === "analysis" && validation?.ok) context.analysis = validation.value as Analysis;
          (packRow.steps as Record<string, unknown>)[step] = {
            ok: result.ok && !!validation?.ok,
            failure: result.ok ? undefined : result.failure,
            problems: validation && !validation.ok ? validation.problems : undefined,
            maxTokens: STEP_MAX_TOKENS[step],
            usage: result.usage,
            meta: result.meta,
            value: validation?.ok ? validation.value : undefined,
          };
          if (!result.ok && result.pauseAutomation) {
            stop = true;
            break;
          }
        }
        const analysis = context.analysis;
        packRow.packTokens = packTokens;
        if (analysis) {
          const factText = normalizeForMatch(analysis.client_facts.map((f) => `${f.text} ${f.evidence}`).join(" "));
          packRow.factRecall = `${brief.expectFacts.filter((f) => factText.includes(normalizeForMatch(f))).length}/${brief.expectFacts.length}`;
        }
        rows.push(packRow);
        if (stop) break;
      }

      const report = { generatedAt: new Date().toISOString(), mode, model: generator.model, cap, packTokenCap: selection.packTokenCap, totalTokens: used, rows };
      if (process.env.PREPARATION_EVAL_REPORT) {
        mkdirSync(dirname(process.env.PREPARATION_EVAL_REPORT), { recursive: true });
        writeFileSync(process.env.PREPARATION_EVAL_REPORT, JSON.stringify(report, null, 2));
      }
      const brief = (r: Record<string, unknown>) =>
        JSON.stringify(r, (k, v) => (k === "value" ? undefined : v), 1)
          .split("\n")
          .slice(0, 400)
          .join("\n");
      for (const r of rows) console.log(brief(r));
      console.log(`total tokens: ${used} of ${cap}`);
      expect(used).toBeLessThanOrEqual(cap);
      expect(rows.length).toBeGreaterThan(0);
    },
    30 * 60_000,
  );
});

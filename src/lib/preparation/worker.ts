import { buildGenerationInput, type InquiryForPreparation } from "./input";
import type { GenerationResult, PreparationGenerator } from "./generator";
import { PACK_STEPS, STEP_PROMPT_VERSION, artifactFor, validateStep, type Analysis, type PackStep } from "@/lib/pack/steps";

// Processes due preparation jobs. Submission and booking never wait on this:
// jobs exist from the moment an inquiry is saved, and this runs separately
// (scheduled, or kicked after a booking).
//
// A pack is four bounded requests (src/lib/pack/steps.ts). Each is checked
// against the monthly budget and the per-pack cap before it is sent, validated
// on its own, and saved as soon as it passes, so one failing step never discards
// another. Progress is kept on the job: a later attempt repeats only the steps
// that did not finish. Only transient failures (timeouts, rate limits, provider
// errors) are retried automatically; a cut-off, unusable or rule-breaking answer
// is left for a person. Quota, key, model and budget problems pause automation.
// There is no fallback model.

export interface PackProgress {
  v: 1;
  // Tokens this run of the pack has used, against the per-pack cap.
  tokens: number;
  analysis?: Analysis;
  steps: Partial<Record<PackStep, "done" | "failed">>;
  failures?: Partial<Record<PackStep, string>>;
}

export interface PreparationStore {
  claim(provider: string, limit: number, leaseSeconds: number): Promise<{ inquiryId: string; attempts: number }[]>;
  // Claims one specific inquiry's waiting job ("prepare this inquiry now").
  claimInquiry(provider: string, inquiryId: string, leaseSeconds: number): Promise<{ inquiryId: string; attempts: number }[]>;
  loadInquiry(inquiryId: string): Promise<InquiryForPreparation | null>;
  loadProgress(inquiryId: string): Promise<PackProgress | null>;
  saveProgress(inquiryId: string, progress: PackProgress): Promise<void>;
  // Saves one validated artifact as a new version (only while the job is held).
  saveArtifact(inquiryId: string, artifact: "design" | "proposal" | "discovery", content: unknown, source: string, model: string | null): Promise<number | null>;
  // All three artifacts saved: the job succeeds.
  finishPack(inquiryId: string, model: string | null): Promise<void>;
  // The exact, already sanitised input about to be sent (for audit).
  recordPayload(inquiryId: string, payload: Record<string, unknown>): Promise<void>;
  fail(inquiryId: string, error: string, retryable: boolean, retryAfterSeconds: number | null): Promise<string | null>;
  pause(provider: string, reason: string, inquiryId: string | null): Promise<void>;
  monthlyTokens(provider: string): Promise<number>;
  recordUsage(entry: { inquiryId: string; provider: string; model: string | null; promptTokens: number; completionTokens: number; totalTokens: number; outcome: string }): Promise<void>;
}

export interface BatchSummary {
  claimed: number;
  succeeded: number;
  retrying: number;
  failed: number;
  paused: number;
  outcomes: Record<string, number>;
}

const ARTIFACT_STEPS = ["design", "proposal", "discovery"] as const;

export async function runPreparationBatch(opts: {
  store: PreparationStore;
  generator: PreparationGenerator;
  monthlyTokenBudget: number;
  // Every request of one pack together (default 30,000).
  packTokenCap?: number;
  limit?: number;
  leaseSeconds?: number;
  // Only this inquiry, if its job is waiting.
  inquiryId?: string;
}): Promise<BatchSummary> {
  const { store, generator } = opts;
  const packCap = opts.packTokenCap ?? 30_000;
  const real = generator.id !== "mock";
  const summary: BatchSummary = { claimed: 0, succeeded: 0, retrying: 0, failed: 0, paused: 0, outcomes: {} };
  const count = (outcome: string) => (summary.outcomes[outcome] = (summary.outcomes[outcome] ?? 0) + 1);

  const jobs = opts.inquiryId
    ? await store.claimInquiry(generator.id, opts.inquiryId, opts.leaseSeconds ?? 600)
    : await store.claim(generator.id, opts.limit ?? 3, opts.leaseSeconds ?? 600);
  summary.claimed = jobs.length;

  for (const job of jobs) {
    const inquiry = await store.loadInquiry(job.inquiryId);
    if (!inquiry) {
      await store.fail(job.inquiryId, "inquiry_missing", false, null);
      summary.failed++;
      count("inquiry_missing");
      continue;
    }
    const input = buildGenerationInput(inquiry);
    const ctx = { brief: input.brief, language: input.language, projectType: input.projectType };
    const progress: PackProgress = (await store.loadProgress(job.inquiryId)) ?? { v: 1, tokens: 0, steps: {} };
    progress.failures = {};
    let model: string | null = null;
    let pausedFor: string | null = null;
    let retryAfter: number | null = null;

    // What is about to leave, kept for audit: the scrubbed brief, the prompt version and the model. Never a key.
    if (real) {
      await store.recordPayload(job.inquiryId, { provider: generator.id, model: generator.model, prompt_version: STEP_PROMPT_VERSION, steps: [...PACK_STEPS], language: input.language, project_type: input.projectType, brief: input.brief, at: new Date().toISOString() });
    }

    for (const step of PACK_STEPS) {
      if (progress.steps[step]) continue;
      // The later steps build on the analysis; without it they wait.
      if (step !== "analysis" && !progress.analysis) break;
      const context = { analysis: progress.analysis };
      const worst = generator.estimateTokens(step, input, context);

      if (real) {
        // Application budget, checked before every request: stop short of the
        // provider's allowance rather than ever reaching paid usage.
        if ((await store.monthlyTokens(generator.id)) + worst > opts.monthlyTokenBudget) {
          pausedFor = "budget_exhausted";
          break;
        }
        if (progress.tokens + worst > packCap) {
          progress.steps[step] = "failed";
          progress.failures[step] = "pack_budget";
          count(`${step}:pack_budget`);
          if (step === "analysis") break;
          continue;
        }
      }

      const result: GenerationResult = await generator.generate(step, input, context);
      const spent = result.usage?.totalTokens ?? (!result.ok && result.failure === "timeout" ? worst : 0);
      progress.tokens += spent;
      if (result.model) model = result.model;

      if (!result.ok) {
        if (real && result.usage) await store.recordUsage({ inquiryId: job.inquiryId, provider: generator.id, model: result.model ?? generator.model, ...tokens(result.usage), outcome: `${step}:${result.failure}` });
        count(`${step}:${result.failure}`);
        progress.failures[step] = result.failure;
        if (result.pauseAutomation) {
          pausedFor = result.failure;
          break;
        }
        if (result.retryable) {
          // Left pending: the next attempt tries this step again.
          if (result.retryAfterSeconds) retryAfter = Math.max(retryAfter ?? 0, result.retryAfterSeconds);
        } else {
          progress.steps[step] = "failed";
        }
        if (step === "analysis") break;
        await store.saveProgress(job.inquiryId, progress);
        continue;
      }

      const validation = validateStep(step, result.raw, ctx);
      const outcome = validation.ok ? "succeeded" : `invalid_${validation.problems[0].kind}`;
      if (real) await store.recordUsage({ inquiryId: job.inquiryId, provider: generator.id, model: result.model, ...tokens(result.usage), outcome: `${step}:${outcome}` });
      count(`${step}:${outcome}`);

      if (!validation.ok) {
        // An answer that breaks the rules is never saved, and not retried automatically.
        progress.steps[step] = "failed";
        progress.failures[step] = outcome;
        if (step === "analysis") break;
      } else if (step === "analysis") {
        progress.analysis = validation.value as Analysis;
        progress.steps.analysis = "done";
      } else {
        await store.saveArtifact(job.inquiryId, step, artifactFor(step, validation.value, progress.analysis!), generator.id, result.model);
        progress.steps[step] = "done";
      }
      await store.saveProgress(job.inquiryId, progress);
    }

    if (pausedFor) {
      await store.saveProgress(job.inquiryId, progress);
      await store.pause(generator.id, pausedFor, job.inquiryId);
      summary.paused++;
      if (pausedFor === "budget_exhausted") count("budget_exhausted");
      break;
    }

    if (ARTIFACT_STEPS.every((s) => progress.steps[s] === "done")) {
      await store.finishPack(job.inquiryId, model ?? generator.model);
      summary.succeeded++;
      continue;
    }

    // Something did not finish. If only transient failures remain, try again
    // later (within the job's attempt limit); otherwise a person takes over,
    // keeping every artifact that was saved.
    await store.saveProgress(job.inquiryId, progress);
    const pending = PACK_STEPS.filter((s) => !progress.steps[s]);
    const failedStep = PACK_STEPS.find((s) => progress.failures?.[s]);
    const error = (failedStep ? progress.failures![failedStep]! : "incomplete").slice(0, 64);
    const retryable = pending.length > 0 && progress.steps.analysis !== "failed";
    const status = await store.fail(job.inquiryId, error, retryable, retryAfter);
    if (status === "retry_scheduled") summary.retrying++;
    else summary.failed++;
  }
  return summary;
}

const tokens = (u: { promptTokens: number; completionTokens: number; totalTokens: number }) => ({
  promptTokens: u.promptTokens,
  completionTokens: u.completionTokens,
  totalTokens: u.totalTokens,
});

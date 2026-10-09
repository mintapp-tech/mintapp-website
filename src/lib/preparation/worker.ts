import { buildGenerationInput, type InquiryForPreparation } from "./input";
import type { PreparationGenerator } from "./generator";
import { splitPack, validatePack } from "@/lib/pack/schema";
import { PACK_PROMPT_VERSION } from "@/lib/pack/prompt";

// Processes due preparation jobs. Submission and booking never wait on this:
// jobs exist from the moment an inquiry is saved, and this runs separately
// (scheduled, or kicked after a submission). Every outcome is recorded on the
// job; failures are bounded by the database's attempt limit, and quota,
// budget or configuration problems pause automation instead of retrying.

export interface PreparationStore {
  claim(provider: string, limit: number, leaseSeconds: number): Promise<{ inquiryId: string; attempts: number }[]>;
  // Claims one specific inquiry's waiting job ("prepare this inquiry now").
  claimInquiry(provider: string, inquiryId: string, leaseSeconds: number): Promise<{ inquiryId: string; attempts: number }[]>;
  loadInquiry(inquiryId: string): Promise<InquiryForPreparation | null>;
  complete(inquiryId: string, content: unknown, source: string, model: string | null): Promise<number | null>;
  // Saves a validated pack as three artifact versions and finishes the job.
  completePack(inquiryId: string, artifacts: ReturnType<typeof splitPack>, source: string, model: string | null): Promise<number | null>;
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

export async function runPreparationBatch(opts: {
  store: PreparationStore;
  generator: PreparationGenerator;
  monthlyTokenBudget: number;
  limit?: number;
  leaseSeconds?: number;
  // Only this inquiry, if its job is waiting.
  inquiryId?: string;
}): Promise<BatchSummary> {
  const { store, generator } = opts;
  const summary: BatchSummary = { claimed: 0, succeeded: 0, retrying: 0, failed: 0, paused: 0, outcomes: {} };
  const count = (outcome: string) => (summary.outcomes[outcome] = (summary.outcomes[outcome] ?? 0) + 1);

  const jobs = opts.inquiryId
    ? await store.claimInquiry(generator.id, opts.inquiryId, opts.leaseSeconds ?? 300)
    : await store.claim(generator.id, opts.limit ?? 3, opts.leaseSeconds ?? 300);
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

    // Application budget, checked before every request: stop short of the
    // provider's allowance rather than ever reaching paid usage.
    if (generator.id !== "mock") {
      const used = await store.monthlyTokens(generator.id);
      if (used + generator.estimateTokens(input) > opts.monthlyTokenBudget) {
        await store.pause(generator.id, "budget_exhausted", job.inquiryId);
        summary.paused++;
        count("budget_exhausted");
        break;
      }
    }

    // What is about to leave, kept for audit: the scrubbed brief, the prompt version and the model. Never a key.
    if (generator.id !== "mock") {
      await store.recordPayload(job.inquiryId, { provider: generator.id, model: generator.model, prompt_version: PACK_PROMPT_VERSION, language: input.language, project_type: input.projectType, brief: input.brief, at: new Date().toISOString() });
    }

    const result = await generator.generate(input);

    if (!result.ok) {
      if (result.usage) await store.recordUsage({ inquiryId: job.inquiryId, provider: generator.id, model: result.model ?? generator.model, ...tokens(result.usage), outcome: result.failure });
      count(result.failure);
      if (result.pauseAutomation) {
        await store.pause(generator.id, result.failure, job.inquiryId);
        summary.paused++;
        break;
      }
      const status = await store.fail(job.inquiryId, result.failure, result.retryable, result.retryAfterSeconds ?? null);
      if (status === "retry_scheduled") summary.retrying++;
      else summary.failed++;
      continue;
    }

    const validation = validatePack(result.raw, { brief: input.brief, language: input.language, projectType: input.projectType });
    const outcome = validation.ok ? "succeeded" : `invalid_${validation.problems[0].kind}`;
    if (generator.id !== "mock") await store.recordUsage({ inquiryId: job.inquiryId, provider: generator.id, model: result.model, ...tokens(result.usage), outcome });
    count(outcome);

    if (!validation.ok) {
      // A draft that breaks the rules is never saved; it is retried within
      // the attempt limit and then left visibly failed for manual preparation.
      const status = await store.fail(job.inquiryId, outcome.slice(0, 64), true, null);
      if (status === "retry_scheduled") summary.retrying++;
      else summary.failed++;
      continue;
    }

    await store.completePack(job.inquiryId, splitPack(validation.pack), generator.id, result.model);
    summary.succeeded++;
  }
  return summary;
}

const tokens = (u: { promptTokens: number; completionTokens: number; totalTokens: number }) => ({
  promptTokens: u.promptTokens,
  completionTokens: u.completionTokens,
  totalTokens: u.totalTokens,
});

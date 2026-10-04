import "server-only";
import type { SqlGateway } from "@/lib/sql-gateway";
import type { PreparationStore } from "./worker";
import type { InquiryForPreparation } from "./input";

// PreparationStore over the preparation database functions, through either
// gateway (Supabase in deployments, local PostgreSQL in the demo). Errors
// throw: the worker pass stops and the claimed job keeps its lease.
export function createSqlPreparationStore(sql: SqlGateway): PreparationStore {
  return {
    async claim(provider, limit, leaseSeconds) {
      const rows = await sql.call<{ inquiry_id: string; attempts: number }[] | null>("claim_preparation_jobs", { p_provider: provider, p_limit: limit, p_lease_seconds: leaseSeconds });
      return (rows ?? []).map((r) => ({ inquiryId: r.inquiry_id, attempts: r.attempts }));
    },
    async claimInquiry(provider, inquiryId, leaseSeconds) {
      const rows = await sql.call<{ inquiry_id: string; attempts: number }[] | null>("claim_preparation_job_for", { p_provider: provider, p_inquiry_id: inquiryId, p_lease_seconds: leaseSeconds });
      return (rows ?? []).map((r) => ({ inquiryId: r.inquiry_id, attempts: r.attempts }));
    },
    loadInquiry: (inquiryId) => sql.call<InquiryForPreparation | null>("preparation_input", { p_inquiry_id: inquiryId }),
    complete: (inquiryId, content, source, model) => sql.call<number | null>("complete_preparation", { p_inquiry_id: inquiryId, p_content: content, p_source: source, p_model: model }),
    fail: (inquiryId, error, retryable, retryAfterSeconds) =>
      sql.call<string | null>("fail_preparation", { p_inquiry_id: inquiryId, p_error: error, p_retryable: retryable, p_retry_after_seconds: retryAfterSeconds }),
    async pause(provider, reason, inquiryId) {
      await sql.call("pause_preparation_automation", { p_provider: provider, p_reason: reason, p_inquiry_id: inquiryId });
    },
    async monthlyTokens(provider) {
      return Number((await sql.call("monthly_generation_tokens", { p_provider: provider })) ?? 0);
    },
    async recordUsage(e) {
      await sql.call("record_generation_usage", {
        p_inquiry_id: e.inquiryId,
        p_provider: e.provider,
        p_model: e.model,
        p_prompt_tokens: e.promptTokens,
        p_completion_tokens: e.completionTokens,
        p_total_tokens: e.totalTokens,
        p_outcome: e.outcome.slice(0, 64),
      });
    },
  };
}

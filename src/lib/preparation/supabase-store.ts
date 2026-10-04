import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PreparationStore } from "./worker";
import type { InquiryForPreparation } from "./input";

// PreparationStore backed by the database functions in
// 20261005000000_add_inquiry_preparation.sql. Errors throw: the worker run
// stops, the claimed job keeps its lease and is picked up again later.

const check = <T>(result: { data: T; error: unknown }, what: string): T => {
  if (result.error) throw new Error(`preparation_store_${what}_failed`);
  return result.data;
};

export function createSupabasePreparationStore(supabase: SupabaseClient): PreparationStore {
  return {
    async claim(provider, limit, leaseSeconds) {
      const rows = check(await supabase.rpc("claim_preparation_jobs", { p_provider: provider, p_limit: limit, p_lease_seconds: leaseSeconds }), "claim");
      return ((rows as { inquiry_id: string; attempts: number }[] | null) ?? []).map((r) => ({ inquiryId: r.inquiry_id, attempts: r.attempts }));
    },
    async loadInquiry(inquiryId) {
      const row = check(
        await supabase
          .from("project_inquiries")
          .select("preferred_language, project_type, project_description, budget_range, timeline, country")
          .eq("id", inquiryId)
          .is("deleted_at", null)
          .maybeSingle(),
        "load",
      );
      return (row as InquiryForPreparation | null) ?? null;
    },
    async complete(inquiryId, content, source, model) {
      return check(await supabase.rpc("complete_preparation", { p_inquiry_id: inquiryId, p_content: content, p_source: source, p_model: model }), "complete") as number | null;
    },
    async fail(inquiryId, error, retryable, retryAfterSeconds) {
      return check(await supabase.rpc("fail_preparation", { p_inquiry_id: inquiryId, p_error: error, p_retryable: retryable, p_retry_after_seconds: retryAfterSeconds }), "fail") as string | null;
    },
    async pause(provider, reason, inquiryId) {
      check(await supabase.rpc("pause_preparation_automation", { p_provider: provider, p_reason: reason, p_inquiry_id: inquiryId }), "pause");
    },
    async monthlyTokens(provider) {
      return Number(check(await supabase.rpc("monthly_generation_tokens", { p_provider: provider }), "usage") ?? 0);
    },
    async recordUsage(e) {
      check(
        await supabase.rpc("record_generation_usage", {
          p_inquiry_id: e.inquiryId,
          p_provider: e.provider,
          p_model: e.model,
          p_prompt_tokens: e.promptTokens,
          p_completion_tokens: e.completionTokens,
          p_total_tokens: e.totalTokens,
          p_outcome: e.outcome.slice(0, 64),
        }),
        "record_usage",
      );
    },
  };
}

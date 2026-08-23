import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { InquiryInput } from "./inquiry-schema";

export type InsertInquiryResult =
  | { status: "inserted"; id: string }
  | { status: "duplicate"; id: string }
  | { status: "failed"; message: string };

/**
 * Extracted from the route handler specifically so it's testable with an
 * injected/mocked Supabase client — no real table needs to be touched or
 * temporarily broken to exercise the failure path.
 */
export async function insertInquiry(supabase: SupabaseClient, body: InquiryInput): Promise<InsertInquiryResult> {
  const { data: inserted, error: insertError } = await supabase
    .from("project_inquiries")
    .insert({
      full_name: body.name,
      email: body.email,
      phone: body.phone || null,
      company_name: body.company || null,
      project_description: body.desc,
      preferred_language: body.lang,
      consent_given: true,
      consent_at: new Date().toISOString(),
      source_page: `/${body.lang}/start`,
      utm_source: body.utmSource || null,
      utm_medium: body.utmMedium || null,
      utm_campaign: body.utmCampaign || null,
      // Requires the corrective migration that adds this column + a unique
      // partial index — see
      // supabase/migrations/20260822000000_align_constraints_and_add_submission_token.sql.
      submission_token: body.submissionToken,
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      // Unique-violation on submission_token: this exact submission was
      // already stored (a retry/double-post of the same client attempt).
      // Look up the existing row rather than erroring or inserting a
      // duplicate — the caller must not send a second notification either.
      const { data: existing } = await supabase
        .from("project_inquiries")
        .select("id")
        .eq("submission_token", body.submissionToken)
        .single();

      if (existing) {
        return { status: "duplicate", id: existing.id as string };
      }
    }

    console.error("Supabase insert failed:", insertError.message);
    return { status: "failed", message: insertError.message };
  }

  return { status: "inserted", id: inserted.id as string };
}

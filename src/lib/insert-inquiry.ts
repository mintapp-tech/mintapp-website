import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { InquiryInput } from "./inquiry-schema";
import { findInquiryIdByToken } from "./find-inquiry-by-token";

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
      // Added by the CRM migration; sent only when the visitor came from a
      // tracked link, so a database without the column is unaffected otherwise.
      ...(body.utmContent ? { utm_content: body.utmContent } : {}),
      // Only an explicit choice on the form is stored; a missing value stays
      // null ("not provided") and is never inferred from the brief.
      ...(body.projectType ? { project_type: body.projectType } : {}),
      // Requires the corrective migration that adds this column + a unique
      // partial index — see
      // supabase/migrations/20260822000000_align_constraints_and_add_submission_token.sql.
      submission_token: body.submissionToken,
    })
    .select("id")
    .single();

  if (insertError) {
    // Safety net for a release-order slip: a database that has not yet had the
    // project-type migration rejects the new "not_sure" value with a check
    // violation. The inquiry matters more than that one answer, so keep it
    // (stored as "not provided") and say so in the log. Never fires once the
    // migration is applied.
    if (insertError.code === "23514" && body.projectType && insertError.message.includes("project_type_values")) {
      console.error("project_type_rejected_by_database: stored the inquiry without it");
      return insertInquiry(supabase, { ...body, projectType: undefined });
    }
    // Same safety net for the campaign content identifier (utm_content): a
    // database that has not yet had the CRM migration lacks the column. The
    // inquiry matters more than that one tracking value, so keep it without it.
    if (body.utmContent && /utm_content/.test(insertError.message)) {
      console.error("utm_content_rejected_by_database: stored the inquiry without it");
      return insertInquiry(supabase, { ...body, utmContent: undefined });
    }
    if (insertError.code === "23505") {
      // Unique-violation on submission_token: this exact submission was
      // already stored (a retry/double-post of the same client attempt).
      // Look up the existing row rather than erroring or inserting a
      // duplicate — the caller must not send a second notification either.
      const existingId = await findInquiryIdByToken(supabase, body.submissionToken);
      if (existingId) {
        return { status: "duplicate", id: existingId };
      }
    }

    console.error("Supabase insert failed:", insertError.message);
    return { status: "failed", message: insertError.message };
  }

  return { status: "inserted", id: inserted.id as string };
}

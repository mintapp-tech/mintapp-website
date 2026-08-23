import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// select("id") only — never returns full_name/email/description or any
// other stored field, including when used for the idempotency check a
// legitimate retry hits. Shared by route.ts's proactive lookup and
// insertInquiry's reactive duplicate-conflict handling.
export async function findInquiryIdByToken(supabase: SupabaseClient, submissionToken: string): Promise<string | null> {
  const { data } = await supabase.from("project_inquiries").select("id").eq("submission_token", submissionToken).single();
  return (data?.id as string) ?? null;
}

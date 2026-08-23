import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

// Server-only Data API client — uses the secret key, which bypasses RLS.
// The `server-only` import makes any accidental client-component import a
// build-time error rather than a leaked secret. See
// docs/supabase-database-permissions.md for the full architecture rationale.
export function getSupabaseServerClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set in the server environment.");
  }

  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}

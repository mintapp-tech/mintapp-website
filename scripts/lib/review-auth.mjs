// The isolated SYNTHETIC review Supabase project: used to test the admin
// application's sign-in against real Supabase Auth, and to back the admin
// review Preview. Never the live project.
//
// Settings come only from REVIEW_SUPABASE_* variables (for example in a
// git-ignored .env.review.local), never from SUPABASE_*, so the live project's
// keys can't be picked up by mistake. Every use first checks that the project
// answers public.review_environment() = 'synthetic-review'
// (supabase/review/01_review_marker.sql), which the live database never has.

import { createClient } from "@supabase/supabase-js";

// Synthetic sign-ins (no mail is sent: accounts are created already confirmed).
export const REVIEW_ACCOUNTS = {
  omar: { email: "omar.review@example.com", name: "Omar" },
  adam: { email: "adam.review@example.com", name: "Adam" },
  outsider: { email: "outsider.review@example.com", name: "Outsider" }, // not on the allowlist
};

export function reviewProjectFromEnv(env = process.env) {
  const url = env.REVIEW_SUPABASE_URL?.trim();
  const publishableKey = env.REVIEW_SUPABASE_PUBLISHABLE_KEY?.trim();
  const secretKey = env.REVIEW_SUPABASE_SECRET_KEY?.trim();
  if (!url || !publishableKey || !secretKey) throw new Error("Set REVIEW_SUPABASE_URL, REVIEW_SUPABASE_PUBLISHABLE_KEY and REVIEW_SUPABASE_SECRET_KEY for the synthetic review project.");
  if (env.SUPABASE_URL && env.SUPABASE_URL.trim() === url) throw new Error("REVIEW_SUPABASE_URL is the same project as SUPABASE_URL. Refusing.");
  return { url, publishableKey, secretKey };
}

const adminClient = ({ url, secretKey }) => createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

export async function assertReviewProject(project) {
  const { data, error } = await adminClient(project).rpc("review_environment");
  if (error || data !== "synthetic-review") throw new Error("This Supabase project is not marked as the synthetic review project (supabase/review/01_review_marker.sql). Refusing.");
}

// Deletes and recreates only the synthetic review accounts, already confirmed.
export async function resetReviewAccounts(project, password) {
  const admin = adminClient(project).auth.admin;
  const emails = new Set(Object.values(REVIEW_ACCOUNTS).map((a) => a.email));
  const { data, error } = await admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`Could not list users: ${error.message}`);
  for (const user of data.users.filter((u) => emails.has(u.email))) {
    const { error: deleteError } = await admin.deleteUser(user.id);
    if (deleteError) throw new Error(`Could not delete ${user.email}: ${deleteError.message}`);
  }
  for (const email of emails) {
    const { error: createError } = await admin.createUser({ email, password, email_confirm: true });
    if (createError) throw new Error(`Could not create ${email}: ${createError.message}`);
  }
}

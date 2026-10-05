import { z } from "zod";
import { teamAccounts } from "@/lib/team-auth/accounts";

// How admin sign-in works on this deployment.
//
//   supabase  Supabase Auth: email and password, then a required
//             authenticator-app code; only emails in ADMIN_TEAM get in.
//             The only sign-in for any deployed admin application.
//   demo      The custom team login, for the isolated local synthetic demo
//             only. Never available in a production build (NODE_ENV is
//             "production" for `next build`/`next start` and on Vercel).
//   off       Not configured: sign-in is closed.

export type AuthMode = "supabase" | "demo" | "off";
type Env = Record<string, string | undefined>;

export interface TeamMember {
  email: string;
  name: string;
}

const teamSchema = z
  .array(z.object({ email: z.string().trim().toLowerCase().email().max(320), name: z.string().trim().min(1).max(80) }))
  .min(1)
  .max(5);

// ADMIN_TEAM: the allowlist, e.g. [{"email":"omar@…","name":"Omar"},{"email":"adam@…","name":"Adam"}].
// Not secret, but server-side only. Invalid or duplicate entries close sign-in.
export function adminTeam(env: Env = process.env): TeamMember[] {
  try {
    const parsed = teamSchema.safeParse(JSON.parse(env.ADMIN_TEAM ?? ""));
    if (!parsed.success) return [];
    const emails = parsed.data.map((m) => m.email);
    return new Set(emails).size === emails.length ? parsed.data : [];
  } catch {
    return [];
  }
}

export interface SupabaseAuthConfig {
  url: string;
  publishableKey: string;
  team: TeamMember[];
  sessionSecret: string;
}

export function supabaseAuthConfig(env: Env = process.env): SupabaseAuthConfig | null {
  const url = env.SUPABASE_URL;
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY;
  const sessionSecret = env.ADMIN_SESSION_SECRET;
  const team = adminTeam(env);
  if (!url || !/^https?:\/\//.test(url) || !publishableKey || !sessionSecret || sessionSecret.length < 32 || team.length === 0) return null;
  return { url, publishableKey, team, sessionSecret };
}

export function authMode(env: Env = process.env): AuthMode {
  if (env.ADMIN_AUTH === "demo") {
    const localDemo = env.NODE_ENV !== "production" && env.DASHBOARD_DEMO === "1" && !!env.DASHBOARD_LOCAL_PG_PORT;
    return localDemo ? "demo" : "off";
  }
  return supabaseAuthConfig(env) ? "supabase" : "off";
}

export function teamMembers(env: Env = process.env): TeamMember[] {
  const mode = authMode(env);
  if (mode === "supabase") return adminTeam(env);
  if (mode === "demo") return teamAccounts(env).map(({ email, name }) => ({ email, name }));
  return [];
}

export const findMember = (email: string | null | undefined, env: Env = process.env) =>
  email ? (teamMembers(env).find((m) => m.email === email.trim().toLowerCase()) ?? null) : null;

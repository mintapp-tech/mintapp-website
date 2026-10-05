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
  id: string; // stable member id used for ownership, e.g. "omar"
  email: string; // sign-in identity; never shown in routine views
  name: string;
}

const MEMBER_ID = /^[a-z][a-z0-9-]{0,31}$/;
// "Omar" -> "omar"; a name without Latin letters needs an explicit id.
export const memberIdFrom = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const teamSchema = z
  .array(z.object({ id: z.string().trim().optional(), email: z.string().trim().toLowerCase().email().max(320), name: z.string().trim().min(1).max(80) }))
  .min(1)
  .max(5);

// Unique, well-formed ids and emails, or nobody at all.
export function withIds(members: { id?: string; email: string; name: string }[]): TeamMember[] {
  const team = members.map((m) => ({ id: m.id || memberIdFrom(m.name), email: m.email, name: m.name }));
  const ids = team.map((m) => m.id);
  const emails = team.map((m) => m.email);
  const valid = ids.every((id) => MEMBER_ID.test(id)) && new Set(ids).size === ids.length && new Set(emails).size === emails.length;
  return valid ? team : [];
}

// ADMIN_TEAM: the allowlist, e.g.
//   [{"id":"omar","email":"omar@…","name":"Omar"},{"id":"adam","email":"adam@…","name":"Adam"}]
// ("id" defaults to the name in lower case). Not secret, but server-side only.
// Invalid or duplicate entries close sign-in.
export function adminTeam(env: Env = process.env): TeamMember[] {
  try {
    const parsed = teamSchema.safeParse(JSON.parse(env.ADMIN_TEAM ?? ""));
    return parsed.success ? withIds(parsed.data) : [];
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
  if (mode === "demo") return withIds(teamAccounts(env).map(({ email, name }) => ({ email, name })));
  return [];
}

export const findMember = (email: string | null | undefined, env: Env = process.env) =>
  email ? (teamMembers(env).find((m) => m.email === email.trim().toLowerCase()) ?? null) : null;

export const memberById = (id: string, env: Env = process.env) => teamMembers(env).find((m) => m.id === id) ?? null;

// "Omar", "Omar & Adam", "Omar, Adam & Sara": ownership as people read it.
export function ownersLabel(ids: readonly string[], members: readonly TeamMember[], none: string): string {
  const names = members.filter((m) => ids.includes(m.id)).map((m) => m.name);
  const unknown = ids.filter((id) => !members.some((m) => m.id === id));
  const all = [...names, ...unknown];
  if (all.length === 0) return none;
  return all.length === 1 ? all[0] : `${all.slice(0, -1).join(", ")} & ${all[all.length - 1]}`;
}

// The owner choices offered in selectors: each member alone, then everyone
// together. Values are comma-separated member ids.
export function ownerChoices(members: readonly TeamMember[]): { value: string; label: string }[] {
  const single = members.map((m) => ({ value: m.id, label: m.name }));
  if (members.length < 2) return single;
  const ids = members.map((m) => m.id).sort();
  return [...single, { value: ids.join(","), label: ownersLabel(ids, members, "") }];
}

import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findMember, supabaseAuthConfig, type TeamMember } from "./config";
import { ACTIVITY_COOKIE, checkActivity } from "./activity";
import { createAuthClient, tokenClaims } from "./supabase-client";

// Who is using the admin application, decided on the server for every page
// and every data-changing action. Access needs all of:
//   - a session the auth server accepts now (signed-out or revoked sessions
//     are refused, not just expired cookies),
//   - an email on the server-side allowlist (ADMIN_TEAM),
//   - authenticator-app MFA completed for this session (aal2),
//   - activity within the idle and absolute limits.
// Anything that cannot be checked counts as no access.

export type AdminState =
  | { status: "off" }
  | { status: "signed_out" }
  | { status: "not_allowed" }
  | { status: "mfa_enroll"; email: string }
  | { status: "mfa_challenge"; email: string }
  | { status: "expired" }
  | { status: "ok"; member: TeamMember };

export async function serverAuthClient() {
  const config = supabaseAuthConfig();
  if (!config) return null;
  const jar = await cookies();
  return createAuthClient(config, {
    getAll: () => jar.getAll(),
    setAll: (list) => {
      // Pages cannot set cookies (the proxy refreshes sessions); actions can.
      try {
        for (const c of list) jar.set(c.name, c.value, c.options);
      } catch {}
    },
  });
}

export async function adminState(): Promise<AdminState> {
  const config = supabaseAuthConfig();
  if (!config) return { status: "off" };
  const client = await serverAuthClient();
  try {
    const {
      data: { session },
    } = await client!.auth.getSession();
    if (!session) return { status: "signed_out" };
    const {
      data: { user },
      error,
    } = await client!.auth.getUser(session.access_token);
    if (error || !user) return { status: "signed_out" };

    const member = findMember(user.email);
    if (!member || !user.email_confirmed_at) return { status: "not_allowed" };

    const { sessionId, aal } = tokenClaims(session.access_token);
    if (aal !== "aal2") {
      const verified = (user.factors ?? []).some((f) => f.factor_type === "totp" && f.status === "verified");
      return verified ? { status: "mfa_challenge", email: member.email } : { status: "mfa_enroll", email: member.email };
    }
    if (!sessionId) return { status: "signed_out" };
    const activity = checkActivity((await cookies()).get(ACTIVITY_COOKIE)?.value, sessionId, config.sessionSecret);
    if (!activity.ok) return { status: "expired" };
    return { status: "ok", member };
  } catch {
    console.error("admin_session_check_failed");
    return { status: "signed_out" };
  }
}

// For pages and server actions: the signed-in member, or a redirect.
export async function requireAdmin(): Promise<TeamMember> {
  const state = await adminState();
  if (state.status === "ok") return state.member;
  if (state.status === "mfa_enroll" || state.status === "mfa_challenge") redirect("/login/mfa");
  redirect(state.status === "expired" ? "/login?expired=1" : "/login");
}

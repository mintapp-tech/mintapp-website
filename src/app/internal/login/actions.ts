"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSqlGateway } from "@/lib/sql-gateway";
import { attemptLogin } from "@/lib/team-auth/login";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS, SESSION_TTL_SECONDS, createSessionToken, sessionIdHash, verifySessionToken } from "@/lib/team-auth/session";

export type LoginState = { error: string | null };

const MESSAGES = {
  invalid: "That email and password do not match a Mintapp team account.",
  locked: "Too many attempts. Try again in 15 minutes.",
  not_configured: "Dashboard access is not configured on this deployment.",
  unavailable: "Sign-in is temporarily unavailable. Try again shortly.",
} as const;

export async function loginAction(_previous: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const h = await headers();
  const client = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "local";

  const sql = getSqlGateway();
  try {
    const result = await attemptLogin(sql, email, password, client);
    if (!result.ok) return { error: MESSAGES[result.reason] };
    const session = createSessionToken({ email: result.email });
    if (!session) return { error: MESSAGES.not_configured };
    await sql.call("team_session_create", { p_sid_hash: sessionIdHash(session.sid), p_email: result.email, p_expires_at: session.expiresAt.toISOString() });
    (await cookies()).set(SESSION_COOKIE, session.token, { ...SESSION_COOKIE_OPTIONS, maxAge: SESSION_TTL_SECONDS });
  } catch {
    console.error("team_login_failed");
    return { error: MESSAGES.unavailable };
  }
  redirect("/internal/inquiries");
}

// Revokes the session on the server, then clears the cookie. A __Host-
// cookie can only be replaced by a Set-Cookie with matching Secure and Path,
// so it is overwritten with an immediately expired empty value (a plain
// delete omits Secure and browsers ignore it).
async function endSession(everywhere: boolean) {
  const jar = await cookies();
  const session = verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  if (session) {
    try {
      const sql = getSqlGateway();
      if (everywhere) await sql.call("team_sessions_revoke_all", { p_email: session.email });
      else await sql.call("team_session_revoke", { p_sid_hash: sessionIdHash(session.sid) });
    } catch {
      console.error("team_session_revoke_failed");
    }
  }
  jar.set(SESSION_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
  redirect("/internal/login");
}

export async function logoutAction() {
  await endSession(false);
}

export async function logoutEverywhereAction() {
  await endSession(true);
}

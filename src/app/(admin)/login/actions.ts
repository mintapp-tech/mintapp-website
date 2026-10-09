"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authMode, findMember, supabaseAuthConfig } from "@/lib/admin/auth/config";
import { ACTIVITY_COOKIE, ACTIVITY_COOKIE_OPTIONS, activityToken } from "@/lib/admin/auth/activity";
import { adminState, serverAuthClient } from "@/lib/admin/auth/state";
import { AUTH_COOKIE, tokenClaims } from "@/lib/admin/auth/supabase-client";

// Sign-in for the admin application.
//   Supabase Auth: password, then a required authenticator-app code; only
//   allowlisted emails are let through.

export type LoginError = "invalid" | "locked" | "notConfigured" | "unavailable";
export type LoginState = { error: LoginError | null };

export async function loginAction(_previous: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const mode = authMode();
  if (mode === "off") return { error: "notConfigured" };

  const client = await serverAuthClient();
  try {
    const { error } = await client!.auth.signInWithPassword({ email, password });
    if (error) return { error: error.status === 429 ? "locked" : error.status && error.status < 500 ? "invalid" : "unavailable" };
    // Same answer as a wrong password for anyone not on the allowlist, and
    // their session is ended at once.
    if (!findMember(email)) {
      await client!.auth.signOut({ scope: "local" });
      return { error: "invalid" };
    }
  } catch {
    console.error("admin_login_failed");
    return { error: "unavailable" };
  }
  redirect("/login/mfa");
}

// ---------------------------------------------------------------------------
// Authenticator-app MFA (Supabase Auth only)

export type EnrollState = { factorId: string; qr: string; secret: string } | { error: "unavailable" } | null;
export type MfaState = { error: "invalidCode" | "unavailable" | null };

export async function startEnrollmentAction(): Promise<EnrollState> {
  // Only for an allowlisted account that has no authenticator yet.
  const state = await adminState();
  if (state.status !== "mfa_enroll") redirect(state.status === "ok" ? "/inquiries" : state.status === "mfa_challenge" ? "/login/mfa" : "/login");
  const client = (await serverAuthClient())!;
  try {
    const { data: factors } = await client.auth.mfa.listFactors();
    for (const stale of (factors?.all ?? []).filter((f) => f.status === "unverified")) await client.auth.mfa.unenroll({ factorId: stale.id });
    const { data, error } = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: `Mintapp admin ${new Date().toISOString().slice(0, 10)}`, issuer: "Mintapp" });
    if (error || !data || data.type !== "totp") return { error: "unavailable" };
    return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
  } catch {
    console.error("admin_mfa_enroll_failed");
    return { error: "unavailable" };
  }
}

export async function verifyMfaAction(_previous: MfaState, form: FormData): Promise<MfaState> {
  const code = String(form.get("code") ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(code)) return { error: "invalidCode" };
  const state = await adminState();
  if (state.status !== "mfa_enroll" && state.status !== "mfa_challenge") redirect(state.status === "ok" ? "/inquiries" : "/login");
  const config = supabaseAuthConfig()!;
  const client = (await serverAuthClient())!;
  try {
    let factorId = String(form.get("factorId") ?? "");
    if (state.status === "mfa_challenge") {
      const { data } = await client.auth.mfa.listFactors();
      factorId = data?.totp[0]?.id ?? "";
    }
    if (!factorId) return { error: "unavailable" };
    const { data, error } = await client.auth.mfa.challengeAndVerify({ factorId, code });
    if (error || !data) return { error: error && error.status && error.status < 500 ? "invalidCode" : "unavailable" };
    const { sessionId, aal } = tokenClaims(data.access_token);
    if (aal !== "aal2" || !sessionId) return { error: "unavailable" };
    (await cookies()).set(ACTIVITY_COOKIE, activityToken(sessionId, config.sessionSecret), ACTIVITY_COOKIE_OPTIONS);
  } catch {
    console.error("admin_mfa_verify_failed");
    return { error: "unavailable" };
  }
  redirect("/inquiries");
}

// ---------------------------------------------------------------------------
// Sign-out: the session is revoked on the server, then the cookies cleared.

async function endSession(everywhere: boolean) {
  const jar = await cookies();
  const mode = authMode();
  if (mode === "supabase") {
    try {
      await (await serverAuthClient())!.auth.signOut({ scope: everywhere ? "global" : "local" });
    } catch {
      console.error("admin_session_revoke_failed");
    }
    for (const c of jar.getAll()) if (c.name.startsWith(AUTH_COOKIE)) jar.set(c.name, "", { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 0 });
    jar.set(ACTIVITY_COOKIE, "", { ...ACTIVITY_COOKIE_OPTIONS, maxAge: 0 });
  }
  redirect("/login");
}

export async function logoutAction() {
  await endSession(false);
}

export async function logoutEverywhereAction() {
  await endSession(true);
}

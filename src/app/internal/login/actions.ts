"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSqlGateway } from "@/lib/sql-gateway";
import { attemptLogin } from "@/lib/team-auth/login";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, createSessionToken } from "@/lib/team-auth/session";

export type LoginState = { error: string | null };

const MESSAGES = {
  invalid: "That email and password do not match a Mintapp team account.",
  locked: "Too many attempts. Try again in 15 minutes.",
  not_configured: "Dashboard access is not configured on this deployment.",
} as const;

export async function loginAction(_previous: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const h = await headers();
  const client = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "local";

  let result;
  try {
    result = await attemptLogin(getSqlGateway(), email, password, client);
  } catch {
    console.error("team_login_failed");
    return { error: "Sign-in is temporarily unavailable." };
  }
  if (!result.ok) return { error: MESSAGES[result.reason] };

  const token = createSessionToken({ email: result.email });
  if (!token) return { error: MESSAGES.not_configured };
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: SESSION_TTL_SECONDS });
  redirect("/internal/inquiries");
}

// A __Host- cookie can only be replaced by a Set-Cookie with the same Secure
// and Path attributes; cookies().delete() omits Secure, so browsers ignore
// it. Overwrite it with an immediately expired empty value instead.
export async function logoutAction() {
  (await cookies()).set(SESSION_COOKIE, "", { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 0 });
  redirect("/internal/login");
}

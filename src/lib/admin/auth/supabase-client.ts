import { createServerClient } from "@supabase/ssr";
import type { SupabaseAuthConfig } from "./config";
import { ABSOLUTE_SECONDS } from "./activity";

// Supabase Auth for the admin application, server-side only: no browser
// Supabase client exists, so the session cookies can be HttpOnly.
//
// Every auth cookie is forced to be host-only (__Host- prefix: Secure,
// Path=/, no Domain), HttpOnly and SameSite=Strict, and to last at most the
// 12-hour absolute session limit, whatever the library suggests.

export const AUTH_COOKIE = "__Host-mintapp-admin-auth";
const FORCED = { httpOnly: true, secure: true, sameSite: "strict", path: "/" } as const;

export interface CookieAdapter {
  getAll(): { name: string; value: string }[];
  setAll(cookies: { name: string; value: string; options: Record<string, unknown> }[]): void;
}

export function enforceCookieOptions(options: Record<string, unknown> = {}) {
  const rest = { ...options };
  delete rest.domain;
  const maxAge = typeof rest.maxAge === "number" ? Math.min(rest.maxAge, ABSOLUTE_SECONDS) : ABSOLUTE_SECONDS;
  return { ...rest, ...FORCED, maxAge };
}

export function createAuthClient(config: SupabaseAuthConfig, adapter: CookieAdapter) {
  return createServerClient(config.url, config.publishableKey, {
    cookieOptions: { name: AUTH_COOKIE, ...FORCED },
    cookies: {
      getAll: () => adapter.getAll(),
      setAll: (cookies) => adapter.setAll(cookies.map((c) => ({ name: c.name, value: c.value, options: enforceCookieOptions(c.options as Record<string, unknown>) }))),
    },
  });
}

export type AuthClient = ReturnType<typeof createAuthClient>;

// Claims of an access token the auth server has just accepted (getUser with
// that token succeeded), so they can be read without re-verifying.
export function tokenClaims(accessToken: string): { sessionId: string | null; aal: string | null } {
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split(".")[1] ?? "", "base64url").toString("utf8"));
    return { sessionId: typeof payload.session_id === "string" ? payload.session_id : null, aal: typeof payload.aal === "string" ? payload.aal : null };
  } catch {
    return { sessionId: null, aal: null };
  }
}

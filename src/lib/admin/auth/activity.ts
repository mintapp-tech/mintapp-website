import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// Idle and absolute limits for Supabase Auth sessions, enforced by the app
// (Supabase's own inactivity and time-box settings are paid-plan features).
// A host-only cookie records, for one Supabase session id, when the session
// reached full (MFA) sign-in and when it was last used, signed with
// ADMIN_SESSION_SECRET. It is refreshed on each request while valid.

export const ACTIVITY_COOKIE = "__Host-mintapp-admin-activity";
export const IDLE_SECONDS = 2 * 60 * 60;
export const ABSOLUTE_SECONDS = 12 * 60 * 60;

interface Activity {
  s: string; // SHA-256 of the Supabase session id
  a: number; // full sign-in time (ms)
  t: number; // last use (ms)
}

const sign = (data: string, secret: string) => createHmac("sha256", secret).update(data).digest("base64url");
const sessionHash = (sessionId: string) => createHash("sha256").update(sessionId).digest("hex");

export function activityToken(sessionId: string, secret: string, now = Date.now(), startedAt = now): string {
  const data = Buffer.from(JSON.stringify({ s: sessionHash(sessionId), a: startedAt, t: now } satisfies Activity)).toString("base64url");
  return `${data}.${sign(data, secret)}`;
}

export type ActivityCheck = { ok: true; startedAt: number } | { ok: false; reason: "missing" | "invalid" | "other_session" | "idle" | "expired" };

export function checkActivity(token: string | undefined, sessionId: string, secret: string, now = Date.now()): ActivityCheck {
  if (!token) return { ok: false, reason: "missing" };
  const [data, mac] = token.split(".");
  if (!data || !mac) return { ok: false, reason: "invalid" };
  const expected = Buffer.from(sign(data, secret));
  const actual = Buffer.from(mac);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return { ok: false, reason: "invalid" };
  let activity: Activity;
  try {
    activity = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (typeof activity.s !== "string" || typeof activity.a !== "number" || typeof activity.t !== "number") return { ok: false, reason: "invalid" };
  if (activity.s !== sessionHash(sessionId)) return { ok: false, reason: "other_session" };
  if (now - activity.a > ABSOLUTE_SECONDS * 1000 || activity.t > now + 60_000) return { ok: false, reason: "expired" };
  if (now - activity.t > IDLE_SECONDS * 1000) return { ok: false, reason: "idle" };
  return { ok: true, startedAt: activity.a };
}

export const ACTIVITY_COOKIE_OPTIONS = { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: ABSOLUTE_SECONDS } as const;

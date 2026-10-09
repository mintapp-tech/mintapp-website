import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { teamAccounts, sessionSecret, type TeamAccount } from "./accounts";

// Team sessions have two parts, both required:
//  1. a signed cookie: base64url(JSON payload) "." base64url(HMAC-SHA256),
//     carrying the email, a random session id and the issue/expiry times;
//  2. a server-side record of that session (only a SHA-256 hash of the id is
//     stored), so it can be revoked and expires after inactivity.
// This module handles part 1; guard.ts checks part 2 on every request.
// Removing an account or rotating DASHBOARD_SESSION_SECRET also ends access.

export const SESSION_COOKIE = "__Host-mintapp_team";
export const SESSION_TTL_SECONDS = 12 * 60 * 60;
export const SESSION_IDLE_SECONDS = 2 * 60 * 60;

// The same attributes locally and in HTTPS deployments. Browsers accept
// Secure cookies on http://localhost; the __Host- prefix forbids a Domain
// attribute and requires Secure and Path=/.
export const SESSION_COOKIE_OPTIONS = { httpOnly: true, secure: true, sameSite: "strict", path: "/" } as const;

export interface TeamMember {
  email: string;
  name: string;
}

export interface VerifiedSession extends TeamMember {
  sid: string;
}

interface Payload {
  v: 2;
  e: string;
  s: string;
  iat: number;
  exp: number;
}

type Env = Record<string, string | undefined>;
const sign = (data: string, secret: string) => createHmac("sha256", secret).update(data).digest("base64url");

export const sessionIdHash = (sid: string) => createHash("sha256").update(sid).digest("hex");

export function createSessionToken(
  account: Pick<TeamAccount, "email">,
  now = Date.now(),
  env: Env = process.env,
): { token: string; sid: string; expiresAt: Date } | null {
  const secret = sessionSecret(env);
  if (!secret) return null;
  const iat = Math.floor(now / 1000);
  const sid = randomBytes(32).toString("base64url");
  const payload: Payload = { v: 2, e: account.email, s: sid, iat, exp: iat + SESSION_TTL_SECONDS };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return { token: `${data}.${sign(data, secret)}`, sid, expiresAt: new Date(payload.exp * 1000) };
}

// Checks the signature, expiry and account. The server-side record is
// checked separately (guard.ts).
export function verifySessionToken(token: string | undefined | null, now = Date.now(), env: Env = process.env): VerifiedSession | null {
  const secret = sessionSecret(env);
  if (!secret || !token || token.length > 1024) return null;
  const [data, signature, extra] = token.split(".");
  if (!data || !signature || extra !== undefined) return null;
  const expected = Buffer.from(sign(data, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  let payload: Payload;
  try {
    payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const seconds = Math.floor(now / 1000);
  if (payload?.v !== 2 || typeof payload.e !== "string" || typeof payload.s !== "string" || payload.s.length < 32) return null;
  if (typeof payload.exp !== "number" || typeof payload.iat !== "number") return null;
  if (payload.exp <= seconds || payload.iat > seconds + 60 || payload.exp - payload.iat > SESSION_TTL_SECONDS) return null;
  const account = teamAccounts(env).find((a) => a.email === payload.e);
  return account ? { email: account.email, name: account.name, sid: payload.s } : null;
}

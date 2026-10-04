import { createHmac, timingSafeEqual } from "node:crypto";
import { teamAccounts, sessionSecret, type TeamAccount } from "./accounts";

// Signed team sessions: base64url(JSON payload) "." base64url(HMAC-SHA256).
// A session is valid only while it is unexpired, correctly signed with the
// current DASHBOARD_SESSION_SECRET, and its email is still a team account, so
// removing an account or rotating the secret ends access immediately.

export const SESSION_COOKIE = "__Host-mintapp_team";
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

export interface TeamMember {
  email: string;
  name: string;
}

interface Payload {
  v: 1;
  e: string;
  iat: number;
  exp: number;
}

type Env = Record<string, string | undefined>;
const sign = (data: string, secret: string) => createHmac("sha256", secret).update(data).digest("base64url");

export function createSessionToken(account: Pick<TeamAccount, "email">, now = Date.now(), env: Env = process.env): string | null {
  const secret = sessionSecret(env);
  if (!secret) return null;
  const iat = Math.floor(now / 1000);
  const payload: Payload = { v: 1, e: account.email, iat, exp: iat + SESSION_TTL_SECONDS };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data, secret)}`;
}

export function verifySessionToken(token: string | undefined | null, now = Date.now(), env: Env = process.env): TeamMember | null {
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
  if (payload?.v !== 1 || typeof payload.e !== "string" || typeof payload.exp !== "number" || typeof payload.iat !== "number") return null;
  if (payload.exp <= seconds || payload.iat > seconds + 60 || payload.exp - payload.iat > SESSION_TTL_SECONDS) return null;
  const account = teamAccounts(env).find((a) => a.email === payload.e);
  return account ? { email: account.email, name: account.name } : null;
}

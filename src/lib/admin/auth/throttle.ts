import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { getSqlGateway, type SqlGateway } from "@/lib/sql-gateway";

// Brake in front of the password and authenticator-code steps (Supabase Auth
// has its own limits behind this one). Keys are opaque salted hashes; no email
// address or IP address is stored. Two keys per account:
//  - the account from one client: locked after 8 failures in 15 minutes;
//  - the account from anywhere: locked after 30, a ceiling high enough that a
//    few guesses from elsewhere cannot lock a teammate out, low enough to stop
//    a distributed guessing run.
// The client address is the hosting proxy's header and is only a throttling
// hint, never an access decision. If the throttle cannot be checked, sign-in
// is refused (fail closed).

export const PAIR_FAILURE_LIMIT = 8;
export const ACCOUNT_FAILURE_LIMIT = 30;

export type Step = "password" | "code";

const keyFor = (secret: string, kind: string, value: string) => createHash("sha256").update(`${secret}|${kind}|${value}`).digest("hex");

export function throttleKeys(secret: string, step: Step, who: string, client: string): [string, number][] {
  const subject = who.trim().toLowerCase().slice(0, 320);
  return [
    [keyFor(secret, `${step}-client`, `${subject}|${client || "unknown"}`), PAIR_FAILURE_LIMIT],
    [keyFor(secret, `${step}-account`, subject), ACCOUNT_FAILURE_LIMIT],
  ];
}

export async function clientAddress(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim().slice(0, 64);
}

export async function isLocked(keys: [string, number][], sql: SqlGateway = getSqlGateway()): Promise<boolean> {
  for (const [key] of keys) if (await sql.call<boolean>("admin_auth_locked", { p_key: key })) return true;
  return false;
}

// Records the outcome; returns true if a failure just locked an account key.
export async function recordOutcome(keys: [string, number][], success: boolean, sql: SqlGateway = getSqlGateway()): Promise<boolean> {
  let locked = false;
  for (const [key, limit] of keys) locked = (await sql.call<boolean>("admin_auth_record", { p_key: key, p_success: success, p_limit: limit })) || locked;
  return locked;
}

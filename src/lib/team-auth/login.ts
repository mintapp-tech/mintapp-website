import "server-only";
import { createHash } from "node:crypto";
import { verifyPassword } from "../../../scripts/lib/team-password.mjs";
import { teamAccounts, sessionSecret } from "./accounts";
import type { SqlGateway } from "@/lib/sql-gateway";

// Checks a login attempt. Unknown emails take the same time as wrong
// passwords. Throttling has two keys (opaque hashes; no email or IP stored):
//  - the account from one client: locked after 8 failures in 15 minutes;
//  - the account from anywhere: locked after 30, a ceiling high enough that
//    a few guesses from elsewhere cannot lock a teammate out, low enough to
//    stop a distributed guessing run.
// The client address comes from the hosting proxy's headers and is only a
// throttling hint, never an access decision.

// A real hash of a random throwaway password, so unknown emails still pay
// the full scrypt cost.
const DUMMY_HASH = "scrypt$32768$8$1$V4xijksNCSurdbnxFk2MzQ$uW3TsnVMNXN_D7-Le6MiEnqfeMvPvh4d9g8OHVgFHC8naT1CrOONMfDSf9hA5lKLp5B3xxCfioErSTniink1lA";

export const PAIR_FAILURE_LIMIT = 8;
export const ACCOUNT_FAILURE_LIMIT = 30;

export type LoginResult = { ok: true; email: string } | { ok: false; reason: "invalid" | "locked" | "not_configured" };

const keyFor = (secret: string, kind: string, value: string) => createHash("sha256").update(`${secret}|${kind}|${value}`).digest("hex");

export async function attemptLogin(sql: SqlGateway, email: string, password: string, clientAddress: string): Promise<LoginResult> {
  const secret = sessionSecret();
  const accounts = teamAccounts();
  if (!secret || accounts.length === 0) return { ok: false, reason: "not_configured" };

  const normalized = email.trim().toLowerCase().slice(0, 320);
  const limits: [string, number][] = [
    [keyFor(secret, "account-client", `${normalized}|${clientAddress || "unknown"}`), PAIR_FAILURE_LIMIT],
    [keyFor(secret, "account", normalized), ACCOUNT_FAILURE_LIMIT],
  ];
  for (const [key] of limits) if (await sql.call<boolean>("team_login_locked", { p_key: key })) return { ok: false, reason: "locked" };

  const account = accounts.find((a) => a.email === normalized);
  const valid = (await verifyPassword(password.slice(0, 512), account?.passwordHash ?? DUMMY_HASH)) && Boolean(account);
  if (!valid) {
    let locked = false;
    for (const [key, limit] of limits) locked = (await sql.call<boolean>("team_login_record_limited", { p_key: key, p_success: false, p_limit: limit })) || locked;
    return { ok: false, reason: locked ? "locked" : "invalid" };
  }
  for (const [key, limit] of limits) await sql.call("team_login_record_limited", { p_key: key, p_success: true, p_limit: limit });
  return { ok: true, email: account!.email };
}

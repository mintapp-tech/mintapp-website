import "server-only";
import { createHash } from "node:crypto";
import { verifyPassword } from "../../../scripts/lib/team-password.mjs";
import { teamAccounts, sessionSecret } from "./accounts";
import type { SqlGateway } from "@/lib/sql-gateway";

// Checks a login attempt. Unknown emails take the same time as wrong
// passwords, and attempts are throttled per account and per client address
// (keys are opaque hashes; no email or IP is stored).

// A real hash of a random throwaway password, so unknown emails still pay
// the full scrypt cost.
const DUMMY_HASH = "scrypt$32768$8$1$V4xijksNCSurdbnxFk2MzQ$uW3TsnVMNXN_D7-Le6MiEnqfeMvPvh4d9g8OHVgFHC8naT1CrOONMfDSf9hA5lKLp5B3xxCfioErSTniink1lA";

export type LoginResult = { ok: true; email: string } | { ok: false; reason: "invalid" | "locked" | "not_configured" };

const keyFor = (secret: string, kind: string, value: string) => createHash("sha256").update(`${secret}|${kind}|${value}`).digest("hex");

export async function attemptLogin(sql: SqlGateway, email: string, password: string, clientAddress: string): Promise<LoginResult> {
  const secret = sessionSecret();
  const accounts = teamAccounts();
  if (!secret || accounts.length === 0) return { ok: false, reason: "not_configured" };

  const normalized = email.trim().toLowerCase().slice(0, 320);
  const keys = [keyFor(secret, "account", normalized), keyFor(secret, "client", clientAddress || "unknown")];
  for (const key of keys) if (await sql.call<boolean>("team_login_locked", { p_key: key })) return { ok: false, reason: "locked" };

  const account = accounts.find((a) => a.email === normalized);
  const valid = (await verifyPassword(password.slice(0, 512), account?.passwordHash ?? DUMMY_HASH)) && Boolean(account);
  if (!valid) {
    let locked = false;
    for (const key of keys) locked = (await sql.call<boolean>("team_login_record", { p_key: key, p_success: false })) || locked;
    return { ok: false, reason: locked ? "locked" : "invalid" };
  }
  await sql.call("team_login_record", { p_key: keys[0], p_success: true });
  return { ok: true, email: account!.email };
}

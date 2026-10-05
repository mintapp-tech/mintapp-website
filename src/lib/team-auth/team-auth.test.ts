import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { hashPassword, verifyPassword, HASH_PATTERN } from "../../../scripts/lib/team-password.mjs";
import { teamAccounts } from "./accounts";
import {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  SESSION_IDLE_SECONDS,
  SESSION_TTL_SECONDS,
  createSessionToken,
  sessionIdHash,
  verifySessionToken,
} from "./session";

// Audit tests for the team dashboard's login. Each describes one claim made
// about the implementation.

const PASSWORD = "a-long-enough-test-password";
const SECRET = "x".repeat(40);
const envWith = (hash: string) => ({
  TEAM_ACCOUNTS: JSON.stringify([{ email: "Omar@Mintapp.Tech", name: "Omar", passwordHash: hash }]),
  DASHBOARD_SESSION_SECRET: SECRET,
});

describe("password hashing", () => {
  test("scrypt (N=32768, r=8, p=1), a fresh 16-byte random salt per hash, 64-byte key", async () => {
    const [a, b] = [await hashPassword(PASSWORD), await hashPassword(PASSWORD)];
    for (const hash of [a, b]) {
      const m = HASH_PATTERN.exec(hash)!;
      expect([m[1], m[2], m[3]]).toEqual(["32768", "8", "1"]);
      expect(Buffer.from(m[4], "base64url")).toHaveLength(16);
      expect(Buffer.from(m[5], "base64url")).toHaveLength(64);
    }
    // Same password, different salt and therefore different hash.
    expect(a.split("$")[4]).not.toBe(b.split("$")[4]);
    expect(a).not.toBe(b);
  });

  test("verification re-derives with the stored salt and parameters and compares in constant time", async () => {
    const hash = await hashPassword(PASSWORD);
    expect(await verifyPassword(PASSWORD, hash)).toBe(true);
    expect(await verifyPassword(`${PASSWORD}x`, hash)).toBe(false);
    // Unicode-equivalent input (NFKC) verifies the same.
    expect(await verifyPassword(PASSWORD.normalize("NFKD"), hash)).toBe(true);
    // Weakened or malformed parameters are refused rather than computed.
    expect(await verifyPassword(PASSWORD, hash.replace("scrypt$32768$", "scrypt$1024$"))).toBe(false);
    expect(await verifyPassword(PASSWORD, "plain-text")).toBe(false);
  });

  test("short passwords cannot be hashed", async () => {
    await expect(hashPassword("short")).rejects.toThrow(/at least 16/);
  });

  test("the verify function compares with timingSafeEqual", () => {
    expect(readFileSync("scripts/lib/team-password.mjs", "utf8")).toMatch(/timingSafeEqual\(actual, expected\)/);
  });
});

describe("accounts", () => {
  test("normalized; invalid, plain-text or duplicate configuration means no accounts at all", async () => {
    const hash = await hashPassword(PASSWORD);
    expect(teamAccounts(envWith(hash))).toEqual([{ email: "omar@mintapp.tech", name: "Omar", passwordHash: hash }]);
    expect(teamAccounts({ TEAM_ACCOUNTS: "not json" })).toEqual([]);
    expect(teamAccounts({ TEAM_ACCOUNTS: JSON.stringify([{ email: "a@b.co", name: "A", passwordHash: "plain-text" }]) })).toEqual([]);
    expect(teamAccounts({ TEAM_ACCOUNTS: JSON.stringify([{ email: "a@b.co", name: "A", passwordHash: hash }, { email: "A@b.co", name: "B", passwordHash: hash }]) })).toEqual([]);
  });
});

describe("session cookie", () => {
  test("__Host- prefixed, HttpOnly, Secure, SameSite=Strict, Path=/, no Domain, 12 hours", () => {
    expect(SESSION_COOKIE).toBe("__Host-mintapp_team");
    expect(SESSION_COOKIE_OPTIONS).toEqual({ httpOnly: true, secure: true, sameSite: "strict", path: "/" });
    expect(SESSION_TTL_SECONDS).toBe(43_200);
    expect(SESSION_IDLE_SECONDS).toBe(7_200);
  });

  test("tokens carry a unique random session id; only its SHA-256 hash is stored", async () => {
    const env = envWith(await hashPassword(PASSWORD));
    const one = createSessionToken({ email: "omar@mintapp.tech" }, Date.now(), env)!;
    const two = createSessionToken({ email: "omar@mintapp.tech" }, Date.now(), env)!;
    expect(one.sid).not.toBe(two.sid);
    expect(Buffer.from(one.sid, "base64url")).toHaveLength(32);
    expect(sessionIdHash(one.sid)).toMatch(/^[0-9a-f]{64}$/);
    expect(one.token).not.toContain(sessionIdHash(one.sid));
  });

  test("verifies only when signed, unexpired and for a current account", async () => {
    const env = envWith(await hashPassword(PASSWORD));
    const now = Date.now();
    const { token, sid } = createSessionToken({ email: "omar@mintapp.tech" }, now, env)!;
    expect(verifySessionToken(token, now, env)).toEqual({ email: "omar@mintapp.tech", name: "Omar", sid });
    const [data, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ v: 2, e: "omar@mintapp.tech", s: "s".repeat(43), iat: 0, exp: 9e9 })).toString("base64url");
    expect(verifySessionToken(`${forged}.${sig}`, now, env)).toBeNull();
    expect(verifySessionToken(`${data}.${sig.slice(0, -2)}xx`, now, env)).toBeNull();
    expect(verifySessionToken(token, now + (SESSION_TTL_SECONDS + 1) * 1000, env)).toBeNull();
    expect(verifySessionToken(token, now, { ...env, DASHBOARD_SESSION_SECRET: "y".repeat(40) })).toBeNull();
    expect(verifySessionToken(token, now, { ...env, TEAM_ACCOUNTS: "[]" })).toBeNull();
    expect(createSessionToken({ email: "omar@mintapp.tech" }, now, { ...env, DASHBOARD_SESSION_SECRET: "short" })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Server-side checks, with Next.js and the database replaced by test doubles.

const cookieJar = new Map<string, string>();
const sqlCall = vi.fn();
const redirect = vi.fn((to: string) => {
  throw new Error(`REDIRECT:${to}`);
});
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined), set: vi.fn() }),
  headers: async () => new Headers(),
}));
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to), notFound: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/sql-gateway", () => ({
  getSqlGateway: () => ({ kind: "supabase", call: (...args: unknown[]) => sqlCall(...args) }),
  isLocalDashboardDemo: () => true,
}));

describe("server-side session check", () => {
  let env: Record<string, string>;
  beforeEach(async () => {
    env = envWith(await hashPassword(PASSWORD));
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    cookieJar.clear();
    sqlCall.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  test("a valid cookie is accepted only while its server-side session is live; failures refuse access", async () => {
    const { currentTeamMember } = await import("./guard");
    const { token, sid } = createSessionToken({ email: "omar@mintapp.tech" })!;
    cookieJar.set(SESSION_COOKIE, token);
    sqlCall.mockResolvedValueOnce(true);
    expect(await currentTeamMember()).toEqual({ email: "omar@mintapp.tech", name: "Omar" });
    expect(sqlCall).toHaveBeenCalledWith("team_session_touch", { p_sid_hash: sessionIdHash(sid), p_email: "omar@mintapp.tech", p_idle_seconds: SESSION_IDLE_SECONDS });
    sqlCall.mockResolvedValueOnce(false); // revoked, expired or idle
    expect(await currentTeamMember()).toBeNull();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    sqlCall.mockRejectedValueOnce(new Error("db down"));
    expect(await currentTeamMember()).toBeNull();
    spy.mockRestore();
  });

  test("every action that changes data refuses to run without a session", async () => {
    const actions = await import("@/app/internal/inquiries/actions");
    const form = new FormData();
    form.set("inquiryId", "11111111-0000-4000-8000-000000000001");
    const names = Object.keys(actions).filter((k) => typeof (actions as Record<string, unknown>)[k] === "function");
    expect(names.length).toBeGreaterThanOrEqual(10);
    for (const name of names) {
      sqlCall.mockReset();
      await expect((actions as unknown as Record<string, (f: FormData) => Promise<void>>)[name](form), name).rejects.toThrow("REDIRECT:/internal/login");
      expect(sqlCall, name).not.toHaveBeenCalled();
    }
    // A cookie whose server-side session is gone is refused the same way.
    cookieJar.set(SESSION_COOKIE, createSessionToken({ email: "omar@mintapp.tech" })!.token);
    for (const name of names) {
      sqlCall.mockReset();
      sqlCall.mockResolvedValueOnce(false);
      await expect((actions as unknown as Record<string, (f: FormData) => Promise<void>>)[name](form), name).rejects.toThrow("REDIRECT:/internal/login");
      expect(sqlCall.mock.calls.map((c) => c[0]), name).toEqual(["team_session_touch"]);
    }
  });

  test("throttling: 8 failures lock an account from one client; the account-wide ceiling is 30", async () => {
    const { attemptLogin, PAIR_FAILURE_LIMIT, ACCOUNT_FAILURE_LIMIT } = await import("./login");
    expect([PAIR_FAILURE_LIMIT, ACCOUNT_FAILURE_LIMIT]).toEqual([8, 30]);
    const limits: number[] = [];
    sqlCall.mockImplementation(async (fn: string, args: { p_limit?: number }) => {
      if (fn === "team_login_record_limited") limits.push(args.p_limit!);
      return false;
    });
    const sql = { kind: "supabase" as const, call: sqlCall as never };
    expect(await attemptLogin(sql, "omar@mintapp.tech", "wrong-password-here", "203.0.113.5")).toEqual({ ok: false, reason: "invalid" });
    expect(limits).toEqual([8, 30]);
    expect(await attemptLogin(sql, "Omar@Mintapp.Tech ", PASSWORD, "203.0.113.5")).toEqual({ ok: true, email: "omar@mintapp.tech" });
  });

  test("an unknown email still pays the full password check", async () => {
    const { attemptLogin } = await import("./login");
    sqlCall.mockResolvedValue(false);
    const sql = { kind: "supabase" as const, call: sqlCall as never };
    const started = performance.now();
    expect(await attemptLogin(sql, "nobody@example.com", PASSWORD, "x")).toEqual({ ok: false, reason: "invalid" });
    expect(performance.now() - started).toBeGreaterThan(20);
  });
});

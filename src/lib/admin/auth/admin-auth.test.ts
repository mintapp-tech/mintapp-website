import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { adminTeam, authMode, findMember, memberIdFrom, ownerChoices, ownersLabel, withIds } from "./config";
import { ABSOLUTE_SECONDS, IDLE_SECONDS, activityToken, checkActivity } from "./activity";
import { enforceCookieOptions, tokenClaims } from "./supabase-client";
import { adminHosts, isAdminHost, isAdminPage } from "../surface";

// The admin application's sign-in rules. Supabase Auth itself is replaced by
// a test double here; tests/admin runs the flow end to end against a local
// stand-in auth server.

const TEAM = JSON.stringify([
  { email: "Omar@Mintapp.Tech", name: "Omar" },
  { email: "adam@mintapp.tech", name: "Adam" },
]);
const SECRET = "s".repeat(40);
const SUPABASE = { SUPABASE_URL: "https://example.supabase.co", SUPABASE_PUBLISHABLE_KEY: "pk", ADMIN_TEAM: TEAM, ADMIN_SESSION_SECRET: SECRET };
// Settings of the removed local demo login: they must open nothing.
const RETIRED = { ADMIN_AUTH: "demo", DASHBOARD_DEMO: "1", DASHBOARD_LOCAL_PG_PORT: "5999", TEAM_ACCOUNTS: "[]" };

describe("sign-in mode", () => {
  test("Supabase Auth is the only sign-in; the retired demo settings open nothing", () => {
    expect(authMode({ ...SUPABASE, NODE_ENV: "production" })).toBe("supabase");
    expect(authMode({ ...RETIRED, NODE_ENV: "development" })).toBe("off");
    expect(authMode({ ...RETIRED, NODE_ENV: "production" })).toBe("off");
  });

  test("incomplete Supabase settings close sign-in", () => {
    for (const missing of Object.keys(SUPABASE)) expect(authMode({ ...SUPABASE, [missing]: "", NODE_ENV: "production" }), missing).toBe("off");
    expect(authMode({ ...SUPABASE, ADMIN_SESSION_SECRET: "short", NODE_ENV: "production" })).toBe("off");
    expect(authMode({ ...SUPABASE, SUPABASE_URL: "not-a-url", NODE_ENV: "production" })).toBe("off");
  });

  test("the allowlist is normalized; invalid or duplicate entries allow nobody", () => {
    expect(adminTeam({ ADMIN_TEAM: TEAM }).map((m) => m.email)).toEqual(["omar@mintapp.tech", "adam@mintapp.tech"]);
    expect(findMember(" OMAR@mintapp.tech", { ...SUPABASE, NODE_ENV: "production" })?.name).toBe("Omar");
    expect(findMember("someone@example.com", { ...SUPABASE, NODE_ENV: "production" })).toBeNull();
    expect(adminTeam({ ADMIN_TEAM: JSON.stringify([{ email: "a@b.co", name: "A" }, { email: "A@b.co", name: "B" }]) })).toEqual([]);
    expect(adminTeam({ ADMIN_TEAM: "not json" })).toEqual([]);
  });
});

describe("team members and ownership", () => {
  const team = withIds([
    { email: "omar@mintapp.tech", name: "Omar" },
    { email: "adam@mintapp.tech", name: "Adam" },
  ]);
  test("members get stable ids; invalid or duplicate ids allow nobody", () => {
    expect(team.map((m) => m.id)).toEqual(["omar", "adam"]);
    expect(memberIdFrom("Omar (demo)")).toBe("omar");
    expect(withIds([{ email: "a@b.co", name: "عمر" }])).toEqual([]); // needs an explicit id
    expect(withIds([{ id: "omar", email: "a@b.co", name: "عمر" }]).map((m) => m.id)).toEqual(["omar"]);
    expect(withIds([{ id: "x", email: "a@b.co", name: "A" }, { id: "x", email: "c@d.co", name: "C" }])).toEqual([]);
    expect(adminTeam({ ADMIN_TEAM: TEAM })[0].id).toBe("omar");
  });

  test("owners read as names: Omar, Adam, Omar & Adam; choices never show emails", () => {
    expect(ownersLabel([], team, "Unassigned")).toBe("Unassigned");
    expect(ownersLabel(["adam"], team, "")).toBe("Adam");
    expect(ownersLabel(["adam", "omar"], team, "")).toBe("Omar & Adam");
    expect(ownerChoices(team)).toEqual([
      { value: "omar", label: "Omar" },
      { value: "adam", label: "Adam" },
      { value: "adam,omar", label: "Omar & Adam" },
    ]);
    expect(JSON.stringify(ownerChoices(team))).not.toContain("@");
  });
});

describe("activity limits", () => {
  const now = Date.UTC(2026, 9, 5, 10);
  test("valid while used; refused after 2 idle hours, after 12 hours, for another session, or if altered", () => {
    const token = activityToken("session-1", SECRET, now);
    expect(checkActivity(token, "session-1", SECRET, now + 60_000)).toEqual({ ok: true, startedAt: now });
    expect(checkActivity(token, "session-1", SECRET, now + (IDLE_SECONDS + 1) * 1000)).toEqual({ ok: false, reason: "idle" });
    const refreshed = activityToken("session-1", SECRET, now + (ABSOLUTE_SECONDS - 60) * 1000, now);
    expect(checkActivity(refreshed, "session-1", SECRET, now + (ABSOLUTE_SECONDS + 1) * 1000)).toEqual({ ok: false, reason: "expired" });
    expect(checkActivity(token, "session-2", SECRET, now)).toEqual({ ok: false, reason: "other_session" });
    expect(checkActivity(token, "session-1", "x".repeat(40), now)).toEqual({ ok: false, reason: "invalid" });
    expect(checkActivity(`${token.split(".")[0]}x.${token.split(".")[1]}`, "session-1", SECRET, now)).toEqual({ ok: false, reason: "invalid" });
    expect(checkActivity(undefined, "session-1", SECRET, now)).toEqual({ ok: false, reason: "missing" });
  });
});

describe("cookies and hosts", () => {
  test("auth cookies are always host-only, HttpOnly, Secure, SameSite=Strict and at most 12 hours", () => {
    expect(enforceCookieOptions({ domain: ".mintapp.tech", httpOnly: false, sameSite: "lax", maxAge: 400 * 86400, path: "/x" })).toEqual({ httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: ABSOLUTE_SECONDS });
    expect(enforceCookieOptions({ maxAge: 0 }).maxAge).toBe(0);
  });

  test("production answers only on ADMIN_HOSTS; a Preview also on its own hostnames; development on localhost", () => {
    const prod = { NODE_ENV: "production", VERCEL_ENV: "production", ADMIN_HOSTS: "admin.example.com", VERCEL_URL: "mintapp-admin-x.vercel.app" };
    expect(adminHosts(prod)).toEqual(["admin.example.com"]);
    expect(isAdminHost("ADMIN.example.com:443", prod)).toBe(true);
    expect(isAdminHost("mintapp-admin-x.vercel.app", prod)).toBe(false);
    expect(isAdminHost("www.mintapp.tech", prod)).toBe(false);
    expect(adminHosts({ NODE_ENV: "production" })).toEqual([]);
    expect(isAdminHost("mintapp-admin-x.vercel.app", { ...prod, VERCEL_ENV: "preview" })).toBe(true);
    expect(isAdminHost("localhost:3200", { NODE_ENV: "development" })).toBe(true);
    expect(isAdminHost("localhost:3200", { NODE_ENV: "production" })).toBe(false);
  });

  test("only admin pages are served by the admin application", () => {
    for (const p of ["/login", "/login/mfa", "/inquiries", "/inquiries/11111111-0000-4000-8000-000000000001"]) expect(isAdminPage(p), p).toBe(true);
    for (const p of ["/", "/en", "/ar/start", "/api/inquiries", "/internal/concept-pack", "/inquiries/x", "/login/../en"]) expect(isAdminPage(p), p).toBe(false);
  });

  test("token claims are read only for session id and assurance level", () => {
    const body = Buffer.from(JSON.stringify({ session_id: "abc", aal: "aal2" })).toString("base64url");
    expect(tokenClaims(`h.${body}.s`)).toEqual({ sessionId: "abc", aal: "aal2" });
    expect(tokenClaims("garbage")).toEqual({ sessionId: null, aal: null });
  });
});

// ---------------------------------------------------------------------------
// Server-side checks in Supabase mode, with Next.js and Supabase replaced.

const jar = new Map<string, string>();
const sqlCall = vi.fn();
const auth = {
  getSession: vi.fn(),
  getUser: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(async () => ({ error: null })),
  mfa: { listFactors: vi.fn(), challengeAndVerify: vi.fn(), enroll: vi.fn(), unenroll: vi.fn() },
};
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => (value ? jar.set(name, value) : jar.delete(name)),
  }),
  headers: async () => new Headers(),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
  notFound: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/sql-gateway", () => ({ getSqlGateway: () => ({ kind: "supabase", call: (...a: unknown[]) => sqlCall(...a) }), isLocalDashboardDemo: () => false }));
vi.mock("./supabase-client", async (original) => ({ ...(await original<typeof import("./supabase-client")>()), createAuthClient: () => ({ auth }) }));

const jwt = (claims: Record<string, unknown>) => `h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.s`;
const user = (email: string, factors: { factor_type: string; status: string }[] = []) => ({ id: "u1", email, email_confirmed_at: "2026-10-01T00:00:00Z", factors });
const signedIn = (email: string, aal: "aal1" | "aal2", factors: { factor_type: string; status: string }[] = []) => {
  auth.getSession.mockResolvedValue({ data: { session: { access_token: jwt({ session_id: "sess-1", aal }) } }, error: null });
  auth.getUser.mockResolvedValue({ data: { user: user(email, factors) }, error: null });
};
const TOTP = [{ factor_type: "totp", status: "verified" }];

describe("admin state (Supabase mode)", () => {
  beforeEach(() => {
    for (const [k, v] of Object.entries(SUPABASE)) vi.stubEnv(k, v);
    jar.clear();
    sqlCall.mockReset();
    for (const fn of [auth.getSession, auth.getUser, auth.signInWithPassword, auth.signOut]) fn.mockReset();
    auth.signOut.mockResolvedValue({ error: null });
  });
  afterEach(() => vi.unstubAllEnvs());

  test("access needs a live session, an allowlisted email, MFA for this session and recent activity", async () => {
    const { adminState } = await import("./state");
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    expect(await adminState()).toEqual({ status: "signed_out" });

    // The auth server no longer accepts the session (signed out elsewhere, revoked).
    auth.getSession.mockResolvedValue({ data: { session: { access_token: jwt({ session_id: "sess-1", aal: "aal2" }) } }, error: null });
    auth.getUser.mockResolvedValue({ data: { user: null }, error: { status: 403, code: "session_not_found" } });
    expect(await adminState()).toEqual({ status: "signed_out" });

    signedIn("someone@example.com", "aal2", TOTP);
    expect(await adminState()).toEqual({ status: "not_allowed" });

    signedIn("omar@mintapp.tech", "aal1");
    expect(await adminState()).toEqual({ status: "mfa_enroll", email: "omar@mintapp.tech" });
    signedIn("omar@mintapp.tech", "aal1", TOTP);
    expect(await adminState()).toEqual({ status: "mfa_challenge", email: "omar@mintapp.tech" });

    signedIn("omar@mintapp.tech", "aal2", TOTP);
    expect(await adminState()).toEqual({ status: "expired" }); // no activity recorded
    jar.set("__Host-mintapp-admin-activity", activityToken("sess-1", SECRET));
    expect(await adminState()).toEqual({ status: "ok", member: { id: "omar", email: "omar@mintapp.tech", name: "Omar" } });

    auth.getUser.mockRejectedValue(new Error("network"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await adminState()).toEqual({ status: "signed_out" });
    spy.mockRestore();
  });

  test("every action that changes data refuses without full sign-in, before touching data", async () => {
    const actions = await import("@/app/(admin)/inquiries/actions");
    const form = new FormData();
    form.set("inquiryId", "11111111-0000-4000-8000-000000000001");
    const names = Object.keys(actions).filter((k) => typeof (actions as Record<string, unknown>)[k] === "function");
    expect(names.length).toBeGreaterThanOrEqual(10);
    const run = (name: string) => (actions as unknown as Record<string, (f: FormData) => Promise<void>>)[name](form);
    const active = () => jar.set("__Host-mintapp-admin-activity", activityToken("sess-1", SECRET));
    // Each case has a valid activity record unless that is what is being tested,
    // so only the condition named is blocking access.
    for (const [setup, target] of [
      [() => (auth.getSession.mockResolvedValue({ data: { session: null }, error: null }), active()), "/login"],
      [() => (signedIn("someone@example.com", "aal2", TOTP), active()), "/login"],
      [() => (signedIn("omar@mintapp.tech", "aal1", TOTP), active()), "/login/mfa"],
      [() => (signedIn("omar@mintapp.tech", "aal2", TOTP), jar.clear()), "/login?expired=1"],
    ] as const) {
      setup();
      for (const name of names) {
        await expect(run(name), name).rejects.toMatchObject({ message: `REDIRECT:${target}` });
        expect(sqlCall, name).not.toHaveBeenCalled();
      }
    }
    // With full sign-in, the same actions do run (so the refusals above are real).
    signedIn("omar@mintapp.tech", "aal2", TOTP);
    active();
    sqlCall.mockResolvedValue(true);
    await run("retryAction");
    expect(sqlCall).toHaveBeenCalled();
  });

  test("sign-in: wrong password and non-allowlisted accounts get the same answer; others continue to MFA", async () => {
    const { loginAction } = await import("@/app/(admin)/login/actions");
    const form = (email: string) => {
      const f = new FormData();
      f.set("email", email);
      f.set("password", "a-long-password-for-tests");
      return f;
    };
    auth.signInWithPassword.mockResolvedValueOnce({ data: {}, error: { status: 400, code: "invalid_credentials" } });
    expect(await loginAction({ error: null }, form("omar@mintapp.tech"))).toEqual({ error: "invalid" });
    auth.signInWithPassword.mockResolvedValueOnce({ data: {}, error: null });
    expect(await loginAction({ error: null }, form("someone@example.com"))).toEqual({ error: "invalid" });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    auth.signInWithPassword.mockResolvedValueOnce({ data: {}, error: { status: 429, code: "over_request_rate_limit" } });
    expect(await loginAction({ error: null }, form("omar@mintapp.tech"))).toEqual({ error: "locked" });
    auth.signInWithPassword.mockResolvedValueOnce({ data: {}, error: null });
    await expect(loginAction({ error: null }, form("omar@mintapp.tech"))).rejects.toThrow("REDIRECT:/login/mfa");
  });

  test("the retired demo settings never accept a sign-in", async () => {
    vi.unstubAllEnvs();
    for (const [k, v] of Object.entries({ ...RETIRED, NODE_ENV: "development" })) vi.stubEnv(k, v);
    const { loginAction } = await import("@/app/(admin)/login/actions");
    const f = new FormData();
    f.set("email", "omar.demo@mintapp.local");
    f.set("password", "anything-at-all-here");
    expect(await loginAction({ error: null }, f)).toEqual({ error: "notConfigured" });
    expect(sqlCall).not.toHaveBeenCalled();
  });
});

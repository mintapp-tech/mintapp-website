import { describe, expect, test, vi } from "vitest";

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }) }));
vi.mock("@/lib/sql-gateway", () => ({ getSqlGateway: () => ({ kind: "supabase", call: async () => false }) }));

const SECRET = "s".repeat(40);

describe("sign-in throttle keys", () => {
  test("are opaque 64-character hashes: no email or address appears in them", async () => {
    const { throttleKeys } = await import("./throttle");
    const keys = throttleKeys(SECRET, "password", "Omar@Example.com", "203.0.113.9");
    for (const [key] of keys) {
      expect(key).toMatch(/^[0-9a-f]{64}$/);
      expect(key).not.toContain("203");
    }
  });

  test("the account key ignores the client, the pair key does not; email case and spacing do not matter", async () => {
    const { throttleKeys } = await import("./throttle");
    const a = throttleKeys(SECRET, "password", "omar@example.com", "1.1.1.1");
    const b = throttleKeys(SECRET, "password", "  OMAR@example.com ", "2.2.2.2");
    expect(a[0][0]).not.toBe(b[0][0]);
    expect(a[1][0]).toBe(b[1][0]);
    expect(a.map((k) => k[1])).toEqual([8, 30]);
  });

  test("the password step and the code step are throttled separately, and the secret salts every key", async () => {
    const { throttleKeys } = await import("./throttle");
    const password = throttleKeys(SECRET, "password", "omar@example.com", "1.1.1.1");
    const code = throttleKeys(SECRET, "code", "omar@example.com", "1.1.1.1");
    const other = throttleKeys("t".repeat(40), "password", "omar@example.com", "1.1.1.1");
    expect(new Set([...password, ...code, ...other].map((k) => k[0])).size).toBe(6);
  });

  test("the client address is the first hop of the proxy header", async () => {
    const { clientAddress } = await import("./throttle");
    expect(await clientAddress()).toBe("203.0.113.9");
  });

  test("a locked key refuses; any unlocked answer lets the attempt proceed", async () => {
    const { isLocked, recordOutcome } = await import("./throttle");
    const sql = (answers: boolean[]) => ({ kind: "supabase" as const, call: vi.fn(async () => answers.shift() as never) });
    expect(await isLocked([["a", 8], ["b", 30]], sql([false, true]))).toBe(true);
    expect(await isLocked([["a", 8], ["b", 30]], sql([false, false]))).toBe(false);
    expect(await recordOutcome([["a", 8], ["b", 30]], false, sql([false, true]))).toBe(true);
  });
});

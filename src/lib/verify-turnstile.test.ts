import { afterEach, describe, expect, test, vi } from "vitest";
import { verifyTurnstileToken } from "./verify-turnstile";

afterEach(() => {
  vi.unstubAllEnvs();
});

function fakeFetch(body: unknown, opts: { delayMs?: number; reject?: boolean } = {}) {
  return vi.fn(async (_url: string, init: RequestInit) => {
    if (opts.reject) throw new TypeError("fetch failed: network_error_simulated");
    if (opts.delayMs) {
      await new Promise((_, reject) => {
        (init.signal as AbortSignal)?.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    }
    return { json: async () => body } as Response;
  });
}

const REAL_SECRET = "a-real-non-dummy-secret-value";
const OFFICIAL_DUMMY_SECRET = "1x0000000000000000000000000000000AA";

const baseOptions = {
  secretKey: REAL_SECRET,
  expectedAction: "start_project",
  allowedHostnames: ["mintapp.tech", "www.mintapp.tech"],
};

describe("verifyTurnstileToken — core success/failure", () => {
  test("success: matching hostname and action passes", async () => {
    const fetchImpl = fakeFetch({ success: true, hostname: "mintapp.tech", action: "start_project" });
    const result = await verifyTurnstileToken("token", { ...baseOptions, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result).toEqual({ ok: true });
  });

  test("cloudflare success:false is rejected as invalid", async () => {
    const fetchImpl = fakeFetch({ success: false, "error-codes": ["invalid-input-response"] });
    const result = await verifyTurnstileToken("token", { ...baseOptions, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  test("already-spent/duplicate secret behavior (timeout-or-duplicate) is rejected", async () => {
    const fetchImpl = fakeFetch({ success: false, "error-codes": ["timeout-or-duplicate"] });
    const result = await verifyTurnstileToken("token", { ...baseOptions, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  test("wrong hostname is rejected even when success:true", async () => {
    const fetchImpl = fakeFetch({ success: true, hostname: "evil.example", action: "start_project" });
    const result = await verifyTurnstileToken("token", { ...baseOptions, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  test("wrong action is rejected even when success:true and hostname matches", async () => {
    const fetchImpl = fakeFetch({ success: true, hostname: "mintapp.tech", action: "some_other_action" });
    const result = await verifyTurnstileToken("token", { ...baseOptions, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  test("network error (fetch rejects) fails closed with reason network_error", async () => {
    const fetchImpl = fakeFetch(null, { reject: true });
    const result = await verifyTurnstileToken("token", { ...baseOptions, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result).toEqual({ ok: false, reason: "network_error" });
  });

  test("timeout (abort before response) fails closed with reason timeout", async () => {
    const fetchImpl = fakeFetch(null, { delayMs: 1 });
    const result = await verifyTurnstileToken("token", {
      ...baseOptions,
      timeoutMs: 20,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toEqual({ ok: false, reason: "timeout" });
  });

  test("unparseable JSON response fails closed with reason network_error", async () => {
    const fetchImpl = vi.fn(async () => ({
      json: async () => {
        throw new SyntaxError("bad json");
      },
    })) as unknown as typeof fetch;
    const result = await verifyTurnstileToken("token", { ...baseOptions, fetchImpl });
    expect(result).toEqual({ ok: false, reason: "network_error" });
  });

  test("never logs the raw token to console", async () => {
    const secretToken = "SECRET_TOKEN_VALUE_MUST_NEVER_APPEAR_IN_LOGS";
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = fakeFetch({ success: false, "error-codes": ["invalid-input-response"] });
    await verifyTurnstileToken(secretToken, { ...baseOptions, fetchImpl: fetchImpl as unknown as typeof fetch });
    const serialized = JSON.stringify(spy.mock.calls);
    expect(serialized.includes(secretToken)).toBe(false);
    spy.mockRestore();
  });
});

describe("verifyTurnstileToken — dummy-key relaxation is scoped to the exact official secret, not just NODE_ENV", () => {
  test("production always rejects a missing action, even for the documented dummy hostname/secret", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const fetchImpl = fakeFetch({ success: true, hostname: "example.com" });
    const result = await verifyTurnstileToken("token", {
      ...baseOptions,
      secretKey: OFFICIAL_DUMMY_SECRET,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  test("production always rejects hostname example.com, even for the documented dummy secret", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const fetchImpl = fakeFetch({ success: true, hostname: "example.com", action: "start_project" });
    const result = await verifyTurnstileToken("token", {
      ...baseOptions,
      secretKey: OFFICIAL_DUMMY_SECRET,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  test("non-production with the official dummy secret: hostname example.com and missing action are tolerated", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const fetchImpl = fakeFetch({ success: true, hostname: "example.com" });
    const result = await verifyTurnstileToken("token", {
      ...baseOptions,
      secretKey: OFFICIAL_DUMMY_SECRET,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toEqual({ ok: true });
  });

  test("non-production with a REAL (non-dummy) secret does NOT get the relaxed hostname behavior", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const fetchImpl = fakeFetch({ success: true, hostname: "example.com", action: "start_project" });
    const result = await verifyTurnstileToken("token", {
      ...baseOptions,
      secretKey: REAL_SECRET,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  test("non-production with a REAL (non-dummy) secret does NOT get the relaxed missing-action behavior", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const fetchImpl = fakeFetch({ success: true, hostname: "mintapp.tech" });
    const result = await verifyTurnstileToken("token", {
      ...baseOptions,
      secretKey: REAL_SECRET,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  test("non-production with a real secret still enforces the exact hostname/action match otherwise", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const fetchImpl = fakeFetch({ success: true, hostname: "mintapp.tech", action: "start_project" });
    const result = await verifyTurnstileToken("token", {
      ...baseOptions,
      secretKey: REAL_SECRET,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toEqual({ ok: true });
  });
});

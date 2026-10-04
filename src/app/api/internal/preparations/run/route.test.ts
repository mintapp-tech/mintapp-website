import { afterEach, beforeEach, expect, test, vi } from "vitest";

const runConfiguredPreparation = vi.fn();
vi.mock("@/lib/preparation/run", () => ({ runConfiguredPreparation: (...args: unknown[]) => runConfiguredPreparation(...args) }));

const { POST } = await import("./route");
const SECRET = "s".repeat(40);
const call = (auth?: string) =>
  POST(new Request("http://localhost/api/internal/preparations/run", { method: "POST", headers: auth ? { authorization: auth } : {} }) as unknown as Parameters<typeof POST>[0]);

beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.unstubAllEnvs());

test("disabled without a strong secret", async () => {
  vi.stubEnv("PREPARATION_WORKER_SECRET", "");
  expect((await call(`Bearer ${SECRET}`)).status).toBe(503);
  vi.stubEnv("PREPARATION_WORKER_SECRET", "short");
  expect((await call("Bearer short")).status).toBe(503);
  expect(runConfiguredPreparation).not.toHaveBeenCalled();
});

test("rejects a missing or wrong bearer token", async () => {
  vi.stubEnv("PREPARATION_WORKER_SECRET", SECRET);
  for (const auth of [undefined, SECRET, `Bearer ${SECRET}x`, `Basic ${SECRET}`]) expect((await call(auth)).status).toBe(401);
  expect(runConfiguredPreparation).not.toHaveBeenCalled();
});

test("runs one pass and returns counts only", async () => {
  vi.stubEnv("PREPARATION_WORKER_SECRET", SECRET);
  runConfiguredPreparation.mockResolvedValue({ ran: false, reason: "off" });
  const res = await call(`Bearer ${SECRET}`);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, ran: false, reason: "off" });
});

test("a store failure is a 502 with no detail", async () => {
  vi.stubEnv("PREPARATION_WORKER_SECRET", SECRET);
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  runConfiguredPreparation.mockRejectedValue(new Error("connection string with secrets"));
  const res = await call(`Bearer ${SECRET}`);
  expect(res.status).toBe(502);
  expect(await res.text()).not.toContain("secrets");
  expect(spy.mock.calls.flat().join(" ")).toBe("preparation_run_failed");
  spy.mockRestore();
});

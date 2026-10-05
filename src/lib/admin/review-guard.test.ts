import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// The review guard: an admin Preview only ever talks to the synthetic review
// database. The database is replaced by a test double.

const call = vi.fn();
vi.mock("@/lib/sql-gateway", () => ({ getSqlGateway: () => ({ kind: "supabase", call: (...a: unknown[]) => call(...a) }) }));

const PREVIEW = { APP_SURFACE: "admin", VERCEL_ENV: "preview" };

describe("synthetic review guard", () => {
  beforeEach(async () => {
    call.mockReset();
    (await import("./review-guard")).resetReviewGuard();
  });
  afterEach(() => vi.unstubAllEnvs());

  test("applies only to Previews of the admin application", async () => {
    const { reviewGuardApplies } = await import("./review-guard");
    expect(reviewGuardApplies(PREVIEW)).toBe(true);
    expect(reviewGuardApplies({ APP_SURFACE: "admin", VERCEL_ENV: "production" })).toBe(false);
    expect(reviewGuardApplies({ VERCEL_ENV: "preview" })).toBe(false); // the public site's Previews
    expect(reviewGuardApplies({ APP_SURFACE: "admin" })).toBe(false); // local
  });

  test("a Preview connected to any other database (no marker) reads and writes nothing", async () => {
    for (const [k, v] of Object.entries(PREVIEW)) vi.stubEnv(k, v);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const data = await import("@/lib/dashboard/data");
    call.mockRejectedValue(new Error("sql_review_environment_failed")); // function does not exist
    await expect(data.listInquiries()).rejects.toThrow("review_database_not_verified");
    await expect(data.setOwners("11111111-0000-4000-8000-000000000001", ["omar"])).rejects.toThrow("review_database_not_verified");
    expect(call.mock.calls.map((c) => c[0])).toEqual(["review_environment", "review_environment"]);
    call.mockReset();
    call.mockResolvedValue("something-else");
    await expect(data.getInquiry("11111111-0000-4000-8000-000000000001")).rejects.toThrow("review_database_not_verified");
    expect(call.mock.calls.map((c) => c[0])).toEqual(["review_environment"]);
    spy.mockRestore();
  });

  test("with the synthetic review marker, dashboard calls go through (checked once)", async () => {
    for (const [k, v] of Object.entries(PREVIEW)) vi.stubEnv(k, v);
    const data = await import("@/lib/dashboard/data");
    call.mockImplementation(async (fn: string) => (fn === "review_environment" ? "synthetic-review" : []));
    expect(await data.listInquiries()).toEqual([]);
    expect(await data.listInquiries()).toEqual([]);
    expect(call.mock.calls.map((c) => c[0])).toEqual(["review_environment", "dashboard_inquiries", "dashboard_inquiries"]);
  });

  test("production and local use do not depend on the marker", async () => {
    vi.stubEnv("APP_SURFACE", "admin");
    vi.stubEnv("VERCEL_ENV", "production");
    const data = await import("@/lib/dashboard/data");
    call.mockResolvedValue([]);
    await data.listInquiries();
    expect(call.mock.calls.map((c) => c[0])).toEqual(["dashboard_inquiries"]);
  });
});

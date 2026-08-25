import { describe, expect, test, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyBookingCreated, applyBookingCancelled, applyBookingRescheduled } from "./apply-cal-booking-event";

function fakeSupabase(rpcImpl: (fn: string, args: unknown) => Promise<{ data: unknown; error: { code?: string } | null }>) {
  const calls: { fn: string; args: unknown }[] = [];
  const client = {
    rpc: async (fn: string, args: unknown) => {
      calls.push({ fn, args });
      return rpcImpl(fn, args);
    },
  } as unknown as SupabaseClient;
  return { calls, client };
}

describe("applyBookingCreated", () => {
  test("row matched -> applied", async () => {
    const { calls, client } = fakeSupabase(async () => ({ data: "some-row-id", error: null }));
    const result = await applyBookingCreated(client, { inquiryId: "id-1", uid: "uid-1", startTime: "t", timezone: "UTC", eventAt: "e" });
    expect(result).toBe("applied");
    expect(calls[0].fn).toBe("apply_booking_created");
    expect(calls[0].args).toEqual({
      p_inquiry_id: "id-1",
      p_uid: "uid-1",
      p_start_time: "t",
      p_timezone: "UTC",
      p_event_at: "e",
    });
  });

  test("no row matched (null) -> no_match", async () => {
    const { client } = fakeSupabase(async () => ({ data: null, error: null }));
    const result = await applyBookingCreated(client, { inquiryId: "id-1", uid: "uid-1", startTime: "t", timezone: null, eventAt: "e" });
    expect(result).toBe("no_match");
  });

  test("unique-violation error (23505) -> conflict, sanitized log only", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeSupabase(async () => ({ data: null, error: { code: "23505" } }));
    const result = await applyBookingCreated(client, { inquiryId: "id-1", uid: "uid-1", startTime: "t", timezone: null, eventAt: "e" });
    expect(result).toBe("conflict");
    const logged = spy.mock.calls.flat().join(" ");
    expect(logged).not.toContain("id-1");
    expect(logged).not.toContain("uid-1");
    spy.mockRestore();
  });

  test("other database error -> internal_error", async () => {
    const { client } = fakeSupabase(async () => ({ data: null, error: { code: "08006" } }));
    const result = await applyBookingCreated(client, { inquiryId: "id-1", uid: "uid-1", startTime: "t", timezone: null, eventAt: "e" });
    expect(result).toBe("internal_error");
  });

  test("rpc() itself rejects/throws (network failure) -> internal_error, no message logged", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = {
      rpc: async () => {
        throw new Error("ECONNRESET: some very specific network detail with secret-looking-uid-1 in it");
      },
    } as unknown as SupabaseClient;
    const result = await applyBookingCreated(client, { inquiryId: "id-1", uid: "uid-1", startTime: "t", timezone: null, eventAt: "e" });
    expect(result).toBe("internal_error");
    const logged = spy.mock.calls.flat().join(" ");
    expect(logged).not.toContain("ECONNRESET");
    expect(logged).not.toContain("secret-looking-uid-1");
    spy.mockRestore();
  });
});

describe("applyBookingCancelled", () => {
  test("passes null inquiryId through for the fallback-correlation path", async () => {
    const { calls, client } = fakeSupabase(async () => ({ data: "row-id", error: null }));
    const result = await applyBookingCancelled(client, { inquiryId: null, uid: "uid-1", startTime: "t", timezone: null, eventAt: "e" });
    expect(result).toBe("applied");
    expect((calls[0].args as { p_inquiry_id: unknown }).p_inquiry_id).toBeNull();
  });

  test("unique-violation -> conflict", async () => {
    const { client } = fakeSupabase(async () => ({ data: null, error: { code: "23505" } }));
    const result = await applyBookingCancelled(client, { inquiryId: "id-1", uid: "uid-1", startTime: "t", timezone: null, eventAt: "e" });
    expect(result).toBe("conflict");
  });
});

describe("applyBookingRescheduled", () => {
  test("sends both rescheduleUid and newUid correctly named", async () => {
    const { calls, client } = fakeSupabase(async () => ({ data: "row-id", error: null }));
    const result = await applyBookingRescheduled(client, {
      inquiryId: "id-1",
      rescheduleUid: "old-uid",
      newUid: "new-uid",
      startTime: "t",
      timezone: "UTC",
      eventAt: "e",
    });
    expect(result).toBe("applied");
    expect(calls[0].args).toEqual({
      p_inquiry_id: "id-1",
      p_reschedule_uid: "old-uid",
      p_new_uid: "new-uid",
      p_start_time: "t",
      p_timezone: "UTC",
      p_event_at: "e",
    });
  });

  test("no match -> no_match", async () => {
    const { client } = fakeSupabase(async () => ({ data: null, error: null }));
    const result = await applyBookingRescheduled(client, {
      inquiryId: null,
      rescheduleUid: "old-uid",
      newUid: "new-uid",
      startTime: "t",
      timezone: null,
      eventAt: "e",
    });
    expect(result).toBe("no_match");
  });
});

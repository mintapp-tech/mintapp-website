import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Thin callers around the three apply_booking_* RPC functions (see the
// migration) — application code never issues a raw UPDATE against the
// booking columns itself. Every branch here is deliberately generic about
// *why* nothing happened: "applied" vs "no_match" is the only distinction
// callers get, so a caller can never be used to probe which specific
// guard blocked a write.
export type ApplyResult = "applied" | "no_match" | "conflict" | "internal_error";

function classifyError(error: { code?: string } | null): "conflict" | "internal_error" {
  return error?.code === "23505" ? "conflict" : "internal_error";
}

// Wraps the rpc() call itself in try/catch — a rejected promise (network
// failure, a thrown exception inside the client) is a different failure
// mode than the client's own returned { error } shape, and both must be
// caught here so nothing escapes to the caller uncaught. Never logs the
// caught exception's message/stack, only a fixed category.
async function callRpc(
  supabase: SupabaseClient,
  fn: string,
  args: Record<string, unknown>,
): Promise<{ data: unknown; error: { code?: string } | null } | { threw: true }> {
  try {
    return await supabase.rpc(fn, args);
  } catch {
    return { threw: true };
  }
}

export async function applyBookingCreated(
  supabase: SupabaseClient,
  args: { inquiryId: string; uid: string; startTime: string; timezone: string | null; eventAt: string },
): Promise<ApplyResult> {
  const result = await callRpc(supabase, "apply_booking_created", {
    p_inquiry_id: args.inquiryId,
    p_uid: args.uid,
    p_start_time: args.startTime,
    p_timezone: args.timezone,
    p_event_at: args.eventAt,
  });
  if ("threw" in result) {
    console.error("cal_webhook_rpc_internal_error: apply_booking_created");
    return "internal_error";
  }
  if (result.error) {
    const category = classifyError(result.error);
    console.error(`cal_webhook_rpc_${category}: apply_booking_created`);
    return category;
  }
  return result.data ? "applied" : "no_match";
}

export async function applyBookingCancelled(
  supabase: SupabaseClient,
  args: { inquiryId: string | null; uid: string; startTime: string; timezone: string | null; eventAt: string },
): Promise<ApplyResult> {
  const result = await callRpc(supabase, "apply_booking_cancelled", {
    p_inquiry_id: args.inquiryId,
    p_uid: args.uid,
    p_start_time: args.startTime,
    p_timezone: args.timezone,
    p_event_at: args.eventAt,
  });
  if ("threw" in result) {
    console.error("cal_webhook_rpc_internal_error: apply_booking_cancelled");
    return "internal_error";
  }
  if (result.error) {
    const category = classifyError(result.error);
    console.error(`cal_webhook_rpc_${category}: apply_booking_cancelled`);
    return category;
  }
  return result.data ? "applied" : "no_match";
}

export async function applyBookingRescheduled(
  supabase: SupabaseClient,
  args: {
    inquiryId: string | null;
    rescheduleUid: string;
    newUid: string;
    startTime: string;
    timezone: string | null;
    eventAt: string;
  },
): Promise<ApplyResult> {
  const result = await callRpc(supabase, "apply_booking_rescheduled", {
    p_inquiry_id: args.inquiryId,
    p_reschedule_uid: args.rescheduleUid,
    p_new_uid: args.newUid,
    p_start_time: args.startTime,
    p_timezone: args.timezone,
    p_event_at: args.eventAt,
  });
  if ("threw" in result) {
    console.error("cal_webhook_rpc_internal_error: apply_booking_rescheduled");
    return "internal_error";
  }
  if (result.error) {
    const category = classifyError(result.error);
    console.error(`cal_webhook_rpc_${category}: apply_booking_rescheduled`);
    return category;
  }
  return result.data ? "applied" : "no_match";
}

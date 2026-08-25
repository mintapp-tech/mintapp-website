import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getCalEventTypeId, getCalEventTypeSlug, getCalWebhookSecret } from "@/lib/cal-config";
import { verifyBookingContext } from "@/lib/cal-booking-context";
import {
  HANDLED_TRIGGER_EVENTS,
  envelopeMinimalSchema,
  routingPayloadSchema,
  bookingCreatedPayloadSchema,
  bookingCancelledPayloadSchema,
  bookingRescheduledPayloadSchema,
  resolveAttendeeTimezone,
} from "@/lib/cal-webhook-schema";
import { applyBookingCreated, applyBookingCancelled, applyBookingRescheduled, type ApplyResult } from "@/lib/apply-cal-booking-event";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The 2021-10-20 payload (no ICS content) comfortably fits well under
// this; generous headroom for responses/attendee structures/application
// status without approaching anywhere near a real abuse-sized body.
const MAX_BODY_BYTES = 64 * 1024;
const HEX64 = /^[0-9a-fA-F]{64}$/;

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function jsonResponse(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

// Every deterministic rejection below — oversized body, invalid UTF-8,
// malformed JSON/schema, routing mismatch, invalid context, ordering/UID
// guard blocked, unique conflict — shares this identical response. Only
// signature failure (401) and a genuine transient fault (502) differ, and
// only because retrying could plausibly change their outcome; nothing here
// ever signals which specific check failed.
function noop() {
  return jsonResponse({ ok: true }, 200);
}

function unauthorized() {
  // Deliberately no application-level log line for this path: Cal.com's
  // own retry backoff is not rate limiting, and an attacker sending junk
  // signatures isn't constrained by it either. Without shared rate-limit
  // infrastructure (out of scope for this milestone), logging one line per
  // bad signature is a real, unbounded flood vector. Vercel's own
  // request/status metrics (401 counts) remain the way to notice this.
  return jsonResponse({ ok: false }, 401);
}

function internalError() {
  return jsonResponse({ ok: false }, 502);
}

type RawReadResult = { ok: true; bytes: Uint8Array } | { ok: false };

// Bytes only — never decoded to a string here. Decoding before signature
// verification would mean authenticating a re-encoded representation of
// the body rather than the exact bytes Cal.com sent and signed; even a
// valid-UTF-8 round-trip is not guaranteed byte-identical in every edge
// case (e.g. a leading BOM), so the HMAC must run directly over this
// Uint8Array.
async function readRawBodyWithLimit(request: NextRequest): Promise<RawReadResult> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && Number(declaredLength) > MAX_BODY_BYTES) {
    return { ok: false };
  }

  const reader = request.body?.getReader();
  if (!reader) return { ok: false };

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      // Deliberately not logging the (oversized, truncated) body itself.
      // Treated as a deterministic no-op, not a distinct error code: a
      // real Cal.com payload never approaches this size, and there is no
      // complete signed byte sequence to authenticate here anyway (reading
      // stopped early), so there is nothing to verify a signature against.
      return { ok: false };
    }
    chunks.push(value);
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes: combined };
}

// Exact 64 lowercase-or-uppercase hex characters only, checked BEFORE any
// buffer conversion — Node's hex decoder is permissive (it can silently
// stop at the first invalid character rather than throwing), so a header
// like "<64 correct hex chars><garbage>" could otherwise decode to the
// same 32 bytes as a genuine digest. Rejecting the shape up front removes
// that ambiguity entirely rather than relying on decoder behavior.
function verifySignature(bytes: Uint8Array, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader || !HEX64.test(signatureHeader)) return false;
  const expectedHex = createHmac("sha256", secret).update(bytes).digest("hex");
  const expected = Buffer.from(expectedHex, "hex");
  const actual = Buffer.from(signatureHeader, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function POST(request: NextRequest) {
  // 1: raw-body size enforcement — bytes only, no decoding yet.
  const read = await readRawBodyWithLimit(request);
  if (!read.ok) return noop();

  // 2: signature verification, directly over the accumulated bytes,
  // before any decoding or parsing.
  let webhookSecret: string;
  try {
    webhookSecret = getCalWebhookSecret();
  } catch {
    return internalError();
  }
  const signatureHeader = request.headers.get("x-cal-signature-256");
  if (!verifySignature(read.bytes, signatureHeader, webhookSecret)) {
    return unauthorized();
  }

  // 3: only now — after signature success — decode with fatal UTF-8
  // handling. Invalid UTF-8 even with a valid signature is a deterministic
  // no-op, not an error: retrying the identical bytes changes nothing.
  let raw: string;
  try {
    raw = new TextDecoder("utf-8", { fatal: true }).decode(read.bytes);
  } catch {
    return noop();
  }

  // 4: parse JSON.
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return noop();
  }

  // 5: minimal envelope.
  const envelope = envelopeMinimalSchema.safeParse(parsedJson);
  if (!envelope.success) return noop();

  // 6: unknown/unsubscribed event -> no-op before any routing/event schema
  // is even attempted.
  const triggerEvent = envelope.data.triggerEvent;
  if (!(HANDLED_TRIGGER_EVENTS as readonly string[]).includes(triggerEvent)) {
    return noop();
  }

  // 7: minimal routing schema — only eventTypeId/type, nothing else. A
  // malformed non-routing field (bad startTime, bad uid, whatever) must
  // never prevent this check from running and rejecting first.
  const routing = routingPayloadSchema.safeParse(envelope.data.payload);
  if (!routing.success) return noop();

  let eventTypeId: number;
  let slug: string;
  try {
    eventTypeId = getCalEventTypeId();
    slug = getCalEventTypeSlug();
  } catch {
    return internalError();
  }

  // 8: event-type/slug comparison — no Supabase client, no full schema,
  // no context verification before this passes.
  if (routing.data.eventTypeId !== eventTypeId || routing.data.type !== slug) {
    return noop();
  }

  const eventAt = envelope.data.createdAt;

  if (triggerEvent === "BOOKING_CREATED") {
    // 9: full event-specific schema, only now.
    const parsed = bookingCreatedPayloadSchema.safeParse(envelope.data.payload);
    if (!parsed.success) return noop();
    const payload = parsed.data;

    // 10: context verification. Mandatory for BOOKING_CREATED, no fallback.
    const contextToken = payload.metadata?.bookingContext;
    if (!contextToken) return noop();
    let context: ReturnType<typeof verifyBookingContext>;
    try {
      context = verifyBookingContext(contextToken);
    } catch {
      return internalError();
    }
    if (!context.ok) return noop();

    const tz = resolveAttendeeTimezone(payload.attendees?.[0]);
    if (tz.status === "conflict") return noop();

    // 11: the one applicable atomic update. Supabase is touched only now.
    const result = await runApply(() =>
      applyBookingCreated(getSupabaseServerClient(), {
        inquiryId: context.inquiryId,
        uid: payload.uid,
        startTime: payload.startTime,
        timezone: tz.timezone,
        eventAt,
      }),
    );
    return resultResponse(result);
  }

  if (triggerEvent === "BOOKING_CANCELLED") {
    const parsed = bookingCancelledPayloadSchema.safeParse(envelope.data.payload);
    if (!parsed.success) return noop();
    const payload = parsed.data;

    const contextToken = payload.metadata?.bookingContext;
    let context: ReturnType<typeof verifyBookingContext> | { ok: false };
    try {
      context = contextToken ? verifyBookingContext(contextToken) : { ok: false };
    } catch {
      return internalError();
    }

    const tz = resolveAttendeeTimezone(payload.attendees?.[0]);
    if (tz.status === "conflict") return noop();

    const result = await runApply(() =>
      applyBookingCancelled(getSupabaseServerClient(), {
        inquiryId: context.ok ? context.inquiryId : null,
        uid: payload.uid,
        startTime: payload.startTime,
        timezone: tz.timezone,
        eventAt,
      }),
    );
    return resultResponse(result);
  }

  // BOOKING_RESCHEDULED
  const parsed = bookingRescheduledPayloadSchema.safeParse(envelope.data.payload);
  if (!parsed.success) return noop();
  const payload = parsed.data;

  const contextToken = payload.metadata?.bookingContext;
  let context: ReturnType<typeof verifyBookingContext> | { ok: false };
  try {
    context = contextToken ? verifyBookingContext(contextToken) : { ok: false };
  } catch {
    return internalError();
  }

  const tz = resolveAttendeeTimezone(payload.attendees?.[0]);
  if (tz.status === "conflict") return noop();

  const result = await runApply(() =>
    applyBookingRescheduled(getSupabaseServerClient(), {
      inquiryId: context.ok ? context.inquiryId : null,
      rescheduleUid: payload.rescheduleUid,
      newUid: payload.uid,
      startTime: payload.startTime,
      timezone: tz.timezone,
      eventAt,
    }),
  );
  return resultResponse(result);
}

// A single controlled boundary around every path that can throw:
// getSupabaseServerClient() (missing/invalid config) and the rpc() call
// itself (network failure, a rejected promise apply-cal-booking-event.ts's
// own try/catch doesn't cover). Nothing from a caught exception is ever
// logged beyond a fixed category — no message, no stack, no config name.
async function runApply(fn: () => Promise<ApplyResult>): Promise<ApplyResult> {
  try {
    return await fn();
  } catch {
    console.error("cal_webhook_apply_threw");
    return "internal_error";
  }
}

function resultResponse(result: ApplyResult) {
  return result === "internal_error" ? internalError() : noop();
}

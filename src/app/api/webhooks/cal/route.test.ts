import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createHmac } from "node:crypto";
import { signBookingContext } from "@/lib/cal-booking-context";

const WEBHOOK_SECRET = "test-webhook-secret-not-real";
const CONTEXT_SECRET = "test-context-secret-not-real";
const EVENT_TYPE_ID = 6790027;
const SLUG = "mintapp-discovery-call";
const INQUIRY_ID = "e8e7d808-9556-45b8-beae-49f852e98be9";

const getCalEventTypeId = vi.fn(() => EVENT_TYPE_ID);
const getCalEventTypeSlug = vi.fn(() => SLUG);
const getCalWebhookSecret = vi.fn(() => WEBHOOK_SECRET);
vi.mock("@/lib/cal-config", () => ({
  getCalEventTypeId: () => getCalEventTypeId(),
  getCalEventTypeSlug: () => getCalEventTypeSlug(),
  getCalWebhookSecret: () => getCalWebhookSecret(),
}));

const getSupabaseServerClient = vi.fn();
vi.mock("@/lib/supabase-server", () => ({ getSupabaseServerClient: (...args: unknown[]) => getSupabaseServerClient(...args) }));

const applyBookingCreated = vi.fn();
const applyBookingCancelled = vi.fn();
const applyBookingRescheduled = vi.fn();
vi.mock("@/lib/apply-cal-booking-event", () => ({
  applyBookingCreated: (...args: unknown[]) => applyBookingCreated(...args),
  applyBookingCancelled: (...args: unknown[]) => applyBookingCancelled(...args),
  applyBookingRescheduled: (...args: unknown[]) => applyBookingRescheduled(...args),
}));

const { POST } = await import("./route");

function signBytes(bytes: Uint8Array | string, secret: string): string {
  return createHmac("sha256", secret).update(bytes as never).digest("hex");
}

function makeRequest(body: unknown, opts: { secret?: string; signatureOverride?: string; rawOverride?: string; contentLength?: string } = {}) {
  const raw = opts.rawOverride ?? JSON.stringify(body);
  const signature = opts.signatureOverride ?? signBytes(raw, opts.secret ?? WEBHOOK_SECRET);
  const headers: Record<string, string> = { "x-cal-signature-256": signature };
  if (opts.contentLength !== undefined) headers["content-length"] = opts.contentLength;
  return new Request("http://localhost/api/webhooks/cal", {
    method: "POST",
    headers,
    body: raw,
  }) as unknown as Parameters<typeof POST>[0];
}

function makeRawRequest(bytes: Uint8Array, signatureHeader: string | undefined) {
  const headers: Record<string, string> = {};
  if (signatureHeader !== undefined) headers["x-cal-signature-256"] = signatureHeader;
  return new Request("http://localhost/api/webhooks/cal", {
    method: "POST",
    headers,
    body: bytes as unknown as BodyInit,
  }) as unknown as Parameters<typeof POST>[0];
}

function validContext() {
  process.env.CAL_BOOKING_CONTEXT_SECRET = CONTEXT_SECRET;
  return signBookingContext(INQUIRY_ID);
}

const baseCreatedPayload = () => ({
  triggerEvent: "BOOKING_CREATED",
  createdAt: "2026-08-24T10:00:00.000Z",
  payload: {
    eventTypeId: EVENT_TYPE_ID,
    type: SLUG,
    uid: "cal-uid-1",
    startTime: "2026-08-25T11:00:00Z",
    attendees: [{ timeZone: "Africa/Cairo" }],
  },
});

beforeEach(() => {
  vi.resetAllMocks();
  process.env.CAL_BOOKING_CONTEXT_SECRET = CONTEXT_SECRET;
  getSupabaseServerClient.mockReturnValue({ fake: "client" });
  // resetAllMocks() clears implementations set at vi.fn(impl) construction
  // time too — re-establish the defaults each test relies on unless it
  // explicitly overrides one (e.g. the error-boundary tests below).
  getCalEventTypeId.mockReturnValue(EVENT_TYPE_ID);
  getCalEventTypeSlug.mockReturnValue(SLUG);
  getCalWebhookSecret.mockReturnValue(WEBHOOK_SECRET);
});

afterEach(() => {
  delete process.env.CAL_BOOKING_CONTEXT_SECRET;
});

describe("signature: missing/wrong/tampered", () => {
  test("missing signature header -> 401, zero downstream calls, zero config/apply calls", async () => {
    const raw = JSON.stringify(baseCreatedPayload());
    const req = new Request("http://localhost/api/webhooks/cal", { method: "POST", body: raw }) as unknown as Parameters<typeof POST>[0];
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(applyBookingCreated).not.toHaveBeenCalled();
    expect(getSupabaseServerClient).not.toHaveBeenCalled();
  });

  test("wrong (but correctly-shaped) signature -> 401", async () => {
    const res = await POST(makeRequest(baseCreatedPayload(), { secret: "wrong-secret" }));
    expect(res.status).toBe(401);
    expect(applyBookingCreated).not.toHaveBeenCalled();
  });

  test("valid signature over a since-tampered body invalidates it", async () => {
    const body = baseCreatedPayload();
    const raw = JSON.stringify(body);
    const validSignature = signBytes(raw, WEBHOOK_SECRET);
    const tamperedRaw = JSON.stringify({ ...body, payload: { ...body.payload, uid: "different-uid" } });
    const res = await POST(makeRequest(body, { rawOverride: tamperedRaw, signatureOverride: validSignature }));
    expect(res.status).toBe(401);
  });
});

describe("signature: exact format enforcement (only 64 hex chars, either case, may pass)", () => {
  const raw = JSON.stringify(baseCreatedPayload());
  const correctDigest = signBytes(raw, WEBHOOK_SECRET);

  test("64 lowercase hex characters (the real digest) passes", async () => {
    expect(correctDigest).toMatch(/^[0-9a-f]{64}$/);
    const res = await POST(makeRequest(baseCreatedPayload(), { rawOverride: raw, signatureOverride: correctDigest }));
    // Passes signature; falls through to 200 no-op since no context is set here.
    expect(res.status).toBe(200);
  });

  test("64 uppercase hex characters (same digest, uppercased) passes", async () => {
    const res = await POST(makeRequest(baseCreatedPayload(), { rawOverride: raw, signatureOverride: correctDigest.toUpperCase() }));
    expect(res.status).toBe(200);
  });

  test("too short (63 chars) is rejected -> 401", async () => {
    const res = await POST(makeRequest(baseCreatedPayload(), { rawOverride: raw, signatureOverride: correctDigest.slice(0, 63) }));
    expect(res.status).toBe(401);
  });

  test("too long (65 chars) is rejected -> 401", async () => {
    const res = await POST(makeRequest(baseCreatedPayload(), { rawOverride: raw, signatureOverride: correctDigest + "0" }));
    expect(res.status).toBe(401);
  });

  test("odd length is rejected -> 401", async () => {
    const res = await POST(makeRequest(baseCreatedPayload(), { rawOverride: raw, signatureOverride: correctDigest.slice(0, 61) }));
    expect(res.status).toBe(401);
  });

  test("correct digest plus a non-hex suffix is rejected outright -> 401 (the exact regression this format check prevents)", async () => {
    const res = await POST(makeRequest(baseCreatedPayload(), { rawOverride: raw, signatureOverride: correctDigest + "zz" }));
    expect(res.status).toBe(401);
  });

  test("non-hex prefix is rejected -> 401", async () => {
    const res = await POST(makeRequest(baseCreatedPayload(), { rawOverride: raw, signatureOverride: "zz" + correctDigest.slice(2) }));
    expect(res.status).toBe(401);
  });

  test("whitespace anywhere in the header is rejected -> 401", async () => {
    const res = await POST(makeRequest(baseCreatedPayload(), { rawOverride: raw, signatureOverride: " " + correctDigest.slice(1) }));
    expect(res.status).toBe(401);
  });

  test("empty header value is rejected -> 401", async () => {
    const res = await POST(makeRequest(baseCreatedPayload(), { rawOverride: raw, signatureOverride: "" }));
    expect(res.status).toBe(401);
  });
});

describe("raw-byte integrity: HMAC verifies exact bytes, not a decoded/re-encoded string", () => {
  test("a UTF-8 BOM changes the signed bytes — signing without it does not verify a body that has it", async () => {
    const bodyObj = baseCreatedPayload();
    const rawWithoutBom = JSON.stringify(bodyObj);
    const rawWithBom = "﻿" + rawWithoutBom;
    const signatureOverBomlessVersion = signBytes(rawWithoutBom, WEBHOOK_SECRET);
    const res = await POST(makeRequest(bodyObj, { rawOverride: rawWithBom, signatureOverride: signatureOverBomlessVersion }));
    expect(res.status).toBe(401);
  });

  test("signing over the exact bytes actually sent (including a BOM) verifies successfully", async () => {
    const bodyObj = baseCreatedPayload();
    const rawWithBom = "﻿" + JSON.stringify(bodyObj);
    const signatureOverBomVersion = signBytes(rawWithBom, WEBHOOK_SECRET);
    const res = await POST(makeRequest(bodyObj, { rawOverride: rawWithBom, signatureOverride: signatureOverBomVersion }));
    // Signature passes (proves HMAC ran over the exact bytes sent); then
    // decoding+JSON.parse fails because of the leading BOM character
    // breaking JSON syntax -> deterministic 200 no-op, not a crash.
    expect(res.status).toBe(200);
  });

  test("invalid UTF-8 bytes with a VALID signature over those exact bytes -> reaches decoding, sanitized 200 no-op", async () => {
    // 0x80 is a lone continuation byte — never valid at the start of a
    // UTF-8 sequence.
    const invalidUtf8 = new Uint8Array([0x7b, 0x22, 0x80, 0x81, 0x22, 0x7d]);
    const signature = signBytes(invalidUtf8, WEBHOOK_SECRET);
    const res = await POST(makeRawRequest(invalidUtf8, signature));
    expect(res.status).toBe(200);
    expect(applyBookingCreated).not.toHaveBeenCalled();
  });

  test("invalid UTF-8 bytes with an INVALID signature -> 401 before decoding is ever attempted", async () => {
    const invalidUtf8 = new Uint8Array([0x7b, 0x22, 0x80, 0x81, 0x22, 0x7d]);
    const wrongSignature = signBytes(invalidUtf8, "wrong-secret");
    const res = await POST(makeRawRequest(invalidUtf8, wrongSignature));
    expect(res.status).toBe(401);
  });
});

describe("body size limit — oversized is a deterministic no-op (200), not a distinct error code", () => {
  test("declared content-length over 64KB -> 200 no-op", async () => {
    const res = await POST(makeRequest(baseCreatedPayload(), { contentLength: String(65 * 1024) }));
    expect(res.status).toBe(200);
    expect(applyBookingCreated).not.toHaveBeenCalled();
  });
});

describe("malformed / unknown events", () => {
  test("malformed JSON (valid signature) -> 200 no-op", async () => {
    const raw = "{not valid json";
    const res = await POST(makeRequest(null, { rawOverride: raw, signatureOverride: signBytes(raw, WEBHOOK_SECRET) }));
    expect(res.status).toBe(200);
    expect(applyBookingCreated).not.toHaveBeenCalled();
  });

  test("unknown/unsubscribed triggerEvent -> 200 no-op, zero downstream calls", async () => {
    const res = await POST(
      makeRequest({ triggerEvent: "MEETING_STARTED", createdAt: "2026-08-24T10:00:00.000Z", payload: {} }),
    );
    expect(res.status).toBe(200);
    expect(getSupabaseServerClient).not.toHaveBeenCalled();
  });

  test("invalid createdAt (envelope-level timestamp) -> 200 no-op, zero downstream calls", async () => {
    const res = await POST(makeRequest({ triggerEvent: "BOOKING_CREATED", createdAt: "not-a-date", payload: {} }));
    expect(res.status).toBe(200);
    expect(getSupabaseServerClient).not.toHaveBeenCalled();
  });
});

describe("staged routing tier — event-type/slug rejection happens before the full schema is even consulted", () => {
  test("wrong eventTypeId with an otherwise-garbage payload (bad startTime, wrong-typed uid) still rejects at routing, 200, zero database calls", async () => {
    const res = await POST(
      makeRequest({
        triggerEvent: "BOOKING_CREATED",
        createdAt: "2026-08-24T10:00:00.000Z",
        payload: { eventTypeId: 999999, type: SLUG, startTime: "garbage", uid: 12345 },
      }),
    );
    expect(res.status).toBe(200);
    expect(getSupabaseServerClient).not.toHaveBeenCalled();
    expect(applyBookingCreated).not.toHaveBeenCalled();
  });

  test("wrong slug with an otherwise-garbage payload still rejects at routing, 200, zero database calls", async () => {
    const res = await POST(
      makeRequest({
        triggerEvent: "BOOKING_CREATED",
        createdAt: "2026-08-24T10:00:00.000Z",
        payload: { eventTypeId: EVENT_TYPE_ID, type: "wrong-slug", startTime: "garbage", uid: 12345 },
      }),
    );
    expect(res.status).toBe(200);
    expect(getSupabaseServerClient).not.toHaveBeenCalled();
  });

  test("missing eventTypeId/type entirely (fails the routing schema itself) -> 200, zero database calls", async () => {
    const res = await POST(makeRequest({ triggerEvent: "BOOKING_CREATED", createdAt: "2026-08-24T10:00:00.000Z", payload: {} }));
    expect(res.status).toBe(200);
    expect(getSupabaseServerClient).not.toHaveBeenCalled();
  });

  test("correct eventTypeId/type but malformed startTime -> passes routing, fails full schema, 200, zero database calls", async () => {
    const res = await POST(
      makeRequest({
        triggerEvent: "BOOKING_CREATED",
        createdAt: "2026-08-24T10:00:00.000Z",
        payload: { eventTypeId: EVENT_TYPE_ID, type: SLUG, startTime: "not-a-real-timestamp", uid: "abc" },
      }),
    );
    expect(res.status).toBe(200);
    expect(applyBookingCreated).not.toHaveBeenCalled();
  });
});

describe("BOOKING_CREATED — context mandatory, no fallback", () => {
  test("missing context -> 200 no-op, zero database calls", async () => {
    const res = await POST(makeRequest(baseCreatedPayload()));
    expect(res.status).toBe(200);
    expect(getSupabaseServerClient).not.toHaveBeenCalled();
    expect(applyBookingCreated).not.toHaveBeenCalled();
  });

  test("invalid context -> 200 no-op, zero database calls", async () => {
    const body = baseCreatedPayload();
    (body.payload as Record<string, unknown>).metadata = { bookingContext: "garbage.notvalid" };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    expect(applyBookingCreated).not.toHaveBeenCalled();
  });

  test("valid context -> applyBookingCreated called with the resolved inquiry id", async () => {
    applyBookingCreated.mockResolvedValue("applied");
    const context = validContext();
    const body = baseCreatedPayload();
    (body.payload as Record<string, unknown>).metadata = { bookingContext: context };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    expect(applyBookingCreated).toHaveBeenCalledWith(
      { fake: "client" },
      expect.objectContaining({ inquiryId: INQUIRY_ID, uid: "cal-uid-1", timezone: "Africa/Cairo" }),
    );
  });
});

describe("BOOKING_CANCELLED — context preferred, cal_booking_id fallback", () => {
  const baseCancelled = () => ({
    triggerEvent: "BOOKING_CANCELLED",
    createdAt: "2026-08-24T12:00:00.000Z",
    payload: {
      eventTypeId: EVENT_TYPE_ID,
      type: SLUG,
      uid: "cal-uid-1",
      startTime: "2026-08-25T11:00:00Z",
    },
  });

  test("no metadata -> fallback path, inquiryId null", async () => {
    applyBookingCancelled.mockResolvedValue("applied");
    const res = await POST(makeRequest(baseCancelled()));
    expect(res.status).toBe(200);
    expect(applyBookingCancelled).toHaveBeenCalledWith({ fake: "client" }, expect.objectContaining({ inquiryId: null, uid: "cal-uid-1" }));
  });

  test("valid context present -> resolved inquiryId used", async () => {
    applyBookingCancelled.mockResolvedValue("applied");
    const body = baseCancelled();
    (body.payload as Record<string, unknown>).metadata = { bookingContext: validContext() };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    expect(applyBookingCancelled).toHaveBeenCalledWith({ fake: "client" }, expect.objectContaining({ inquiryId: INQUIRY_ID }));
  });

  test("apply returns conflict -> still 200, sanitized", async () => {
    applyBookingCancelled.mockResolvedValue("conflict");
    const res = await POST(makeRequest(baseCancelled()));
    expect(res.status).toBe(200);
  });

  test("apply returns internal_error -> 502", async () => {
    applyBookingCancelled.mockResolvedValue("internal_error");
    const res = await POST(makeRequest(baseCancelled()));
    expect(res.status).toBe(502);
  });
});

describe("BOOKING_RESCHEDULED — context preferred, rescheduleUid fallback", () => {
  const baseRescheduled = () => ({
    triggerEvent: "BOOKING_RESCHEDULED",
    createdAt: "2026-08-24T13:00:00.000Z",
    payload: {
      eventTypeId: EVENT_TYPE_ID,
      type: SLUG,
      uid: "new-uid",
      rescheduleUid: "old-uid",
      startTime: "2026-08-26T11:00:00Z",
    },
  });

  test("no metadata -> fallback path, inquiryId null, both uids forwarded", async () => {
    applyBookingRescheduled.mockResolvedValue("applied");
    const res = await POST(makeRequest(baseRescheduled()));
    expect(res.status).toBe(200);
    expect(applyBookingRescheduled).toHaveBeenCalledWith(
      { fake: "client" },
      expect.objectContaining({ inquiryId: null, rescheduleUid: "old-uid", newUid: "new-uid" }),
    );
  });

  test("valid context -> resolved inquiryId used", async () => {
    applyBookingRescheduled.mockResolvedValue("applied");
    const body = baseRescheduled();
    (body.payload as Record<string, unknown>).metadata = { bookingContext: validContext() };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    expect(applyBookingRescheduled).toHaveBeenCalledWith({ fake: "client" }, expect.objectContaining({ inquiryId: INQUIRY_ID }));
  });

  test("missing rescheduleUid -> 200 no-op (malformed schema)", async () => {
    const body = baseRescheduled();
    delete (body.payload as Record<string, unknown>).rescheduleUid;
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    expect(applyBookingRescheduled).not.toHaveBeenCalled();
  });
});

describe("timezone conflict handling", () => {
  test("both casings present and disagreeing -> whole event rejected, zero database calls", async () => {
    const body = baseCreatedPayload();
    (body.payload as Record<string, unknown>).metadata = { bookingContext: validContext() };
    body.payload.attendees = [{ timeZone: "Africa/Cairo", timezone: "Europe/London" } as unknown as { timeZone: string }];
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    expect(applyBookingCreated).not.toHaveBeenCalled();
  });

  test("no attendees at all -> meeting_timezone stored as null, not guessed", async () => {
    applyBookingCreated.mockResolvedValue("applied");
    const body = baseCreatedPayload();
    (body.payload as Record<string, unknown>).metadata = { bookingContext: validContext() };
    delete (body.payload as Record<string, unknown>).attendees;
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    expect(applyBookingCreated).toHaveBeenCalledWith({ fake: "client" }, expect.objectContaining({ timezone: null }));
  });
});

describe("controlled error boundary — no configuration/network/RPC exception escapes uncaught", () => {
  test("getSupabaseServerClient() throws -> 502, sanitized, no config detail leaked", async () => {
    getSupabaseServerClient.mockImplementation(() => {
      throw new Error("SUPABASE_URL missing some very specific detail");
    });
    const context = validContext();
    const body = baseCreatedPayload();
    (body.payload as Record<string, unknown>).metadata = { bookingContext: context };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(502);
    const bodyText = await res.text();
    expect(bodyText).not.toContain("SUPABASE_URL");
  });

  test("applyBookingCreated() rejects (unexpected throw, not just a returned error) -> 502, sanitized", async () => {
    applyBookingCreated.mockRejectedValue(new Error("some very specific database detail"));
    const context = validContext();
    const body = baseCreatedPayload();
    (body.payload as Record<string, unknown>).metadata = { bookingContext: context };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(502);
    const bodyText = await res.text();
    expect(bodyText).not.toContain("some very specific database detail");
  });

  test("CAL_BOOKING_CONTEXT_SECRET missing (verifyBookingContext throws) -> 502, not a silent 200 or a crash", async () => {
    // Build a genuinely well-formed token (passes every shape/canonical
    // check) WHILE the secret still exists, so the failure this test
    // targets — getSecret() throwing — is actually reached inside
    // verifyBookingContext rather than being short-circuited by an
    // earlier shape check on a deliberately-malformed token.
    const context = validContext();
    delete process.env.CAL_BOOKING_CONTEXT_SECRET;
    const body = baseCreatedPayload();
    (body.payload as Record<string, unknown>).metadata = { bookingContext: context };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(502);
  });

  test("CAL_WEBHOOK_SECRET missing (getCalWebhookSecret throws) -> 502", async () => {
    getCalWebhookSecret.mockImplementation(() => {
      throw new Error("CAL_WEBHOOK_SECRET must be set");
    });
    const res = await POST(makeRequest(baseCreatedPayload()));
    expect(res.status).toBe(502);
  });
});

describe("no secret/payload/identifier ever leaks through logs or the response body", () => {
  test("across a representative set of failure and success scenarios", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    applyBookingCreated.mockResolvedValue("applied");
    applyBookingCancelled.mockResolvedValue("conflict");

    const scenarios: Request[] = [
      makeRequest(baseCreatedPayload(), { secret: "wrong" }) as unknown as Request,
      makeRequest({ triggerEvent: "BOOKING_CREATED", createdAt: "2026-08-24T10:00:00.000Z", payload: {} }) as unknown as Request,
    ];
    const context = validContext();
    const createdBody = baseCreatedPayload();
    (createdBody.payload as Record<string, unknown>).metadata = { bookingContext: context };
    scenarios.push(makeRequest(createdBody) as unknown as Request);

    for (const req of scenarios) {
      const res = await POST(req.clone() as unknown as Parameters<typeof POST>[0]);
      const bodyText = await res.text();
      expect(bodyText).not.toContain(WEBHOOK_SECRET);
      expect(bodyText).not.toContain(CONTEXT_SECRET);
      expect(bodyText).not.toContain(INQUIRY_ID);
      expect(bodyText).not.toContain(context);
    }

    const logged = spy.mock.calls.flat(2).join(" ");
    expect(logged).not.toContain(WEBHOOK_SECRET);
    expect(logged).not.toContain(CONTEXT_SECRET);
    expect(logged).not.toContain(INQUIRY_ID);
    expect(logged).not.toContain(context);
    spy.mockRestore();
  });

  test("an invalid-signature request produces no application log line at all", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(makeRequest(baseCreatedPayload(), { secret: "wrong" }));
    expect(res.status).toBe(401);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

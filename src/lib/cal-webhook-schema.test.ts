import { describe, expect, test } from "vitest";
import {
  envelopeMinimalSchema,
  routingPayloadSchema,
  bookingCreatedPayloadSchema,
  bookingRescheduledPayloadSchema,
  resolveAttendeeTimezone,
} from "./cal-webhook-schema";

describe("envelopeMinimalSchema — createdAt is a strict, offset-required ISO-8601 timestamp", () => {
  test("accepts a Z timestamp", () => {
    const result = envelopeMinimalSchema.safeParse({
      triggerEvent: "BOOKING_CREATED",
      createdAt: "2026-08-24T10:00:00.000Z",
      payload: {},
    });
    expect(result.success).toBe(true);
  });

  test("accepts an explicit offset", () => {
    const result = envelopeMinimalSchema.safeParse({
      triggerEvent: "BOOKING_CREATED",
      createdAt: "2026-08-24T10:00:00+02:00",
      payload: {},
    });
    expect(result.success).toBe(true);
  });

  test("rejects a date-only string", () => {
    const result = envelopeMinimalSchema.safeParse({ triggerEvent: "BOOKING_CREATED", createdAt: "2026-08-24", payload: {} });
    expect(result.success).toBe(false);
  });

  test("rejects arbitrary garbage text", () => {
    const result = envelopeMinimalSchema.safeParse({ triggerEvent: "BOOKING_CREATED", createdAt: "not-a-date", payload: {} });
    expect(result.success).toBe(false);
  });

  test("rejects a timestamp with no timezone designator at all", () => {
    const result = envelopeMinimalSchema.safeParse({ triggerEvent: "BOOKING_CREATED", createdAt: "2026-08-24T10:00:00", payload: {} });
    expect(result.success).toBe(false);
  });

  test("rejects a missing triggerEvent", () => {
    const result = envelopeMinimalSchema.safeParse({ createdAt: "2026-08-24T10:00:00Z", payload: {} });
    expect(result.success).toBe(false);
  });
});

describe("routingPayloadSchema — minimal, routing fields only", () => {
  test("accepts just eventTypeId and type, ignoring everything else present", () => {
    const result = routingPayloadSchema.safeParse({
      eventTypeId: 6790027,
      type: "mintapp-discovery-call",
      startTime: "garbage-that-would-fail-the-full-schema",
      uid: 12345, // wrong type entirely — full schema would reject this
    });
    expect(result.success).toBe(true);
  });

  test("rejects a missing eventTypeId even if type is present", () => {
    const result = routingPayloadSchema.safeParse({ type: "mintapp-discovery-call" });
    expect(result.success).toBe(false);
  });

  test("rejects a missing type even if eventTypeId is present", () => {
    const result = routingPayloadSchema.safeParse({ eventTypeId: 6790027 });
    expect(result.success).toBe(false);
  });
});

describe("bookingCreatedPayloadSchema — startTime is a strict offset-required timestamp", () => {
  const base = {
    eventTypeId: 6790027,
    type: "mintapp-discovery-call",
    uid: "abc123",
  };

  test("rejects a date-only startTime", () => {
    const result = bookingCreatedPayloadSchema.safeParse({ ...base, startTime: "2026-08-25" });
    expect(result.success).toBe(false);
  });

  test("rejects garbage startTime", () => {
    const result = bookingCreatedPayloadSchema.safeParse({ ...base, startTime: "NaN-NaN-NaNTNaN" });
    expect(result.success).toBe(false);
  });

  test("rejects an unbounded/absurdly long startTime string", () => {
    const result = bookingCreatedPayloadSchema.safeParse({ ...base, startTime: "2026-08-25T11:00:00Z" + "x".repeat(10000) });
    expect(result.success).toBe(false);
  });

  test("accepts a valid Z startTime", () => {
    const result = bookingCreatedPayloadSchema.safeParse({ ...base, startTime: "2026-08-25T11:00:00Z" });
    expect(result.success).toBe(true);
  });
});

describe("bookingCreatedPayloadSchema — never keeps attendee name/email", () => {
  test("strips undeclared fields (name/email) from the parsed result", () => {
    const result = bookingCreatedPayloadSchema.safeParse({
      eventTypeId: 6790027,
      type: "mintapp-discovery-call",
      uid: "abc123",
      startTime: "2026-08-25T11:00:00Z",
      attendees: [{ name: "Jane Doe", email: "jane@example.com", timeZone: "America/New_York" }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const attendee = result.data.attendees?.[0] as Record<string, unknown>;
      expect(attendee).not.toHaveProperty("name");
      expect(attendee).not.toHaveProperty("email");
      expect(attendee.timeZone).toBe("America/New_York");
    }
  });
});

describe("bookingCreatedPayloadSchema — metadata narrowed to bookingContext only", () => {
  test("strips other metadata fields (e.g. videoCallUrl), keeping only bookingContext", () => {
    const result = bookingCreatedPayloadSchema.safeParse({
      eventTypeId: 6790027,
      type: "mintapp-discovery-call",
      uid: "abc123",
      startTime: "2026-08-25T11:00:00Z",
      metadata: { bookingContext: "token-value", videoCallUrl: "https://example.com/video/secret" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata).toEqual({ bookingContext: "token-value" });
    }
  });
});

describe("bookingRescheduledPayloadSchema", () => {
  test("requires rescheduleUid", () => {
    const result = bookingRescheduledPayloadSchema.safeParse({
      eventTypeId: 6790027,
      type: "mintapp-discovery-call",
      uid: "new-uid",
      startTime: "2026-08-25T11:00:00Z",
    });
    expect(result.success).toBe(false);
  });

  test("accepts a full valid reschedule payload", () => {
    const result = bookingRescheduledPayloadSchema.safeParse({
      eventTypeId: 6790027,
      type: "mintapp-discovery-call",
      uid: "new-uid",
      rescheduleUid: "old-uid",
      startTime: "2026-08-25T11:00:00Z",
    });
    expect(result.success).toBe(true);
  });
});

describe("resolveAttendeeTimezone — real IANA recognition, not just shape", () => {
  test("no attendee -> null, ok", () => {
    expect(resolveAttendeeTimezone(undefined)).toEqual({ status: "ok", timezone: null });
  });

  test("neither casing present -> null, ok (never guess)", () => {
    expect(resolveAttendeeTimezone({})).toEqual({ status: "ok", timezone: null });
  });

  test("a real, recognized IANA zone is accepted", () => {
    expect(resolveAttendeeTimezone({ timeZone: "Africa/Cairo" })).toEqual({ status: "ok", timezone: "Africa/Cairo" });
  });

  test("a plausible-shaped but NONEXISTENT timezone is rejected to null, not stored", () => {
    expect(resolveAttendeeTimezone({ timeZone: "Fake/Timezone" })).toEqual({ status: "ok", timezone: null });
  });

  test("only timezone (lowercase) present, real zone -> uses it", () => {
    expect(resolveAttendeeTimezone({ timezone: "Europe/London" })).toEqual({ status: "ok", timezone: "Europe/London" });
  });

  test("both present and equal, real zone -> uses it", () => {
    expect(resolveAttendeeTimezone({ timeZone: "Asia/Dubai", timezone: "Asia/Dubai" })).toEqual({ status: "ok", timezone: "Asia/Dubai" });
  });

  test("both present and disagreeing -> conflict (regardless of real-zone status)", () => {
    expect(resolveAttendeeTimezone({ timeZone: "Asia/Dubai", timezone: "Europe/London" })).toEqual({ status: "conflict" });
  });

  test("invalid-shape timezone string -> null, not a conflict, not rejected", () => {
    expect(resolveAttendeeTimezone({ timeZone: "not a real timezone!!" })).toEqual({ status: "ok", timezone: null });
  });

  test("excessively long timezone string -> null", () => {
    expect(resolveAttendeeTimezone({ timeZone: "Africa/" + "x".repeat(200) })).toEqual({ status: "ok", timezone: null });
  });

  test("plain 'UTC' is a real recognized zone, accepted", () => {
    expect(resolveAttendeeTimezone({ timeZone: "UTC" })).toEqual({ status: "ok", timezone: "UTC" });
  });

  test("multi-segment real IANA name (Area/Region/City) is accepted", () => {
    expect(resolveAttendeeTimezone({ timeZone: "America/Argentina/Buenos_Aires" })).toEqual({
      status: "ok",
      timezone: "America/Argentina/Buenos_Aires",
    });
  });

  test("never falls back to Africa/Cairo regardless of input", () => {
    const result = resolveAttendeeTimezone({ timeZone: "Fake/Timezone" });
    expect(result.status === "ok" && result.timezone).not.toBe("Africa/Cairo");
  });
});

describe("resolveAttendeeTimezone — multiple attendees: only the first is consulted", () => {
  test("caller passes attendees[0] explicitly — this is documented behavior, not implicit in the function itself", () => {
    // resolveAttendeeTimezone takes a single attendee, not an array — the
    // "use attendees[0]" decision is made by the caller (route.ts). This
    // test documents that contract so a future change to route.ts's
    // indexing is a deliberate, visible diff, not a silent behavior shift.
    const attendees = [{ timeZone: "Africa/Cairo" }, { timeZone: "Europe/London" }];
    expect(resolveAttendeeTimezone(attendees[0])).toEqual({ status: "ok", timezone: "Africa/Cairo" });
  });
});

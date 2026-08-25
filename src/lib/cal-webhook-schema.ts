import { z } from "zod";

// Three genuinely separate validation tiers, matching the route's own
// staged order: (1) a minimal envelope — just enough to decide whether
// this triggerEvent is even one we handle; (2) a minimal ROUTING schema —
// only eventTypeId/type, parsed and checked against CAL_EVENT_TYPE_ID and
// the configured slug BEFORE anything else in the payload is trusted, so a
// malformed non-routing field (bad startTime, bad uid) can never prevent
// this rejection from happening first; (3) the full per-event schema, only
// reached once both prior stages have passed.
//
// Every schema below uses Zod's default (non-.strict()) behavior, which
// STRIPS any undeclared key from the parsed result rather than rejecting
// the whole payload for having one — the same choice already made in
// inquiry-schema.ts, for the same reason: it stays forward-compatible if
// Cal.com adds fields later, while still guaranteeing that anything not
// explicitly declared here (attendee name/email/notes, video/booking-
// management/cancellation URLs, conference credentials, ICS content, the
// rest of "metadata" beyond bookingContext) can never survive into the
// typed result — and therefore can never reach an RPC argument, a log
// line, an error, or a response, since nothing downstream ever touches
// the raw pre-parse payload again.

export const HANDLED_TRIGGER_EVENTS = ["BOOKING_CREATED", "BOOKING_CANCELLED", "BOOKING_RESCHEDULED"] as const;

export const envelopeMinimalSchema = z.object({
  triggerEvent: z.string().min(1).max(64),
  // Cal.com's own documentation confirms createdAt is a top-level envelope
  // field (a sibling of triggerEvent/payload), not nested inside payload.
  // Strict ISO-8601 with a required offset/Z — malformed timestamps must
  // never reach a Postgres cast inside the RPC call.
  createdAt: z.string().datetime({ offset: true }),
  payload: z.unknown(),
});

// Tier 2: routing only. Nothing else from payload is read at this stage.
export const routingPayloadSchema = z.object({
  eventTypeId: z.number().int().positive(),
  type: z.string().min(1).max(200),
});

const attendeeSchema = z.object({
  // Cal.com's own documentation disagrees with itself on casing here (the
  // Person-structure reference lists "timezone", the example JSON payload
  // shows "timeZone") — both are accepted and reconciled by
  // resolveAttendeeTimezone below, never assumed.
  timeZone: z.string().min(1).max(100).optional(),
  timezone: z.string().min(1).max(100).optional(),
});

const fullEventSchema = z.object({
  eventTypeId: z.number().int().positive(),
  type: z.string().min(1).max(200),
  uid: z.string().min(1).max(255),
  startTime: z.string().datetime({ offset: true }),
  // Only bookingContext is ever extracted from Cal.com's metadata object —
  // never the object itself. metadata can otherwise contain videoCallUrl
  // and similar fields we deliberately never want to touch, store, or log.
  metadata: z.object({ bookingContext: z.string().min(1).max(512).optional() }).optional(),
});

export const bookingCreatedPayloadSchema = fullEventSchema.extend({
  attendees: z.array(attendeeSchema).optional(),
});

export const bookingCancelledPayloadSchema = fullEventSchema.extend({
  attendees: z.array(attendeeSchema).optional(),
});

export const bookingRescheduledPayloadSchema = fullEventSchema.extend({
  rescheduleUid: z.string().min(1).max(255),
  attendees: z.array(attendeeSchema).optional(),
});

export type TimezoneResolution = { status: "ok"; timezone: string | null } | { status: "conflict" };

const MAX_TZ_LENGTH = 100;
// A cheap shape pre-filter before ever constructing an Intl object —
// rejects obviously-not-a-timezone garbage without relying on Intl's own
// error behavior for arbitrary junk input.
const TZ_SHAPE_PATTERN = /^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+){0,2}$/;

// Real recognition, not just a shape check: Intl.DateTimeFormat throws a
// RangeError for a timeZone the runtime's ICU data doesn't recognize (e.g.
// "Fake/Timezone" matches the shape pattern above but isn't a real IANA
// zone). This is the actual validation; the shape/length checks are only a
// cheap pre-filter.
function isRecognizedTimezone(tz: string): boolean {
  if (tz.length > MAX_TZ_LENGTH || !TZ_SHAPE_PATTERN.test(tz)) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// meeting_timezone represents the attendee/client's own selected booking
// timezone, not Mintapp's (already known statically as Africa/Cairo, so
// not worth copying from every webhook) or the event type's configured
// timezone. Multiple attendees: only attendees[0] is ever consulted — the
// Discovery Call event type has no separate-guest field, so the first
// (only, in practice) attendee is the actual booker this inquiry belongs
// to; any later entries would be secondary guests, not the person whose
// timezone we're tracking.
//
// Decision, stated explicitly: an unrecognized/malformed timezone STRING
// (bad shape, or a real-looking but nonexistent IANA name) is treated as
// absent — stored as null, the rest of the event still processes
// normally. A genuine CONFLICT between the two casings' VALUES is
// different: that's evidence something is wrong with the whole payload,
// not just this one field, so the entire event is rejected rather than
// guessing which value to trust.
export function resolveAttendeeTimezone(attendee: { timeZone?: string; timezone?: string } | undefined): TimezoneResolution {
  if (!attendee) return { status: "ok", timezone: null };
  const camel = attendee.timeZone;
  const lower = attendee.timezone;

  if (camel && lower) {
    if (camel !== lower) return { status: "conflict" };
    return { status: "ok", timezone: isRecognizedTimezone(camel) ? camel : null };
  }

  const value = camel ?? lower;
  if (!value) return { status: "ok", timezone: null };
  return { status: "ok", timezone: isRecognizedTimezone(value) ? value : null };
}

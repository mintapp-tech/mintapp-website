import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signBookingContext, verifyBookingContext } from "./cal-booking-context";
import { getSupabaseServerClient } from "./supabase-server";

// What the "Choose a call time" link in the acknowledgment email may show.
//
// The link carries the signed inquiry reference. Everything is decided here, on
// the server, from the current state of the inquiry, never from the browser:
//
//   not_booked, cancelled -> schedule: show the scheduler, with a FRESH reference
//                            so a booking started now cannot expire half way
//   booked                -> booked: no second scheduler; where it is safe, the
//                            existing Cal.com page for managing that booking
//   completed, no_show    -> closed: no scheduler, ask them to write to us
//   missing, malformed, tampered, expired, signed for an inquiry that does not
//   exist, or soft-deleted -> unavailable: ONE answer for all of them, so the
//                            page can never confirm whether a record exists
//   anything we could not verify (database or configuration fault)
//                          -> error: fail closed, never a scheduler that could
//                            create a booking we cannot link
//
// The database is only consulted after the signature has verified, so a guessed
// or garbled link never reaches it.

export type BookingRecovery =
  | { state: "schedule"; bookingContext: string }
  | { state: "booked"; startsAt: string | null; timezone: string | null; manageUrl: string | null }
  | { state: "closed" }
  | { state: "unavailable" }
  | { state: "error" };

const MAX_REFERENCE_LENGTH = 512; // matches the ceiling the webhook accepts
// Cal.com's booking ids are short URL-safe strings; anything else is not linked to.
const CAL_BOOKING_UID = /^[A-Za-z0-9_-]{8,64}$/;

interface InquiryBookingRow {
  booking_status: string;
  cal_booking_id: string | null;
  meeting_start_at: string | null;
  meeting_timezone: string | null;
  deleted_at: string | null;
}

// Cal.com's own page for an attendee to reschedule or cancel their booking. The
// booking id is the only thing that grants it, exactly as in the confirmation
// email Cal.com already sent to the client.
const manageUrlFor = (uid: string | null): string | null => (uid && CAL_BOOKING_UID.test(uid) ? `https://cal.com/booking/${uid}` : null);

export async function resolveBookingRecovery(reference: unknown, supabase?: SupabaseClient): Promise<BookingRecovery> {
  if (typeof reference !== "string" || reference.length === 0 || reference.length > MAX_REFERENCE_LENGTH) return { state: "unavailable" };

  let verified: ReturnType<typeof verifyBookingContext>;
  try {
    verified = verifyBookingContext(reference);
  } catch {
    // A missing signing secret is a configuration fault, not an invalid link.
    console.error("booking_recovery_unavailable: signing is not configured");
    return { state: "error" };
  }
  if (!verified.ok) return { state: "unavailable" };

  let row: InquiryBookingRow | undefined;
  try {
    const client = supabase ?? getSupabaseServerClient();
    const { data, error } = await client
      .from("project_inquiries")
      .select("booking_status, cal_booking_id, meeting_start_at, meeting_timezone, deleted_at")
      .eq("id", verified.inquiryId)
      .limit(1);
    if (error) {
      console.error("booking_recovery_unavailable: read failed");
      return { state: "error" };
    }
    row = (data as InquiryBookingRow[] | null)?.[0];
  } catch {
    console.error("booking_recovery_unavailable: read failed");
    return { state: "error" };
  }
  if (!row || row.deleted_at) return { state: "unavailable" };

  switch (row.booking_status) {
    case "not_booked":
    case "cancelled":
      try {
        return { state: "schedule", bookingContext: signBookingContext(verified.inquiryId) };
      } catch {
        console.error("booking_recovery_unavailable: signing failed");
        return { state: "error" };
      }
    case "booked":
      return { state: "booked", startsAt: row.meeting_start_at, timezone: row.meeting_timezone, manageUrl: manageUrlFor(row.cal_booking_id) };
    default:
      return { state: "closed" };
  }
}

// The meeting time as the client will read it, in their own timezone when we hold
// one, with the zone as a plain offset (GMT+3) rather than an abbreviation (EEST). Done on the server so the page renders the same text everywhere.
export function formatMeetingTime(startsAt: string | null, timezone: string | null, locale: "en" | "ar"): string | null {
  if (!startsAt) return null;
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return null;
  const intlLocale = locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB";
  const options: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "shortOffset" };
  try {
    return new Intl.DateTimeFormat(intlLocale, { ...options, timeZone: timezone ?? "UTC" }).format(date);
  } catch {
    // An unknown timezone name: fall back to UTC rather than show nothing.
    return new Intl.DateTimeFormat(intlLocale, { ...options, timeZone: "UTC" }).format(date);
  }
}

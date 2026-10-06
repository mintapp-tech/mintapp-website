import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatMeetingTime, resolveBookingRecovery } from "./booking-recovery";
import { signBookingContext, verifyBookingContext } from "./cal-booking-context";

const SECRET = "test-booking-secret-not-real-0123456789";
const INQUIRY_ID = "5d2b7a4e-6a43-4f2e-9d3f-0e1d6c9b8a77";
const DAY = 24 * 60 * 60;

beforeEach(() => {
  vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", SECRET);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

// A reference issued `ageDays` ago, signed exactly as the real signer does.
function referenceAged(ageDays: number, id = INQUIRY_ID, secret = SECRET) {
  const payload = Buffer.from(JSON.stringify({ id, iat: Math.floor(Date.now() / 1000) - ageDays * DAY }), "utf8").toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}

type Row = { booking_status: string; cal_booking_id: string | null; meeting_start_at: string | null; meeting_timezone: string | null; deleted_at: string | null };
const row = (over: Partial<Row> = {}): Row => ({ booking_status: "not_booked", cal_booking_id: null, meeting_start_at: null, meeting_timezone: null, deleted_at: null, ...over });

function fakeDatabase(result: { data: Row[] | null; error?: unknown } | "throw") {
  const queries: { table: string; id: unknown }[] = [];
  const client = {
    from(table: string) {
      return {
        select: () => ({
          eq: (_column: string, id: unknown) => ({
            limit: async () => {
              queries.push({ table, id });
              if (result === "throw") throw new Error("network down");
              return { data: result.data, error: result.error ?? null };
            },
          }),
        }),
      };
    },
  } as unknown as SupabaseClient;
  return { queries, client };
}

describe("a link that can be acted on", () => {
  test("not booked: shows the scheduler, with a fresh reference for the same inquiry", async () => {
    const { client, queries } = fakeDatabase({ data: [row()] });
    const old = referenceAged(20);
    const result = await resolveBookingRecovery(old, client);
    expect(result.state).toBe("schedule");
    if (result.state !== "schedule") return;
    expect(verifyBookingContext(result.bookingContext)).toEqual({ ok: true, inquiryId: INQUIRY_ID });
    expect(result.bookingContext).not.toBe(old); // new issue time, so a booking started now cannot expire mid-way
    expect(queries).toEqual([{ table: "project_inquiries", id: INQUIRY_ID }]);
  });

  test("cancelled: the client may choose a new time, linked to the same inquiry", async () => {
    const { client } = fakeDatabase({ data: [row({ booking_status: "cancelled", cal_booking_id: "oldBookingUid1", meeting_start_at: "2026-10-20T09:00:00Z" })] });
    const result = await resolveBookingRecovery(referenceAged(1), client);
    expect(result.state).toBe("schedule");
    if (result.state === "schedule") expect(verifyBookingContext(result.bookingContext)).toEqual({ ok: true, inquiryId: INQUIRY_ID });
  });

  test("a reference 29 days old still works (the 30-day lifetime)", async () => {
    expect((await resolveBookingRecovery(referenceAged(29), fakeDatabase({ data: [row()] }).client)).state).toBe("schedule");
  });
});

describe("already booked: never a second scheduler", () => {
  test("shows the existing booking and Cal.com's own page to manage it", async () => {
    const { client } = fakeDatabase({ data: [row({ booking_status: "booked", cal_booking_id: "gFLmqHeVSGvyGLoE6DK8Wi", meeting_start_at: "2026-10-20T09:00:00Z", meeting_timezone: "Africa/Cairo" })] });
    const result = await resolveBookingRecovery(referenceAged(2), client);
    expect(result).toEqual({ state: "booked", startsAt: "2026-10-20T09:00:00Z", timezone: "Africa/Cairo", manageUrl: "https://cal.com/booking/gFLmqHeVSGvyGLoE6DK8Wi" });
    expect(result).not.toHaveProperty("bookingContext"); // nothing that could start another booking
  });

  test("a rescheduled booking is simply the current booking (status stays booked with the new id and time)", async () => {
    const { client } = fakeDatabase({ data: [row({ booking_status: "booked", cal_booking_id: "newBookingUid99", meeting_start_at: "2026-10-22T11:00:00Z" })] });
    expect(await resolveBookingRecovery(referenceAged(2), client)).toMatchObject({ state: "booked", startsAt: "2026-10-22T11:00:00Z", manageUrl: "https://cal.com/booking/newBookingUid99" });
  });

  test.each(["", "short", "has space in it", "../../etc/passwd", "a".repeat(80), "id?x=1&y=2"])("a booking id that is not a plain Cal.com id (%j) gives no management link", async (uid) => {
    const { client } = fakeDatabase({ data: [row({ booking_status: "booked", cal_booking_id: uid })] });
    expect(await resolveBookingRecovery(referenceAged(1), client)).toMatchObject({ state: "booked", manageUrl: null });
  });

  test("a booked inquiry with no stored id still shows it is scheduled, without a link", async () => {
    const { client } = fakeDatabase({ data: [row({ booking_status: "booked", cal_booking_id: null })] });
    expect(await resolveBookingRecovery(referenceAged(1), client)).toMatchObject({ state: "booked", manageUrl: null });
  });
});

describe("other states: no scheduler", () => {
  test.each(["completed", "no_show", "something_new"])("%s", async (booking_status) => {
    expect(await resolveBookingRecovery(referenceAged(1), fakeDatabase({ data: [row({ booking_status })] }).client)).toEqual({ state: "closed" });
  });
});

describe("a link that cannot be used: one answer, no database access", () => {
  const unusable: [string, unknown][] = [
    ["missing", undefined],
    ["empty", ""],
    ["not a string", ["a.b"]],
    ["too long", "a".repeat(513)],
    ["garbage", "not-a-reference"],
    ["a UUID instead of a reference", INQUIRY_ID],
    ["expired (31 days)", referenceAged(31)],
    ["signed with another secret", referenceAged(1, INQUIRY_ID, "someone-elses-secret")],
    ["issued in the future", referenceAged(-1)],
  ];

  test.each(unusable)("%s", async (_name, reference) => {
    const { client, queries } = fakeDatabase({ data: [row()] });
    expect(await resolveBookingRecovery(reference, client)).toEqual({ state: "unavailable" });
    expect(queries).toHaveLength(0); // never reaches the database
  });

  test("tampered: changing any character of a good reference is refused before the database", async () => {
    const good = referenceAged(1);
    const { client, queries } = fakeDatabase({ data: [row()] });
    for (let i = 0; i < good.length; i += 7) {
      if (good[i] === ".") continue;
      const bad = good.slice(0, i) + (good[i] === "A" ? "B" : "A") + good.slice(i + 1);
      expect(await resolveBookingRecovery(bad, client), `character ${i}`).toEqual({ state: "unavailable" });
    }
    expect(queries).toHaveLength(0);
  });

  test("every non-canonical spelling of a genuine signature gets the same refusal, before the database", async () => {
    const good = referenceAged(1);
    const [payload, signature] = good.split(".");
    const bytes = Buffer.from(signature, "base64url");
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const spellings = [...alphabet].map((ch) => signature.slice(0, -1) + ch).filter((s) => s !== signature && Buffer.from(s, "base64url").equals(bytes));
    expect(spellings).toHaveLength(3); // they decode to the very same signature bytes
    const { client, queries } = fakeDatabase({ data: [row()] });
    for (const spelling of spellings) expect(await resolveBookingRecovery(`${payload}.${spelling}`, client)).toEqual({ state: "unavailable" });
    expect(queries).toHaveLength(0);
    expect((await resolveBookingRecovery(good, client)).state).toBe("schedule"); // the canonical one still works
  });

  test("a genuine reference for an inquiry that does not exist, or was deleted, looks exactly like a bad one", async () => {
    const bad = await resolveBookingRecovery("garbage", fakeDatabase({ data: [] }).client);
    const unknown = await resolveBookingRecovery(referenceAged(1), fakeDatabase({ data: [] }).client);
    const deleted = await resolveBookingRecovery(referenceAged(1), fakeDatabase({ data: [row({ deleted_at: "2026-09-01T00:00:00Z" })] }).client);
    expect(unknown).toEqual(bad);
    expect(deleted).toEqual(bad);
    expect(JSON.stringify(unknown)).toBe(JSON.stringify(bad)); // identical, not merely equal in meaning
  });
});

describe("fail closed when the state cannot be verified", () => {
  test("a database error shows no scheduler", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await resolveBookingRecovery(referenceAged(1), fakeDatabase({ data: null, error: { code: "08006", message: "connection failure for 5d2b7a4e" } }).client)).toEqual({ state: "error" });
    log.mockRestore();
  });

  test("a thrown exception shows no scheduler", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await resolveBookingRecovery(referenceAged(1), fakeDatabase("throw").client)).toEqual({ state: "error" });
    log.mockRestore();
  });

  test("a missing signing secret is a configuration fault, not an invalid link, and shows no scheduler", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const reference = referenceAged(1);
    vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", "");
    expect(await resolveBookingRecovery(reference, fakeDatabase({ data: [row()] }).client)).toEqual({ state: "error" });
    log.mockRestore();
  });

  test("logs say what failed, never who: no inquiry id, reference or booking id", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const reference = referenceAged(1);
    await resolveBookingRecovery(reference, fakeDatabase({ data: null, error: { message: `failed for ${INQUIRY_ID}` } }).client);
    await resolveBookingRecovery(reference, fakeDatabase("throw").client);
    vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", "");
    await resolveBookingRecovery(reference, fakeDatabase({ data: [row()] }).client);
    const logged = JSON.stringify(log.mock.calls);
    expect(log).toHaveBeenCalled();
    expect(logged).not.toContain(INQUIRY_ID);
    expect(logged).not.toContain(reference);
    expect(logged).not.toContain("network down");
    log.mockRestore();
  });
});

describe("reading never changes anything", () => {
  test("only a read is issued: the fake offers no write method at all", async () => {
    const { client } = fakeDatabase({ data: [row({ booking_status: "booked", cal_booking_id: "gFLmqHeVSGvyGLoE6DK8Wi" })] });
    await expect(resolveBookingRecovery(referenceAged(1), client)).resolves.toMatchObject({ state: "booked" });
    // signBookingContext is the only thing that runs besides the read, and it needs no storage.
    expect(typeof signBookingContext(INQUIRY_ID)).toBe("string");
  });
});

describe("formatMeetingTime", () => {
  test("English and Arabic, in the client's own timezone, with the zone as a plain offset", () => {
    const en = formatMeetingTime("2026-10-20T09:00:00Z", "Africa/Cairo", "en");
    const ar = formatMeetingTime("2026-10-20T09:00:00Z", "Africa/Cairo", "ar");
    expect(en).toMatch(/Tuesday/);
    expect(en).toContain("2026");
    expect(en).toContain("GMT+3"); // not the jargon "EEST"
    expect(ar).toContain("2026"); // Latin digits, as on the rest of the site
    expect(ar).toMatch(/[؀-ۿ]/); // Arabic weekday and month
    expect(ar).toContain("+3");
    expect(en).not.toBe(ar);
  });

  test("falls back to UTC for an unknown timezone, and gives nothing for a missing or invalid time", () => {
    expect(formatMeetingTime("2026-10-20T09:00:00Z", "Not/AZone", "en")).toContain("GMT");
    expect(formatMeetingTime("2026-10-20T09:00:00Z", null, "en")).toContain("GMT");
    expect(formatMeetingTime(null, "Africa/Cairo", "en")).toBeNull();
    expect(formatMeetingTime("not a date", "Africa/Cairo", "en")).toBeNull();
  });
});

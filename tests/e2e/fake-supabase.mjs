// A tiny stand-in for Supabase's REST API, for the browser tests of the booking
// recovery page. It serves a few synthetic inquiries on localhost only, so those
// tests exercise the real server code without ever reaching a real database.
// The test server is pointed here with SUPABASE_URL in playwright.config.ts, and
// Playwright starts it through fake-supabase-server.mjs.
//
//   GET  /rest/v1/project_inquiries?...&id=eq.<uuid>   one synthetic row (or none)
//   GET  /__hits                                       the ids that were looked up
//   POST /__reset                                      forget them
//   GET  /__health                                     readiness

import { createServer } from "node:http";

export const FAKE_SUPABASE_PORT = 3299;

const id = (n) => `eeeeeeee-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const INQUIRIES = {
  NOT_BOOKED: id(1),
  BOOKED: id(2),
  CANCELLED: id(3),
  COMPLETED: id(4),
  DATABASE_FAULT: id(6),
  BOOKED_ODD_UID: id(7),
};

// Ids that only the "unusable link" test looks up, one set per language, so that
// counting lookups stays exact while other tests run in parallel.
export const PROBES = {
  en: { guarded: id(11), deleted: id(12), unknown: id(13) }, // unknown: validly signed in the tests, but no such inquiry
  ar: { guarded: id(21), deleted: id(22), unknown: id(23) },
};

const row = (over) => ({ booking_status: "not_booked", cal_booking_id: null, meeting_start_at: null, meeting_timezone: null, deleted_at: null, ...over });
const ROWS = {
  [INQUIRIES.NOT_BOOKED]: row({}),
  [INQUIRIES.BOOKED]: row({ booking_status: "booked", cal_booking_id: "gFLmqHeVSGvyGLoE6DK8Wi", meeting_start_at: "2026-10-20T09:00:00Z", meeting_timezone: "Africa/Cairo" }),
  [INQUIRIES.CANCELLED]: row({ booking_status: "cancelled", cal_booking_id: "oldBookingUid1", meeting_start_at: "2026-10-19T09:00:00Z", meeting_timezone: "Africa/Cairo" }),
  [INQUIRIES.COMPLETED]: row({ booking_status: "completed", cal_booking_id: "doneBookingUid1" }),
  [INQUIRIES.DELETED]: row({ deleted_at: "2026-09-01T00:00:00Z" }),
  [PROBES.en.guarded]: row({}),
  [PROBES.ar.guarded]: row({}),
  [PROBES.en.deleted]: row({ deleted_at: "2026-09-01T00:00:00Z" }),
  [PROBES.ar.deleted]: row({ deleted_at: "2026-09-01T00:00:00Z" }),
  [INQUIRIES.BOOKED_ODD_UID]: row({ booking_status: "booked", cal_booking_id: "bad id?x=1", meeting_start_at: "2026-10-20T09:00:00Z", meeting_timezone: "Africa/Cairo" }),
};

const hits = [];

export function startFakeSupabase(port = FAKE_SUPABASE_PORT) {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const send = (status, body) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (url.pathname === "/__health") return send(200, { ok: true });
    if (url.pathname === "/__hits") return send(200, hits);
    if (url.pathname === "/__reset") {
      hits.length = 0;
      return send(200, { ok: true });
    }
    if (url.pathname === "/rest/v1/project_inquiries" && req.method === "GET") {
      const wanted = (url.searchParams.get("id") ?? "").replace(/^eq\./, "");
      hits.push(wanted);
      if (wanted === INQUIRIES.DATABASE_FAULT) return send(500, { code: "XX000", message: "synthetic database fault" });
      return send(200, ROWS[wanted] ? [ROWS[wanted]] : []);
    }
    return send(404, { message: "not found" });
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

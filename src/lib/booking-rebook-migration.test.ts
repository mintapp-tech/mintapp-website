import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The behaviour itself is proved against a real Postgres in
// tests/db/booking-rebook.test.mjs. This guards the migration's shape on this
// branch, where that harness is not available: one function replaced, its
// existing guards kept, one condition added, nothing else touched.

const sql = readFileSync(join(process.cwd(), "supabase", "migrations", "20261007000000_allow_rebooking_after_cancellation.sql"), "utf8");
const code = sql.replace(/--[^\n]*/g, "");

describe("rebooking migration", () => {
  test("replaces exactly one function, with the same signature and safety settings", () => {
    expect(code.match(/create or replace function/gi)).toHaveLength(1);
    expect(code).toMatch(/create or replace function public\.apply_booking_created\(\s*p_inquiry_id uuid,\s*p_uid text,\s*p_start_time timestamptz,\s*p_timezone text,\s*p_event_at timestamptz\s*\)\s*returns uuid/);
    expect(code).toContain("security invoker");
    expect(code).toContain("set search_path = ''");
  });

  test("keeps every existing guard and adds only the cancelled-status condition", () => {
    expect(code).toContain("inquiry.cal_booking_event_at is null or inquiry.cal_booking_event_at < p_event_at");
    expect(code).toContain("inquiry.cal_booking_id is null or inquiry.cal_booking_id = p_uid or inquiry.booking_status = 'cancelled'");
    // No other status ever accepts a new booking id: only the SET to 'booked' and the one new 'cancelled' condition mention a status.
    expect(code.match(/booking_status = '/g)).toHaveLength(2); // the SET to 'booked' and the one new 'cancelled' condition
  });

  test("is one atomic update: no select-then-update that a race could slip between", () => {
    expect(code.match(/\bupdate public\.project_inquiries\b/g)).toHaveLength(1);
    expect(code).not.toMatch(/\bselect\b[\s\S]*\bfrom public\.project_inquiries\b/i);
    expect(code).not.toMatch(/\bperform\b|\bloop\b/i);
  });

  test("changes no privileges, no data and no other object", () => {
    expect(code).not.toMatch(/\b(grant|revoke|drop|delete|truncate|insert|alter)\b/i);
  });

  test("is ASCII-only, so no code page can alter it when it is copied", () => {
    expect([...Buffer.from(sql)].every((b) => b < 0x80)).toBe(true);
  });
});

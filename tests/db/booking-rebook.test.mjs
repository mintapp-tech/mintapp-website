// Database-level tests for supabase/migrations/20261007000000_allow_rebooking_after_cancellation.sql:
// a cancelled booking can be replaced by a new one on the same inquiry, and an
// active booking can never be replaced by a second one.
//
// Uses the Postgres harness from feat/inquiry-preparation (tests/db/pg-harness.mjs),
// so it runs under `npm run test:db` once that branch and this one are merged.

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { startCluster, lit } from "./pg-harness.mjs";

let db;
const id = (n) => `dddddddd-0000-4000-8000-${String(n).padStart(12, "0")}`;
const T = (minutes) => `2026-10-07 10:${String(minutes).padStart(2, "0")}:00+00`;
const svc = (sql) => db.psql(`set role service_role; ${sql}`);
const created = (inquiry, uid, eventAt) => svc(`select public.apply_booking_created(${lit(inquiry)}, ${lit(uid)}, '2026-10-20 09:00:00+00', 'Africa/Cairo', '${eventAt}')`);
const cancelled = (inquiry, uid, eventAt) => svc(`select public.apply_booking_cancelled(${lit(inquiry)}, ${lit(uid)}, '2026-10-20 09:00:00+00', 'Africa/Cairo', '${eventAt}')`);
const rescheduled = (inquiry, oldUid, newUid, eventAt) => svc(`select public.apply_booking_rescheduled(${lit(inquiry)}, ${lit(oldUid)}, ${lit(newUid)}, '2026-10-21 09:00:00+00', 'Africa/Cairo', '${eventAt}')`);
const row = (inquiry) => db.psql(`select booking_status || '|' || coalesce(cal_booking_id, '') from public.project_inquiries where id = ${lit(inquiry)}`);
const insert = (inquiry) =>
  db.psql(`insert into public.project_inquiries (id, full_name, email, preferred_language, project_description, consent_given, consent_at)
           values (${lit(inquiry)}, 'Synthetic Client', 'synthetic@example.com', 'en', 'We run three clinics and want online booking.', true, now())`);

before(async () => {
  db = await startCluster();
  for (const file of db.migrations) db.applyMigration(file);
});
after(() => db?.stop());

test("a booking is recorded once, and a second booking with a different id cannot replace it", () => {
  insert(id(1));
  assert.equal(created(id(1), "first", T(1)), id(1));
  assert.equal(row(id(1)), "booked|first");
  // Two tabs, a double click or a retry: the second booking is refused, the first stays.
  assert.equal(created(id(1), "second", T(2)), "");
  assert.equal(row(id(1)), "booked|first");
});

test("the same booking delivered again is ignored (idempotent)", () => {
  assert.equal(created(id(1), "first", T(1)), "", "same event time: nothing to apply twice");
  assert.equal(created(id(1), "first", T(3)), id(1), "a later delivery of the same booking is harmless");
  assert.equal(row(id(1)), "booked|first");
});

test("after a cancellation the client can book again: the new booking is linked to the same inquiry", () => {
  insert(id(2));
  created(id(2), "old", T(1));
  assert.equal(cancelled(id(2), "old", T(2)), id(2));
  assert.equal(row(id(2)), "cancelled|old");
  assert.equal(created(id(2), "new", T(3)), id(2), "the rebooking is applied, not left detached");
  assert.equal(row(id(2)), "booked|new");
});

test("a late replay of the cancelled booking's own creation is still ignored", () => {
  assert.equal(created(id(2), "old", T(1)), "", "older event time");
  assert.equal(row(id(2)), "booked|new");
});

test("the rebooked appointment can itself be rescheduled and cancelled", () => {
  assert.equal(rescheduled(id(2), "new", "newer", T(4)), id(2));
  assert.equal(row(id(2)), "booked|newer");
  assert.equal(cancelled(id(2), "newer", T(5)), id(2));
  assert.equal(row(id(2)), "cancelled|newer");
  assert.equal(created(id(2), "third", T(6)), id(2), "and again");
});

test("once booked again, a stray extra booking still cannot replace it", () => {
  assert.equal(created(id(2), "stray", T(7)), "");
  assert.equal(row(id(2)), "booked|third");
});

test("completed and no-show inquiries do not accept a new booking", () => {
  for (const [n, status] of [[3, "completed"], [4, "no_show"]]) {
    insert(id(n));
    created(id(n), `done-${n}`, T(1));
    db.psql(`update public.project_inquiries set booking_status = '${status}' where id = ${lit(id(n))}`);
    assert.equal(created(id(n), `another-${n}`, T(2)), "", status);
    assert.equal(row(id(n)), `${status}|done-${n}`);
  }
});

test("a booking cannot attach to a different inquiry's cancelled booking by id alone", () => {
  insert(id(5));
  assert.equal(created(id(5), "someone-elses", T(1)), id(5));
  insert(id(6));
  // A booking id already used elsewhere is refused by the unique index, never moved.
  assert.match(db.psqlExpectError(`set role service_role; select public.apply_booking_created(${lit(id(6))}, 'someone-elses', '2026-10-20 09:00:00+00', 'UTC', '${T(2)}')`), /unique|duplicate/i);
  assert.equal(row(id(6)), "not_booked|");
});

test("two bookings arriving at the same moment cannot both win", async () => {
  insert(id(7));
  const attempt = (uid) => db.psqlAsync(`set role service_role; select public.apply_booking_created(${lit(id(7))}, ${lit(uid)}, '2026-10-20 09:00:00+00', 'UTC', '${T(9)}')`);
  const results = await Promise.all([attempt("race-a"), attempt("race-b"), attempt("race-c"), attempt("race-d")]);
  const winners = results.filter((r) => r.out.trim() !== "");
  assert.equal(winners.length, 1, "exactly one booking is recorded");
  assert.match(row(id(7)), /^booked\|race-[a-d]$/);
});

test("privileges are unchanged: only service_role may call it", () => {
  for (const role of ["anon", "authenticated"]) assert.match(db.psqlExpectError(`set role ${role}; select public.apply_booking_created('${id(1)}', 'x', now(), 'UTC', now())`), /permission denied/);
});

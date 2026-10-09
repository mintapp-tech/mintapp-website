// Database-level tests for supabase/migrations/20261005000000_add_inquiry_preparation.sql.
//   npm run test:db

import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { startCluster, lit } from "./pg-harness.mjs";

const MIGRATION = "20261005000000_add_inquiry_preparation.sql";
const LEGACY = "33333333-3333-4333-8333-333333333333";
let db;

const insertInquiry = (id, extra = "") =>
  db.psql(`insert into public.project_inquiries (id, full_name, email, preferred_language, project_description, consent_given, consent_at${extra ? ", booking_status, cal_booking_id, meeting_start_at" : ""})
           values (${lit(id)}, 'Test Client', 'client@example.com', 'en', 'A real project description.', true, now()${extra})`);
const prep = (id) => {
  const [status, attempts, lastError, generator] = db.psql(`select concat_ws('|', status, attempts, coalesce(last_error, '-'), coalesce(generator, '-')) from public.inquiry_preparations where inquiry_id = ${lit(id)}`).split("|");
  return { status, attempts: Number(attempts), lastError, generator };
};
const asService = (sql) => db.psql(`set role service_role; ${sql}`);
const claim = (provider = "mock", limit = 10) => asService(`select string_agg(inquiry_id::text || ':' || attempts, ',' order by inquiry_id) from public.claim_preparation_jobs(${lit(provider)}, ${limit}, 600)`);
// "Prepare now": the only way a pack is queued before a booking (a booking queues it too).
const prepareNow = (id) => asService(`select public.dashboard_retry_preparation(${lit(id)})`);
const queued = (id) => (insertInquiry(id), prepareNow(id));
const makeDue = (id) => db.psql(`update public.inquiry_preparations set next_attempt_at = now() - interval '1 second' where inquiry_id = ${lit(id)}`);

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

before(async () => {
  db = await startCluster();
  for (const file of db.migrations.filter((f) => f < MIGRATION)) db.applyMigration(file);
  // An inquiry that existed before preparation was introduced.
  insertInquiry(LEGACY);
  for (const file of db.migrations.filter((f) => f >= MIGRATION)) db.applyMigration(file);
});

after(() => db?.stop());

beforeEach(() => {
  db.psql(`delete from public.crm_activity; delete from public.inquiry_follow_ups; delete from public.preparation_drafts; delete from public.generation_usage; delete from public.automation_control;
           delete from public.inquiry_preparations where inquiry_id <> ${lit(LEGACY)};
           delete from public.project_inquiries where id <> ${lit(LEGACY)};`);
});

describe("every inquiry gets a job", () => {
  test("existing inquiries are backfilled as manual, never queued for automation", () => {
    assert.deepEqual(prep(LEGACY), { status: "manual", attempts: 0, lastError: "-", generator: "manual" });
    assert.equal(claim(), "");
  });

  test("a new inquiry gets its job in the same transaction, waiting for a booking (nothing is generated yet)", () => {
    insertInquiry(A);
    assert.equal(prep(A).status, "waiting_booking");
    assert.equal(claim(), "", "a job waiting for a booking is never claimed");
    assert.equal(prepareNow(A), "t", "Prepare now queues it");
    assert.equal(prep(A).status, "queued");
  });

  test("booking the meeting queues the waiting job", () => {
    insertInquiry(A);
    db.psql(`update public.project_inquiries set booking_status = 'booked', cal_booking_id = 'uid-q', meeting_start_at = now() + interval '3 days' where id = ${lit(A)}`);
    assert.equal(prep(A).status, "queued");
    assert.equal(claim(), `${A}:1`);
  });

  test("the live form's insert (as service_role, returning the id) still succeeds and creates its job", () => {
    // Mirrors src/lib/insert-inquiry.ts: the trigger runs with the caller's
    // privileges, so a missing grant would break public submissions.
    const id = asService(`insert into public.project_inquiries (full_name, email, project_description, preferred_language, consent_given, consent_at, source_page, submission_token)
                          values ('Form Client', 'form@example.com', 'Submitted through the public form.', 'ar', true, now(), '/ar/start', ${lit(B)}) returning id`).split("\n")[0];
    assert.match(id, /^[0-9a-f-]{36}$/);
    assert.equal(prep(id).status, "waiting_booking");
  });

  test("if the inquiry insert rolls back, no orphan job remains; if it commits, the job exists", () => {
    db.psqlExpectError(`begin; insert into public.project_inquiries (id, full_name, email, preferred_language, project_description, consent_given, consent_at) values (${lit(A)}, 'X', 'x@example.com', 'en', 'Desc', true, now()); select 1/0; commit;`);
    assert.equal(Number(db.psql(`select count(*) from public.inquiry_preparations where inquiry_id = ${lit(A)}`)), 0);
    insertInquiry(A);
    assert.equal(Number(db.psql(`select count(*) from public.inquiry_preparations where inquiry_id = ${lit(A)}`)), 1);
  });
});

describe("worker lifecycle", () => {
  test("claim -> complete saves draft version 1; a second run saves version 2", () => {
    queued(A);
    assert.equal(claim(), `${A}:1`);
    assert.equal(prep(A).status, "running");
    assert.equal(claim(), "", "a running job is not claimed twice");
    assert.equal(asService(`select public.complete_preparation(${lit(A)}, '{"summary":"x"}', 'mock', 'mock-v1')`), "1");
    assert.equal(prep(A).status, "succeeded");
    // A regenerate request requeues the job; the next draft is version 2.
    db.psql(`update public.inquiry_preparations set status = 'queued', attempts = 0, next_attempt_at = now() where inquiry_id = ${lit(A)}`);
    claim();
    assert.equal(asService(`select public.complete_preparation(${lit(A)}, '{"summary":"y"}', 'mock', 'mock-v1')`), "2");
    assert.equal(db.psql(`select string_agg(version::text || ':' || review_status, ',' order by version) from public.preparation_drafts where inquiry_id = ${lit(A)}`), "1:draft,2:draft");
  });

  test("completing a job the worker no longer holds is refused", () => {
    queued(A);
    assert.equal(asService(`select public.complete_preparation(${lit(A)}, '{}', 'mock', null)`), "");
    assert.equal(Number(db.psql("select count(*) from public.preparation_drafts")), 0);
  });

  test("retryable failures back off and are retried, then fail visibly after max attempts", () => {
    queued(A);
    for (let attempt = 1; attempt <= 3; attempt++) {
      assert.equal(claim(), `${A}:${attempt}`);
      const status = asService(`select public.fail_preparation(${lit(A)}, 'timeout', true, 0)`);
      assert.equal(status, attempt < 3 ? "retry_scheduled" : "failed");
      if (attempt < 3) {
        assert.equal(claim(), "", "not retried before its backoff");
        const delay = Number(db.psql(`select round(extract(epoch from next_attempt_at - now())) from public.inquiry_preparations where inquiry_id = ${lit(A)}`));
        assert.ok(delay >= 60 * 2 ** (attempt - 1) - 2, `backoff ${delay}s`);
        makeDue(A);
      }
    }
    assert.deepEqual(prep(A), { status: "failed", attempts: 3, lastError: "timeout", generator: "mock" });
    assert.equal(claim(), "", "a failed job is never picked up again automatically");
  });

  test("a non-retryable failure fails immediately and stays visible", () => {
    queued(A);
    claim();
    assert.equal(asService(`select public.fail_preparation(${lit(A)}, 'invalid_output', false, null)`), "failed");
    assert.equal(prep(A).lastError, "invalid_output");
  });

  test("a crashed worker's job is reclaimed after its lease expires, and failed once attempts run out", () => {
    queued(A);
    claim();
    db.psql(`update public.inquiry_preparations set lease_expires_at = now() - interval '1 second' where inquiry_id = ${lit(A)}`);
    assert.equal(claim(), `${A}:2`);
    db.psql(`update public.inquiry_preparations set attempts = max_attempts, lease_expires_at = now() - interval '1 second' where inquiry_id = ${lit(A)}`);
    assert.equal(claim(), "");
    assert.equal(prep(A).status, "failed");
    assert.equal(prep(A).lastError, "lease_expired");
  });

  test("deleted inquiries are never processed", () => {
    queued(A);
    db.psql(`update public.project_inquiries set deleted_at = now() where id = ${lit(A)}`);
    assert.equal(claim(), "");
  });

  test("concurrent workers never claim the same job", async () => {
    queued(A);
    queued(B);
    const sql = `set role service_role; begin; select string_agg(inquiry_id::text, ',') from public.claim_preparation_jobs('mock', 1, 600); select pg_sleep(1); commit;`;
    const [one, two] = await Promise.all([db.psqlAsync(sql), db.psqlAsync(sql)]);
    assert.equal(one.code + two.code, 0, one.err + two.err);
    const claimed = [one.out, two.out].map((o) => o.split("\n")[0].trim()).filter(Boolean).sort();
    assert.deepEqual(claimed, [A, B].sort());
  });
});

describe("pausing on quota or budget", () => {
  test("pause stops claims for that provider without spending the attempt; resume requeues", () => {
    queued(A);
    queued(B);
    claim("codecraft", 1);
    const held = db.psql("select inquiry_id from public.inquiry_preparations where status = 'running'");
    asService(`select public.pause_preparation_automation('codecraft', 'quota_exhausted', ${lit(held)})`);
    assert.deepEqual(prep(held), { status: "paused", attempts: 0, lastError: "quota_exhausted", generator: "codecraft" });
    assert.equal(claim("codecraft"), "", "nothing is claimed while paused");
    assert.notEqual(claim("mock"), "", "other providers are unaffected");
    db.psql("update public.inquiry_preparations set status = 'queued', lease_expires_at = null, attempts = 0 where status = 'running'");
    assert.equal(asService("select public.resume_preparation_automation('codecraft')"), "1");
    assert.equal(prep(held).status, "queued");
    assert.notEqual(claim("codecraft"), "");
  });
});

describe("usage accounting", () => {
  test("monthly tokens count only this month and this provider", () => {
    insertInquiry(A);
    asService(`select public.record_generation_usage(${lit(A)}, 'codecraft', 'm', 1200, 800, 2000, 'succeeded')`);
    asService(`select public.record_generation_usage(${lit(A)}, 'codecraft', 'm', 100, 0, 100, 'invalid_output')`);
    asService(`select public.record_generation_usage(${lit(A)}, 'mock', 'm', 5, 5, 10, 'succeeded')`);
    db.psql(`insert into public.generation_usage (provider, total_tokens, outcome, created_at) values ('codecraft', 999999, 'succeeded', now() - interval '40 days')`);
    assert.equal(asService("select public.monthly_generation_tokens('codecraft')"), "2100");
  });
});

describe("independent of meetings", () => {
  test("cancelling or rescheduling the meeting leaves preparation and drafts untouched", () => {
    queued(A);
    claim();
    asService(`select public.complete_preparation(${lit(A)}, '{"summary":"x"}', 'mock', null)`);
    db.psql(`update public.project_inquiries set booking_status = 'booked', cal_booking_id = 'uid-1', meeting_start_at = now() + interval '3 days' where id = ${lit(A)}`);
    db.psql(`update public.project_inquiries set cal_booking_id = 'uid-2', meeting_start_at = now() + interval '5 days' where id = ${lit(A)}`);
    db.psql(`update public.project_inquiries set booking_status = 'cancelled' where id = ${lit(A)}`);
    assert.equal(prep(A).status, "succeeded");
    assert.equal(Number(db.psql(`select count(*) from public.preparation_drafts where inquiry_id = ${lit(A)}`)), 1);
  });
});

describe("access", () => {
  test("only service_role can read the tables or run the functions", () => {
    for (const role of ["anon", "authenticated"]) {
      for (const table of ["inquiry_preparations", "preparation_drafts", "generation_usage", "automation_control"]) {
        assert.match(db.psqlExpectError(`set role ${role}; select count(*) from public.${table};`), /permission denied/);
      }
      assert.match(db.psqlExpectError(`set role ${role}; select * from public.claim_preparation_jobs('mock', 1, 60);`), /permission denied/);
    }
  });
});

// Database-level tests for supabase/migrations/20261006000000_add_preparation_dashboard.sql,
// including the full lifecycle of one inquiry through the real booking functions.
//   npm run test:db

import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { startCluster, lit } from "./pg-harness.mjs";

let db;
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const svc = (sql) => db.psql(`set role service_role; ${sql}`);
const json = (sql) => JSON.parse(svc(sql) || "null");
const insertInquiry = (id, extra = {}) =>
  db.psql(`insert into public.project_inquiries (id, full_name, email, phone, company_name, preferred_language, project_description, budget_range, consent_given, consent_at)
           values (${lit(id)}, 'Synthetic Client', 'synthetic@example.com', '+20100000000', 'Synthetic Co', ${lit(extra.lang ?? "en")}, ${lit(extra.desc ?? "We run three clinics and want online booking.")}, ${lit(extra.budget ?? null)}, true, now())`);
const prep = (id) => json(`select to_jsonb(p) from public.inquiry_preparations p where inquiry_id = ${lit(id)}`);
const detail = (id) => json(`select public.dashboard_inquiry(${lit(id)})`);
const saveDraft = (id, body, source = "manual", author = "omar@mintapp.tech") =>
  svc(`select public.dashboard_save_draft(${lit(id)}, ${lit(JSON.stringify({ format: "text", body }))}::jsonb, ${lit(source)}, ${lit(author)})`);
const review = (id, version, to, who = "adam@mintapp.tech") => svc(`select public.dashboard_review(${lit(id)}, ${version}, ${lit(to)}, ${lit(who)})`);

before(async () => {
  db = await startCluster();
  for (const file of db.migrations) db.applyMigration(file);
});
after(() => db?.stop());
beforeEach(() => {
  db.psql(`delete from public.inquiry_notes; delete from public.preparation_drafts; delete from public.generation_usage; delete from public.automation_control;
           delete from public.team_login_attempts; delete from public.inquiry_preparations; delete from public.project_inquiries;`);
});

describe("reads", () => {
  test("preparation input carries the brief and structured answers, never contact details", () => {
    insertInquiry(A, { budget: "Not sure yet" });
    const input = json(`select public.preparation_input(${lit(A)})`);
    assert.deepEqual(Object.keys(input).sort(), ["budget_range", "country", "preferred_language", "project_description", "project_type", "timeline"]);
    assert.doesNotMatch(JSON.stringify(input), /Synthetic Client|synthetic@example|\+2010|Synthetic Co/);
  });

  test("Arabic text is stored and read back unchanged", () => {
    const desc = "لدينا مدرسة خاصة في الإسكندرية، ونريد التقديم أونلاين.";
    insertInquiry(A, { lang: "ar", desc });
    assert.equal(detail(A).inquiry.project_description, desc);
    assert.equal(json(`select public.preparation_input(${lit(A)})`).project_description, desc);
  });

  test("list and detail show statuses side by side; deleted inquiries are hidden", () => {
    insertInquiry(A);
    insertInquiry(B);
    db.psql(`update public.project_inquiries set deleted_at = now() where id = ${lit(B)}`);
    const list = json("select public.dashboard_inquiries()");
    assert.equal(list.length, 1);
    assert.equal(list[0].booking_status, "not_booked");
    assert.equal(list[0].preparation_status, "queued");
    assert.equal(detail(B), null);
  });
});

describe("drafts and review", () => {
  test("a pasted manual draft becomes a new version and hands a failed job over to manual", () => {
    insertInquiry(A);
    db.psql(`update public.inquiry_preparations set status = 'failed', attempts = 3, last_error = 'invalid_output' where inquiry_id = ${lit(A)}`);
    assert.equal(saveDraft(A, "Manual preparation from Claude Pro, edited."), "1");
    assert.equal(prep(A).status, "manual");
    assert.equal(saveDraft(A, "Edited again.", "edited"), "2");
    const drafts = detail(A).drafts;
    assert.deepEqual(drafts.map((d) => [d.version, d.source, d.review_status, d.created_by]), [
      [2, "edited", "draft", "omar@mintapp.tech"],
      [1, "manual", "draft", "omar@mintapp.tech"],
    ]);
    assert.match(db.psqlExpectError(`set role service_role; select public.dashboard_save_draft(${lit(A)}, '{}'::jsonb, 'codecraft', 'x')`), /invalid draft source/);
  });

  test("review follows draft -> ready -> approved; approving supersedes the earlier approval", () => {
    insertInquiry(A);
    saveDraft(A, "v1");
    saveDraft(A, "v2");
    assert.equal(review(A, 1, "approved"), "f", "a draft cannot be approved without being ready for review");
    assert.equal(review(A, 1, "in_review"), "t");
    assert.equal(review(A, 1, "approved"), "t");
    assert.equal(review(A, 2, "in_review"), "t");
    assert.equal(review(A, 2, "approved"), "t");
    const states = Object.fromEntries(detail(A).drafts.map((d) => [d.version, [d.review_status, d.reviewed_by]]));
    assert.deepEqual(states, { 1: ["superseded", "adam@mintapp.tech"], 2: ["approved", "adam@mintapp.tech"] });
    assert.equal(review(A, 2, "draft"), "t", "an approval can be withdrawn");
    assert.equal(review(A, 9, "in_review"), "f");
  });
});

describe("owner, notes, retry", () => {
  test("owner and next action are stored; notes keep history and reject empty text", () => {
    insertInquiry(A);
    assert.equal(svc(`select public.dashboard_assign(${lit(A)}, 'adam@mintapp.tech', 'Call after reviewing the draft')`), "t");
    svc(`select public.dashboard_add_note(${lit(A)}, 'omar@mintapp.tech', 'First note')`);
    svc(`select public.dashboard_add_note(${lit(A)}, 'adam@mintapp.tech', 'Second note')`);
    const d = detail(A);
    assert.equal(d.inquiry.assigned_to, "adam@mintapp.tech");
    assert.deepEqual(d.notes.map((n) => n.body), ["Second note", "First note"]);
    assert.match(db.psqlExpectError(`set role service_role; select public.dashboard_add_note(${lit(A)}, 'x', '   ')`), /inquiry_notes_body_length/);
  });

  test("retry hands a failed or paused job back to automation with a fresh attempt budget", () => {
    insertInquiry(A);
    db.psql(`update public.inquiry_preparations set status = 'failed', attempts = 3, last_error = 'timeout' where inquiry_id = ${lit(A)}`);
    assert.equal(svc(`select public.dashboard_retry_preparation(${lit(A)})`), "t");
    assert.equal(prep(A).status, "queued");
    assert.equal(prep(A).attempts, 0);
    assert.equal(svc(`select public.dashboard_retry_preparation(${lit(A)})`), "f", "a queued job is not reset again");
  });
});

describe("prepare one inquiry now", () => {
  test("claims only that inquiry's waiting job, even before its retry time, and not while paused", () => {
    insertInquiry(A);
    insertInquiry(B);
    db.psql(`update public.inquiry_preparations set status = 'retry_scheduled', attempts = 1, next_attempt_at = now() + interval '1 hour' where inquiry_id = ${lit(A)}`);
    assert.equal(svc(`select string_agg(inquiry_id::text || ':' || attempts, ',') from public.claim_preparation_job_for('mock', ${lit(A)}, 300)`), `${A}:2`);
    assert.equal(prep(B).status, "queued", "other inquiries are untouched");
    assert.equal(svc(`select count(*) from public.claim_preparation_job_for('mock', ${lit(A)}, 300)`), "0", "a running job is not claimed again");
    svc(`select public.pause_preparation_automation('mock', 'quota_exhausted', null)`);
    assert.equal(svc(`select count(*) from public.claim_preparation_job_for('mock', ${lit(B)}, 300)`), "0");
  });
});

describe("login throttling", () => {
  test("8 failures lock the key for 15 minutes; success clears it", () => {
    const key = "a".repeat(64);
    for (let i = 1; i <= 7; i++) assert.equal(svc(`select public.team_login_record(${lit(key)}, false)`), "f");
    assert.equal(svc(`select public.team_login_locked(${lit(key)})`), "f");
    assert.equal(svc(`select public.team_login_record(${lit(key)}, false)`), "t");
    assert.equal(svc(`select public.team_login_locked(${lit(key)})`), "t");
    svc(`select public.team_login_record(${lit(key)}, true)`);
    assert.equal(svc(`select public.team_login_locked(${lit(key)})`), "f");
    assert.match(db.psqlExpectError(`set role service_role; select public.team_login_record('not-a-hash', false)`), /key_shape/);
  });
});

describe("one inquiry, end to end through the real booking functions", () => {
  test("prepared without a booking; then booked, rescheduled, cancelled, a generator failure and manual recovery: nothing is lost", () => {
    insertInquiry(A);
    // Prepared with no booking at all (mock content stands in for any generator).
    svc(`select * from public.claim_preparation_jobs('mock', 1, 300)`);
    assert.equal(svc(`select public.complete_preparation(${lit(A)}, '{"summary":"[MOCK] prepared"}', 'mock', 'mock-v1')`), "1");
    svc(`select public.dashboard_add_note(${lit(A)}, 'omar@mintapp.tech', 'Looks like a good fit')`);

    // Booking lifecycle via the production booking functions.
    assert.equal(svc(`select public.apply_booking_created(${lit(A)}, 'uid-1', now() + interval '3 days', 'Africa/Cairo', now())`) !== "", true);
    svc(`select public.apply_booking_rescheduled(${lit(A)}, 'uid-1', 'uid-2', now() + interval '5 days', 'Africa/Cairo', now() + interval '1 minute')`);
    let d = detail(A);
    assert.equal(d.meeting.booking_status, "booked");
    assert.equal(d.meeting.cal_booking_id, "uid-2");
    svc(`select public.apply_booking_cancelled(${lit(A)}, 'uid-2', now() + interval '5 days', 'Africa/Cairo', now() + interval '2 minutes')`);
    d = detail(A);
    assert.equal(d.meeting.booking_status, "cancelled");
    assert.equal(d.preparation.status, "succeeded");
    assert.equal(d.drafts.length, 1);
    assert.equal(d.notes.length, 1);

    // Regenerate, and the generator fails until attempts run out.
    svc(`select public.dashboard_retry_preparation(${lit(A)})`);
    for (let i = 0; i < 3; i++) {
      db.psql(`update public.inquiry_preparations set next_attempt_at = now() where inquiry_id = ${lit(A)}`);
      svc(`select * from public.claim_preparation_jobs('codecraft', 1, 300)`);
      svc(`select public.fail_preparation(${lit(A)}, 'invalid_output', true, 0)`);
    }
    d = detail(A);
    assert.equal(d.preparation.status, "failed");
    assert.equal(d.preparation.last_error, "invalid_output");
    assert.equal(d.drafts.length, 1, "the earlier draft survives the failed attempts");

    // Manual recovery: paste, mark ready, approve.
    assert.equal(saveDraft(A, "Manual brief prepared outside the site and pasted here."), "2");
    assert.equal(review(A, 2, "in_review", "omar@mintapp.tech"), "t");
    assert.equal(review(A, 2, "approved"), "t");
    d = detail(A);
    assert.equal(d.preparation.status, "manual");
    assert.deepEqual(d.drafts.map((x) => [x.version, x.review_status]), [[2, "approved"], [1, "draft"]]);
    assert.equal(d.meeting.booking_status, "cancelled");
    assert.equal(d.notes.length, 1);
  });
});

describe("access", () => {
  test("anon and authenticated cannot call the dashboard functions or read notes", () => {
    for (const role of ["anon", "authenticated"]) {
      assert.match(db.psqlExpectError(`set role ${role}; select public.dashboard_inquiries();`), /permission denied/);
      assert.match(db.psqlExpectError(`set role ${role}; select count(*) from public.inquiry_notes;`), /permission denied/);
      assert.match(db.psqlExpectError(`set role ${role}; select public.team_login_locked('${"a".repeat(64)}');`), /permission denied/);
    }
  });
});

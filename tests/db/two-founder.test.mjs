// Database tests for the corrected two-founder workflow
// (supabase/migrations/20261015000000 and 20261016000000): the pack waits for a
// booking, the booking-triggered review action, the three versioned artifacts and
// their review, lead and deal fields, settings, and the simplified reads.
//   npm run test:db

import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { startCluster, lit } from "./pg-harness.mjs";

let db;
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OMAR = "omar@mintapp.tech";
const ADAM = "adam@mintapp.tech";
const svc = (sql) => db.psql(`set role service_role; ${sql}`);
const json = (sql) => JSON.parse(svc(sql) || "null");
const fail = (sql) => db.psqlExpectError(`set role service_role; ${sql}`);
const obj = (o) => `${lit(JSON.stringify(o))}::jsonb`;
const count = (sql) => Number(db.psql(sql));
const insertInquiry = (id, o = {}) =>
  db.psql(`insert into public.project_inquiries (id, full_name, email, phone, company_name, preferred_language, project_type, project_description, budget_range, timeline, company_url, consent_given, consent_at, owners)
           values (${lit(id)}, ${lit(o.name ?? "Pack Client")}, 'pack@two-founder.invalid', '+20 100 555 0101', ${lit(o.company ?? "Pack Co")}, 'en', 'web_app', 'We run 3 clinics and want online booking.', 'Not sure yet', 'Within 3 months', 'https://pack.example.com/', true, now(), ${lit(o.owners ?? "{}")})`);
const job = (id) => db.psql(`select status from public.inquiry_preparations where inquiry_id = ${lit(id)}`);
const book = (id, uid, days) => svc(`select public.apply_booking_created(${lit(id)}, ${lit(uid)}, now() + interval '${days} days', 'Africa/Cairo', now())`);
const reviewAction = (id) => db.psql(`select coalesce(owner, 'none') || '|' || due_on || '|' || (done_at is not null) || '|' || coalesce(done_by, '-') from public.inquiry_follow_ups where inquiry_id = ${lit(id)} and kind = 'pack_review' order by created_at desc limit 1`);
const cairoDate = (days) => db.psql(`select ((now() + interval '${days} days') at time zone 'Africa/Cairo')::date`);
const claim = () => svc(`select string_agg(inquiry_id::text, ',') from public.claim_preparation_jobs('mock', 10, 300)`);
const PACK = { design: { format: "pack-design", pattern: "booking_service" }, proposal: { format: "pack-proposal", summary: "x" }, discovery: { format: "pack-discovery", questions: [] } };

before(async () => {
  db = await startCluster();
  for (const file of db.migrations) db.applyMigration(file);
});
after(() => db?.stop());
beforeEach(() => {
  db.clearData();
  db.psql("delete from public.crm_settings");
});

describe("no generation before a booking", () => {
  test("a new inquiry waits for a booking and is never claimed; Prepare now queues it", () => {
    insertInquiry(A);
    assert.equal(job(A), "waiting_booking");
    assert.equal(claim(), "");
    assert.equal(svc(`select public.dashboard_retry_preparation(${lit(A)})`), "t");
    assert.equal(claim(), A);
  });

  test("a pack the team prepared by hand before the booking is not taken over by automation after it", () => {
    insertInquiry(A);
    svc(`select public.pack_save_all(${lit(A)}, ${obj(PACK)}, 'manual', ${lit(OMAR)})`);
    assert.equal(job(A), "manual");
    book(A, "m-1", 4);
    assert.equal(job(A), "manual");
    assert.equal(claim(), "");
  });
});

describe("the booking-triggered review action", () => {
  test("booking queues the pack and creates one action due the day before the meeting, owned by the inquiry's owner", () => {
    insertInquiry(A, { owners: "{omar}" });
    book(A, "b-1", 5);
    assert.equal(job(A), "queued");
    assert.equal(reviewAction(A), `omar|${cairoDate(4)}|false|-`);
    assert.equal(db.psql(`select action from public.inquiry_follow_ups where inquiry_id = ${lit(A)} and kind = 'pack_review'`), "Review and approve the pre-meeting pack");
  });

  test("owner rule: the default owner when they own it, else the first owner, else the default, else nobody yet", () => {
    svc(`select public.crm_set_setting('default_owner', 'adam', ${lit(OMAR)})`);
    insertInquiry(A, { owners: "{adam,omar}" });
    book(A, "o-1", 5);
    assert.ok(reviewAction(A).startsWith("adam|"));
    insertInquiry(B, { owners: "{omar}" });
    book(B, "o-2", 5);
    assert.ok(reviewAction(B).startsWith("omar|"));
    db.psql("delete from public.crm_settings");
    const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    insertInquiry(C);
    book(C, "o-3", 5);
    assert.ok(reviewAction(C).startsWith("none|"), "no owner and no default: shown as needing an owner");
    // As soon as the inquiry gets an owner, the action has one.
    svc(`select public.crm_set_owners(${lit(C)}, '["omar"]', ${lit(OMAR)})`);
    assert.ok(reviewAction(C).startsWith("omar|"));
  });

  test("a meeting tomorrow or today is due today, never in the past", () => {
    insertInquiry(A);
    book(A, "s-1", 0.1);
    assert.equal(reviewAction(A).split("|")[1], cairoDate(0));
  });

  test("rescheduling moves the deadline; cancelling closes the action and keeps every artifact; rebooking makes a new one", () => {
    insertInquiry(A, { owners: "{omar}" });
    book(A, "r-1", 5);
    svc(`select public.dashboard_retry_preparation(${lit(A)})`);
    svc(`select * from public.claim_preparation_job_for('mock', ${lit(A)}, 300)`);
    svc(`select public.complete_pack(${lit(A)}, ${obj(PACK)}, 'mock', 'mock-v1')`);
    svc(`select public.apply_booking_rescheduled(${lit(A)}, 'r-1', 'r-2', now() + interval '9 days', 'Africa/Cairo', now() + interval '1 minute')`);
    assert.equal(reviewAction(A), `omar|${cairoDate(8)}|false|-`);
    svc(`select public.apply_booking_cancelled(${lit(A)}, 'r-2', now() + interval '9 days', 'Africa/Cairo', now() + interval '2 minutes')`);
    assert.equal(reviewAction(A), `omar|${cairoDate(8)}|true|system`);
    assert.equal(count(`select count(*) from public.preparation_drafts where inquiry_id = ${lit(A)}`), 3, "the pack is kept");
    assert.equal(job(A), "succeeded");
    svc(`select public.apply_booking_created(${lit(A)}, 'r-3', now() + interval '12 days', 'Africa/Cairo', now() + interval '3 minutes')`);
    assert.equal(count(`select count(*) from public.inquiry_follow_ups where inquiry_id = ${lit(A)} and kind = 'pack_review' and done_at is null`), 1);
    assert.equal(reviewAction(A), `omar|${cairoDate(11)}|false|-`);
  });

  test("a failure in the action logic can never stop a booking from being recorded", () => {
    insertInquiry(A);
    db.psql("revoke insert on public.inquiry_follow_ups from service_role");
    try {
      assert.equal(book(A, "w-1", 3), A);
    } finally {
      db.psql("grant insert on public.inquiry_follow_ups to service_role");
    }
    assert.equal(db.psql(`select booking_status from public.project_inquiries where id = ${lit(A)}`), "booked");
  });

  test("a person's follow-up always has an owner; only the automatic action may wait for one", () => {
    insertInquiry(A);
    assert.match(fail(`select public.dashboard_add_follow_up(${lit(A)}, 'x', null, current_date, 'x')`), /owner_required/);
    assert.match(fail(`insert into public.inquiry_follow_ups (inquiry_id, kind, action, owner, due_on, created_by) values (${lit(A)}, 'manual', 'x', null, current_date, 'x')`), /owner_required/);
    insertInquiry(B);
    book(B, "n-1", 4);
    const id = db.psql(`select id from public.inquiry_follow_ups where inquiry_id = ${lit(B)} and kind = 'pack_review'`);
    assert.equal(svc(`select public.crm_assign_follow_up(${lit(B)}, ${lit(id)}, 'adam', ${lit(OMAR)})`), "t");
    assert.ok(reviewAction(B).startsWith("adam|"));
    assert.match(fail(`select public.crm_assign_follow_up(${lit(B)}, ${lit(id)}, 'Not Valid', ${lit(OMAR)})`), /owner_shape/);
  });
});

describe("the Pre-meeting Pack", () => {
  test("a generated pack is three versions in one step, only from a job the worker holds", () => {
    insertInquiry(A);
    assert.equal(svc(`select public.complete_pack(${lit(A)}, ${obj(PACK)}, 'codecraft', 'm')`), "", "not running: refused");
    svc(`select public.dashboard_retry_preparation(${lit(A)})`);
    svc(`select * from public.claim_preparation_job_for('mock', ${lit(A)}, 300)`);
    assert.match(fail(`select public.complete_pack(${lit(A)}, ${obj({ design: {} })}, 'codecraft', 'm')`), /pack_incomplete/);
    assert.equal(svc(`select public.complete_pack(${lit(A)}, ${obj(PACK)}, 'codecraft', 'model-x')`), "3");
    assert.equal(db.psql(`select string_agg(version || ':' || artifact || ':' || source || ':' || review_status, ',' order by version) from public.preparation_drafts where inquiry_id = ${lit(A)}`),
      "1:design:codecraft:draft,2:proposal:codecraft:draft,3:discovery:codecraft:draft");
    assert.equal(job(A), "succeeded");
    assert.equal(json(`select public.pack_latest(${lit(A)})`).design.unsupported, false);
    // A generated design that no library pattern fits is flagged for a hand-made design.
    svc(`select public.pack_save_artifact(${lit(A)}, 'design', ${obj({ format: "pack-design", blueprint: { pattern: null, unsupported_reason: "x" }, screens: [], user_flow: [] })}, 'manual', ${lit(OMAR)})`);
    assert.equal(json(`select public.pack_latest(${lit(A)})`).design.unsupported, true);
  });

  test("an edit is a new version of one artifact; every version is kept", () => {
    insertInquiry(A);
    svc(`select public.pack_save_all(${lit(A)}, ${obj(PACK)}, 'manual', ${lit(OMAR)})`);
    assert.equal(svc(`select public.pack_save_artifact(${lit(A)}, 'proposal', ${obj({ format: "text", body: "edited" })}, 'edited', ${lit(ADAM)})`), "4");
    const latest = json(`select public.pack_latest(${lit(A)})`);
    assert.deepEqual([latest.design.version, latest.proposal.version, latest.discovery.version], [1, 4, 3]);
    assert.equal(latest.proposal.created_by, ADAM);
    assert.equal(count(`select count(*) from public.preparation_drafts where inquiry_id = ${lit(A)}`), 4);
    assert.match(fail(`select public.pack_save_artifact(${lit(A)}, 'contract', '{}', 'manual', 'x')`), /invalid_artifact/);
    assert.match(fail(`select public.pack_save_artifact(${lit(A)}, 'design', '{}', 'codecraft', 'x')`), /invalid draft source/);
  });

  test("approval is per artifact: approving one never supersedes another artifact's approval", () => {
    insertInquiry(A);
    svc(`select public.pack_save_all(${lit(A)}, ${obj(PACK)}, 'manual', ${lit(OMAR)})`);
    for (const v of [1, 2, 3]) {
      svc(`select public.dashboard_review(${lit(A)}, ${v}, 'in_review', ${lit(OMAR)})`);
      svc(`select public.dashboard_review(${lit(A)}, ${v}, 'approved', ${lit(ADAM)})`);
    }
    assert.equal(db.psql(`select string_agg(review_status, ',' order by version) from public.preparation_drafts where inquiry_id = ${lit(A)}`), "approved,approved,approved");
    svc(`select public.pack_save_artifact(${lit(A)}, 'design', ${obj({ format: "text", body: "v2" })}, 'edited', ${lit(ADAM)})`);
    svc(`select public.dashboard_review(${lit(A)}, 4, 'in_review', ${lit(ADAM)})`);
    svc(`select public.dashboard_review(${lit(A)}, 4, 'approved', ${lit(OMAR)})`);
    assert.equal(db.psql(`select string_agg(version || ':' || review_status, ',' order by version) from public.preparation_drafts where inquiry_id = ${lit(A)}`), "1:superseded,2:approved,3:approved,4:approved");
  });

  test("the input sent to a generator is kept for audit, and is bounded", () => {
    insertInquiry(A);
    assert.equal(svc(`select public.record_pack_payload(${lit(A)}, ${obj({ brief: "Project type: Web application", prompt_version: "pack-v1", model: "m" })})`), "t");
    assert.equal(json(`select public.lead_detail(${lit(A)})`).last_payload.prompt_version, "pack-v1");
    assert.match(fail(`select public.record_pack_payload(${lit(A)}, ${obj({ brief: "x".repeat(41000) })})`), /payload_shape/);
  });
});

describe("lead, deal and settings", () => {
  test("priority, a pause with its resume date, and the deal are saved and recorded", () => {
    insertInquiry(A);
    svc(`select public.crm_save_lead(${lit(A)}, ${obj({ priority: "high", paused_until: "2030-01-15" })}, ${lit(OMAR)})`);
    svc(`select public.crm_save_lead(${lit(A)}, ${obj({ contract_status: "signed", contract_signed_on: "2026-10-09", contract_reference: "MA-2026-001", commercial_notes: "Phase one" })}, ${lit(ADAM)})`);
    const d = json(`select public.lead_detail(${lit(A)})`);
    assert.equal(d.priority, "high");
    assert.equal(d.paused_until, "2030-01-15");
    assert.deepEqual(d.deal, { contract_status: "signed", contract_signed_on: "2026-10-09", contract_reference: "MA-2026-001", commercial_notes: "Phase one" });
    assert.equal(db.psql(`select string_agg(action, ',' order by action) from public.crm_activity where inquiry_id = ${lit(A)} and action in ('lead_paused', 'priority_changed', 'contract_status')`), "contract_status,lead_paused,priority_changed");
    svc(`select public.crm_save_lead(${lit(A)}, ${obj({ paused_until: "" })}, ${lit(OMAR)})`);
    assert.equal(json(`select public.lead_detail(${lit(A)})`).paused_until, null);
  });

  test("a signed contract needs its date; priorities and contract states come from the list", () => {
    insertInquiry(A);
    assert.match(fail(`select public.crm_save_lead(${lit(A)}, ${obj({ contract_status: "signed" })}, ${lit(OMAR)})`), /signed_has_date/);
    assert.match(fail(`select public.crm_save_lead(${lit(A)}, ${obj({ priority: "urgent" })}, ${lit(OMAR)})`), /priority_values/);
    assert.match(fail(`select public.crm_save_lead(${lit(A)}, ${obj({ contract_status: "maybe" })}, ${lit(OMAR)})`), /contract_values/);
  });

  test("the default owner must be a member id", () => {
    assert.equal(svc(`select public.crm_set_setting('default_owner', 'omar', ${lit(ADAM)})`), "t");
    assert.equal(json("select public.crm_get_settings()").default_owner.value, "omar");
    assert.match(fail(`select public.crm_set_setting('default_owner', 'Omar Ali', ${lit(ADAM)})`), /value_shape/);
    assert.match(fail(`select public.crm_set_setting('anything', 'x', ${lit(ADAM)})`), /key_values/);
  });
});

describe("simplified reads", () => {
  test("the lead list filters by simple stage groups, priority and pause, and carries no email or phone", () => {
    insertInquiry(A, { name: "Alpha", owners: "{omar}" });
    insertInquiry(B, { name: "Bravo" });
    svc(`select public.crm_set_stage(${lit(B)}, 'meeting_completed', ${lit(OMAR)})`);
    svc(`select public.crm_save_lead(${lit(A)}, ${obj({ priority: "high" })}, ${lit(OMAR)})`);
    svc(`select public.crm_save_lead(${lit(B)}, ${obj({ paused_until: "2030-01-01" })}, ${lit(OMAR)})`);
    const names = (f) => json(`select public.lead_list(${obj(f)})`).map((r) => r.client_name).sort();
    assert.deepEqual(names({}), ["Alpha", "Bravo"]);
    assert.deepEqual(names({ stages: ["meeting_booked", "preparing", "meeting_ready", "meeting_completed"] }), ["Bravo"]);
    assert.deepEqual(names({ priority: "high" }), ["Alpha"]);
    assert.deepEqual(names({ paused: "yes" }), ["Bravo"]);
    assert.deepEqual(names({ paused: "no" }), ["Alpha"]);
    assert.deepEqual(names({ stages: "not-an-array" }), ["Alpha", "Bravo"], "a malformed filter is ignored, never an error");
    assert.doesNotMatch(svc("select public.lead_list('{}')"), /two-founder\.invalid|555 0101/);
  });

  test("the command centre: actions with one owner, meetings, packs to review, leads awaiting a reply, alerts; no contact details", () => {
    insertInquiry(A, { company: "Alpha Co", owners: "{omar}" });
    insertInquiry(B, { company: "Bravo Co" });
    book(A, "c-1", 1);
    svc(`select public.pack_save_all(${lit(A)}, ${obj(PACK)}, 'manual', ${lit(OMAR)})`);
    svc(`select public.dashboard_review(${lit(A)}, 1, 'in_review', ${lit(OMAR)})`);
    db.psql(`update public.inquiry_preparations set status = 'failed', last_error = 'timeout' where inquiry_id = ${lit(B)}`);
    svc(`insert into public.crm_prospects (company_name, owner, created_by, follow_up_action, follow_up_owner, follow_up_due_on) values ('Prospect Co', 'adam', 'x', 'Touch 2', 'adam', current_date)`);
    const today = db.psql("select (now() at time zone 'Africa/Cairo')::date");
    const c = json(`select public.crm_command_centre(${lit(today)})`);
    assert.deepEqual(c.actions.map((a) => [a.kind, a.name, a.owner]).sort(), [["pack_review", "Alpha Co", "omar"], ["prospect", "Prospect Co", "adam"]]);
    assert.equal(c.meetings[0].name, "Alpha Co");
    assert.equal(c.meetings[0].booking_uid, "c-1");
    assert.equal(c.packs_to_review[0].name, "Alpha Co");
    assert.deepEqual(c.awaiting_response.map((r) => r.name), ["Bravo Co"]);
    assert.deepEqual(c.alerts.pack_problems.map((r) => r.name), ["Bravo Co"]);
    assert.deepEqual(c.alerts.unready_soon.map((r) => r.name), ["Alpha Co"]);
    assert.equal(c.alerts.unowned_actions.length, 0);
    assert.deepEqual(c.workload.map((w) => w.owner), ["adam", "omar"]);
    assert.doesNotMatch(JSON.stringify(c), /two-founder\.invalid|555 0101/);
  });

  test("Growth lists prospects by priority, without contact handles", () => {
    for (const [name, priority] of [["Low Co", "low"], ["High Co", "high"], ["None Co", null], ["Mid Co", "medium"]]) {
      svc(`insert into public.crm_prospects (company_name, owner, created_by, priority, contact_handle) values (${lit(name)}, 'omar', 'x', ${lit(priority)}, 'handle-secret')`);
    }
    const list = json("select public.growth_prospect_list()");
    assert.deepEqual(list.map((p) => p.company_name), ["High Co", "Mid Co", "Low Co", "None Co"]);
    assert.doesNotMatch(JSON.stringify(list), /handle-secret/);
    const id = list[3].id;
    assert.equal(svc(`select public.crm_set_prospect_priority(${lit(id)}, 'high', ${lit(OMAR)})`), "t");
    assert.match(fail(`select public.crm_set_prospect_priority(${lit(id)}, 'urgent', ${lit(OMAR)})`), /priority_values/);
  });
});

describe("access", () => {
  test("the public roles can read no new table and run no new function", () => {
    for (const role of ["anon", "authenticated"]) {
      assert.match(db.psqlExpectError(`set role ${role}; select count(*) from public.crm_settings`), /permission denied/);
      for (const call of [
        "public.crm_command_centre(current_date)", "public.lead_list('{}')", `public.lead_detail('${A}')`, "public.growth_prospect_list()", `public.pack_latest('${A}')`,
        `public.complete_pack('${A}', '{}', 'x', 'x')`, `public.pack_save_all('${A}', '{}', 'manual', 'x')`, `public.crm_save_lead('${A}', '{}', 'x')`, "public.crm_set_setting('default_owner', 'omar', 'x')",
      ]) {
        assert.match(db.psqlExpectError(`set role ${role}; select ${call}`), /permission denied/, `${role} ${call}`);
      }
    }
  });
});

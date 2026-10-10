// Rehearsal of the production launch of Operations/CRM v1 on a throwaway local
// database: the exact chain production already has, with realistic existing
// inquiries, then the two CRM migrations, then the recovery scripts.
//   npm run test:db
//
// What this proves for the launch runbook (docs/operations-crm-v1-launch.md):
// existing inquiries are untouched, every one gets a manual job, the public
// inquiry insert and the booking functions keep working, nothing is readable by
// the public database roles, applying twice is harmless, and both recovery
// scripts restore the database exactly.

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { startCluster, lit } from "./pg-harness.mjs";

// The migrations production had applied before this launch (all additive, in order).
const PRODUCTION_BEFORE = [
  "20260815000000_create_project_inquiries.sql",
  "20260822000000_align_constraints_and_add_submission_token.sql",
  "20260823000000_revoke_public_inquiry_privileges.sql",
  "20260823120000_allow_disabled_notification_status.sql",
  "20260824000000_add_cal_booking_event_ordering.sql",
  "20261004000000_allow_not_sure_project_type.sql",
  "20261007000000_allow_rebooking_after_cancellation.sql",
];
const CRM = ["20261005000000_add_inquiry_preparation.sql", "20261006000000_add_preparation_dashboard.sql"];
// CRM Release 1 adds to the two above, in order, after them.
const RELEASE_1 = [
  "20261010000000_add_admin_auth_throttle.sql",
  "20261011000000_add_crm_core.sql",
  "20261012000000_add_crm_proposals_projects.sql",
  "20261013000000_add_crm_outreach.sql",
  "20261014000000_add_crm_reads.sql",
];
// The corrected two-founder workflow, after Release 1.
const TWO_FOUNDER = ["20261015000000_add_two_founder_workflow.sql", "20261016000000_add_two_founder_reads.sql"];
const ROLLBACK_DIR = join(process.cwd(), "supabase", "rollback");

// The SQL in the launch runbook is run here, so the document cannot drift from the database.
const RUNBOOKS = { v1: readFileSync(join(process.cwd(), "docs", "operations-crm-v1-launch.md"), "utf8"), r1: readFileSync(join(process.cwd(), "docs", "crm-release-1-launch.md"), "utf8") };
const runbookSql = (heading, book = "v1") => {
  const RUNBOOK = RUNBOOKS[book];
  const start = RUNBOOK.indexOf(heading);
  assert.ok(start >= 0, `runbook heading not found: ${heading}`);
  const block = /```sql\r?\n([\s\S]*?)```/.exec(RUNBOOK.slice(start));
  assert.ok(block, `no sql block after: ${heading}`);
  return block[1];
};
const lines = (out) => out.split(/\r?\n/).filter((l) => l !== "");
let preChecks;

const id = (n) => `eeeeeeee-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [LEGACY, BOOKED, CANCELLED, NOT_SURE, DELETED, ARABIC] = [1, 2, 3, 4, 5, 6].map(id);
const NEW_INQUIRY = id(90);

let db;
const svc = (sql) => db.psql(`set role service_role; ${sql}`);
const count = (sql) => Number(db.psql(sql));
const applyRollback = (file) => db.applyFile(join(ROLLBACK_DIR, file));
const insertRow = (rowId, over = {}) =>
  db.psql(`insert into public.project_inquiries (id, full_name, email, phone, company_name, preferred_language, project_type, project_description, consent_given, consent_at, deleted_at)
           values (${lit(rowId)}, ${lit(over.name ?? "Existing Client")}, ${lit(`client-${rowId.slice(-2)}@example.com`)}, '+20100000000', 'Existing Co', ${lit(over.lang ?? "en")}, ${lit(over.type ?? null)}, ${lit(over.desc ?? "A real project description from before the dashboard existed.")}, true, now(), ${over.deleted ? "now()" : "null"})`);

// Every column of every existing inquiry as it was before launch. The new
// "owners", "utm_content" and "budget_currency" columns, added later, are excluded
// (budget_currency stays null on existing rows), so the same fingerprint works before and after.
const inquiryFingerprint = () => db.psql(`select md5(coalesce(string_agg((to_jsonb(t) - 'owners' - 'utm_content' - 'budget_currency')::text, '|' order by t.id), '')) from public.project_inquiries t`);

// What the database looks like to the application: tables, project_inquiries
// columns, public functions, triggers and constraints. Rolling back must restore it exactly.
const schemaFingerprint = () =>
  db.psql(`select md5(string_agg(x, '|' order by x)) from (
    select 'table:' || table_name as x from information_schema.tables where table_schema = 'public'
    union all select 'col:' || column_name || ':' || data_type || ':' || is_nullable || ':' || coalesce(column_default, '') from information_schema.columns where table_schema = 'public' and table_name = 'project_inquiries'
    union all select 'fn:' || p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
    union all select 'trg:' || tgname from pg_trigger where not tgisinternal and tgrelid = 'public.project_inquiries'::regclass
    union all select 'con:' || conname || ':' || pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.project_inquiries'::regclass
  ) s`);
const customFunctions = () => Number(db.psql(`select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and (p.proname like 'dashboard\\_%' or p.proname like '%preparation%' or p.proname = 'monthly_generation_tokens' or p.proname = 'record_generation_usage')`));

let before_;
before(async () => {
  db = await startCluster();
  for (const file of PRODUCTION_BEFORE) db.applyMigration(file);

  // Existing production inquiries, including the awkward ones.
  insertRow(LEGACY, { type: "other" }); // an older value the form no longer offers
  insertRow(BOOKED, { type: "web_app" });
  insertRow(CANCELLED, { type: "mobile_app" });
  insertRow(NOT_SURE, { type: "not_sure" });
  insertRow(DELETED, { type: "website", deleted: true });
  insertRow(ARABIC, { name: "عميل قائم", lang: "ar", desc: "مشروع قديم قبل اللوحة." });
  svc(`select public.apply_booking_created(${lit(BOOKED)}, 'prod-booking-a', '2026-10-20 09:00:00+00', 'Africa/Cairo', '2026-10-07 10:00:00+00')`);
  svc(`select public.apply_booking_created(${lit(CANCELLED)}, 'prod-booking-b', '2026-10-21 09:00:00+00', 'Africa/Cairo', '2026-10-07 10:00:00+00')`);
  svc(`select public.apply_booking_cancelled(${lit(CANCELLED)}, 'prod-booking-b', '2026-10-21 09:00:00+00', 'Africa/Cairo', '2026-10-07 10:05:00+00')`);
  before_ = { inquiries: inquiryFingerprint(), schema: schemaFingerprint(), rows: count("select count(*) from public.project_inquiries") };
});
after(() => db?.stop());

describe("the chain used here is the one production has", () => {
  test("the CRM migrations are exactly the ones not yet applied, and nothing else is pending or excluded by accident", () => {
    const onDisk = readdirSync(join(process.cwd(), "supabase", "migrations")).filter((f) => f.endsWith(".sql")).sort();
    assert.deepEqual([...PRODUCTION_BEFORE, ...CRM, ...RELEASE_1, ...TWO_FOUNDER].sort(), onDisk, "supabase/migrations changed: update the runbook and this rehearsal");
  });
  test("the runbook's pre-check queries run and show the documented pre-launch state", () => {
    preChecks = lines(db.psql(runbookSql("## 4. Pre-checks")));
    // A: no CRM functions, no CRM tables, crm_absent = true (no owners column: no row). B: not_sure allowed, rebooking allowed.
    // C: 6 inquiries, 1 soft-deleted, then the two fingerprints.
    assert.deepEqual(preChecks.slice(0, 6), ["0", "0", "t", "t", "t", "6|1"]);
    assert.match(preChecks[6], /^[0-9a-f]{32}$/);
    assert.match(preChecks[7], /^[0-9a-f]{32}$/);
    assert.equal(preChecks.length, 8);
  });
  test("before the upgrade there are no CRM objects", () => {
    assert.equal(customFunctions(), 0);
    assert.equal(count("select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('inquiry_preparations','preparation_drafts','inquiry_follow_ups','inquiry_notes')"), 0);
    assert.equal(before_.rows, 6);
  });
});

describe("applying the two CRM migrations, file by file, in order", () => {
  let post8;
  let post9;
  before(() => {
    // As the runbook says: one file at a time, its post-checks after each.
    db.applyMigration(CRM[0]);
    post8 = lines(db.psql(runbookSql("### Post-checks for file 8")));
    db.applyMigration(CRM[1]);
    post9 = lines(db.psql(runbookSql("### Post-checks for file 9")));
  });

  test("the runbook's post-checks for file 8 give exactly the documented results", () => {
    // one job each, 'manual | 6', one trigger, and the inquiries fingerprint equals the recorded 'before' value
    assert.deepEqual(post8, ["t", "manual|6", "1", preChecks[6]]);
  });

  test("the runbook's post-checks for file 9 give exactly the documented results", () => {
    // fingerprint equals the recorded 'before' value; 0 owned; 0 other rows; no public read access and no public execute (no rows); RLS on for all six tables
    assert.equal(post9[0], preChecks[7]);
    assert.deepEqual(post9.slice(1, 3), ["0", "0"]);
    const rls = post9.slice(3);
    assert.equal(rls.length, 6, "six tables, nothing listed for the public roles");
    assert.ok(rls.every((l) => /\|t$/.test(l)), rls.join(", "));
  });

  test("every existing inquiry is exactly as it was, including deleted, legacy-type, booked and cancelled ones", () => {
    assert.equal(count("select count(*) from public.project_inquiries"), before_.rows);
    assert.equal(inquiryFingerprint(), before_.inquiries);
    assert.equal(db.psql(`select booking_status || '|' || cal_booking_id from public.project_inquiries where id = ${lit(BOOKED)}`), "booked|prod-booking-a");
    assert.equal(db.psql(`select booking_status from public.project_inquiries where id = ${lit(CANCELLED)}`), "cancelled");
  });

  test("every existing inquiry gets one manual preparation record, none queued for automation", () => {
    assert.equal(count("select count(*) from public.inquiry_preparations"), before_.rows);
    assert.equal(count("select count(*) from public.inquiry_preparations where status = 'manual' and generator = 'manual'"), before_.rows);
    assert.equal(count("select count(*) from public.inquiry_preparations where status in ('queued','running','retry_scheduled')"), 0);
    // So even if automation were ever switched on, historical client data would not be sent.
    assert.equal(svc("select count(*) from public.claim_preparation_jobs('codecraft', 10, 120)"), "0");
  });

  test("ownership starts empty and nothing else is created for existing inquiries", () => {
    assert.equal(count("select count(*) from public.project_inquiries where owners <> '{}'"), 0);
    for (const table of ["inquiry_follow_ups", "inquiry_notes", "preparation_drafts", "generation_usage", "automation_control"]) {
      assert.equal(count(`select count(*) from public.${table}`), 0, table);
    }
  });

  test("the dashboard list shows existing inquiries without any contact details and hides deleted ones", () => {
    const list = svc("select public.dashboard_inquiries()");
    const rows = JSON.parse(list);
    assert.equal(rows.length, before_.rows - 1);
    assert.ok(!rows.some((r) => r.id === DELETED));
    assert.doesNotMatch(list, /@example\.com|\+20100000000/);
    assert.ok(rows.every((r) => !("email" in r) && !("phone" in r)));
    assert.equal(rows.find((r) => r.id === BOOKED).booking_status, "booked");
    assert.equal(rows.find((r) => r.id === LEGACY).project_type, "other");
  });

  test("the public form's insert (as service_role, returning the id) still works and queues one job", () => {
    const newId = svc(`insert into public.project_inquiries (id, full_name, email, project_description, preferred_language, consent_given, consent_at, source_page, submission_token)
                       values (${lit(NEW_INQUIRY)}, 'Form Client', 'form@example.com', 'Submitted after the upgrade.', 'en', true, now(), '/en/start', 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa') returning id`).split("\n")[0];
    assert.equal(newId, NEW_INQUIRY);
    assert.equal(count(`select count(*) from public.inquiry_preparations where inquiry_id = ${lit(NEW_INQUIRY)} and status = 'queued'`), 1);
  });

  test("booking, rescheduling, cancelling and rebooking still work, on old and new inquiries, and never touch preparation", () => {
    const prep = (rowId) => db.psql(`select status || '|' || attempts from public.inquiry_preparations where inquiry_id = ${lit(rowId)}`);
    const beforePrep = [prep(BOOKED), prep(CANCELLED), prep(NEW_INQUIRY)];
    // New inquiry: created, rescheduled, cancelled, rebooked.
    assert.equal(svc(`select public.apply_booking_created(${lit(NEW_INQUIRY)}, 'new-1', '2026-10-25 09:00:00+00', 'Africa/Cairo', '2026-10-08 10:00:00+00')`), NEW_INQUIRY);
    assert.equal(svc(`select public.apply_booking_rescheduled(${lit(NEW_INQUIRY)}, 'new-1', 'new-2', '2026-10-26 09:00:00+00', 'Africa/Cairo', '2026-10-08 10:05:00+00')`), NEW_INQUIRY);
    assert.equal(svc(`select public.apply_booking_cancelled(${lit(NEW_INQUIRY)}, 'new-2', '2026-10-26 09:00:00+00', 'Africa/Cairo', '2026-10-08 10:10:00+00')`), NEW_INQUIRY);
    assert.equal(svc(`select public.apply_booking_created(${lit(NEW_INQUIRY)}, 'new-3', '2026-10-27 09:00:00+00', 'Africa/Cairo', '2026-10-08 10:15:00+00')`), NEW_INQUIRY);
    // Existing inquiries: a booked one is rescheduled; a cancelled one is rebooked (the 20261007 migration's case).
    assert.equal(svc(`select public.apply_booking_rescheduled(${lit(BOOKED)}, 'prod-booking-a', 'prod-booking-a2', '2026-10-22 09:00:00+00', 'Africa/Cairo', '2026-10-08 11:00:00+00')`), BOOKED);
    assert.equal(svc(`select public.apply_booking_created(${lit(CANCELLED)}, 'prod-booking-c', '2026-10-23 09:00:00+00', 'Africa/Cairo', '2026-10-08 11:05:00+00')`), CANCELLED);
    assert.equal(db.psql(`select booking_status || '|' || cal_booking_id from public.project_inquiries where id = ${lit(CANCELLED)}`), "booked|prod-booking-c");
    assert.deepEqual([prep(BOOKED), prep(CANCELLED), prep(NEW_INQUIRY)], beforePrep);
  });

  test("anon and authenticated can read none of it and run none of it", () => {
    for (const role of ["anon", "authenticated"]) {
      for (const table of ["project_inquiries", "inquiry_preparations", "preparation_drafts", "inquiry_follow_ups", "inquiry_notes", "generation_usage", "automation_control"]) {
        assert.match(db.psqlExpectError(`set role ${role}; select count(*) from public.${table}`), /permission denied/, `${role} ${table}`);
      }
      for (const call of ["public.dashboard_inquiries()", `public.dashboard_inquiry(${lit(BOOKED)})`, "public.claim_preparation_jobs('mock', 1, 60)", `public.preparation_input(${lit(BOOKED)})`]) {
        assert.match(db.psqlExpectError(`set role ${role}; select ${call}`), /permission denied/, `${role} ${call}`);
      }
    }
  });

  test("applying both migrations a second time changes nothing (safe to re-run)", () => {
    const rows = count("select count(*) from public.inquiry_preparations");
    const fingerprint = inquiryFingerprint();
    for (const file of CRM) db.applyMigration(file);
    assert.equal(count("select count(*) from public.inquiry_preparations"), rows);
    assert.equal(inquiryFingerprint(), fingerprint);
    assert.equal(count("select count(*) from pg_trigger where tgname = 'project_inquiries_queue_preparation' and not tgisinternal"), 1);
  });
});

describe("CRM Release 1, applied on top of Operations/CRM v1, file by file", () => {
  const LEGACY_STAGES = [id(95), id(96), id(97)];
  let stages;
  let preRelease;
  let r1Pre;
  let r1Post;
  before(() => {
    preRelease = inquiryFingerprint();
    // The launch document's own checks, run as written.
    r1Pre = lines(db.psql(runbookSql("### Pre-checks for Release 1", "r1")));
    // Inquiries sitting in the early sales stages that Release 1 replaces.
    ["converted", "not_a_fit", "archived"].forEach((stage, n) => {
      insertRow(LEGACY_STAGES[n], { type: "website" });
      db.psql(`update public.project_inquiries set lead_status = ${lit(stage)} where id = ${lit(LEGACY_STAGES[n])}`);
    });
    for (const file of RELEASE_1) db.applyMigration(file);
    stages = db.psql(`select string_agg(lead_status, ',' order by id) from public.project_inquiries where id = any (array[${LEGACY_STAGES.map(lit).join(",")}]::uuid[])`);
    db.psql(`delete from public.crm_activity; delete from public.inquiry_preparations where inquiry_id = any (array[${LEGACY_STAGES.map(lit).join(",")}]::uuid[]);
             delete from public.preparation_drafts where inquiry_id = any (array[${LEGACY_STAGES.map(lit).join(",")}]::uuid[]);
             delete from public.project_inquiries where id = any (array[${LEGACY_STAGES.map(lit).join(",")}]::uuid[]);`);
    r1Post = lines(db.psql(runbookSql("### Post-checks for Release 1", "r1")));
  });

  test("the launch document's pre-checks and post-checks give exactly the documented results", () => {
    assert.deepEqual(r1Pre.slice(0, 2), ["0", "0"]);
    assert.match(r1Pre[2], /^new:\d+$/, "every existing inquiry is still new");
    assert.equal(r1Pre[3], String(count("select count(*) from public.project_inquiries")));
    assert.deepEqual([r1Post[0], r1Post[1], r1Post[2]], ["0", "9", "1"]);
    assert.equal(r1Post[3], r1Pre[2], "the same stage counts as before the release");
    assert.deepEqual(r1Post.slice(4), ["0", "0", "0"]);
  });

  test("the early stage names carried over to their successors", () => {
    assert.equal(stages, "won,lost,paused");
  });

  test("every existing inquiry is exactly as it was: same rows, same values, same stage", () => {
    assert.equal(inquiryFingerprint(), preRelease);
    assert.equal(count("select count(*) from public.project_inquiries where lead_status <> 'new'"), 0);
    assert.equal(count("select count(*) from public.project_inquiries where utm_content is not null"), 0);
  });

  test("it adds only CRM objects: no row in any CRM table until the team uses it", () => {
    for (const t of ["crm_companies", "crm_contacts", "inquiry_crm", "crm_stage_history", "crm_proposals", "crm_projects", "crm_prospects", "crm_outreach_touches", "admin_auth_throttle"]) {
      assert.equal(count(`select count(*) from public.${t}`), 0, t);
    }
  });

  test("the public insert and the booking functions still work, on old and new inquiries", () => {
    const newId = id(93);
    svc(`insert into public.project_inquiries (id, full_name, email, project_description, preferred_language, consent_given, consent_at, source_page, submission_token, utm_content)
         values (${lit(newId)}, 'Form Client', 'form@example.com', 'Submitted after Release 1.', 'en', true, now(), '/en/start', 'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa', 'flagship_en')`);
    assert.equal(count(`select count(*) from public.inquiry_preparations where inquiry_id = ${lit(newId)} and status = 'queued'`), 1);
    assert.equal(svc(`select public.apply_booking_created(${lit(newId)}, 'r1-1', '2026-11-01 09:00:00+00', 'Africa/Cairo', '2026-10-10 10:00:00+00')`), newId);
    assert.equal(svc(`select public.apply_booking_cancelled(${lit(newId)}, 'r1-1', '2026-11-01 09:00:00+00', 'Africa/Cairo', '2026-10-10 10:05:00+00')`), newId);
    assert.equal(db.psql(`select lead_status from public.project_inquiries where id = ${lit(newId)}`), "new", "bookings never touch the sales stage");
    db.psql(`delete from public.crm_activity; delete from public.inquiry_preparations where inquiry_id = ${lit(newId)}; delete from public.project_inquiries where id = ${lit(newId)}`);
  });

  test("a team member can use every part of it on the upgraded database", () => {
    svc(`select public.crm_set_stage(${lit(BOOKED)}, 'qualified', 'omar@mintapp.tech')`);
    const created = JSON.parse(svc(`select public.crm_create_from_inquiry(${lit(BOOKED)}, 'new', null, 'omar@mintapp.tech')`));
    assert.ok(created.contact_id && created.company_id);
    assert.equal(JSON.parse(svc("select public.crm_overview(current_date)")).counts.open_inquiries > 0, true);
    svc(`select public.crm_set_stage(${lit(BOOKED)}, 'new', 'omar@mintapp.tech')`);
    db.psql("delete from public.crm_stage_history; delete from public.crm_activity; delete from public.inquiry_crm; delete from public.crm_contacts; delete from public.crm_companies");
  });

  test("anon and authenticated can read none of the new tables and run none of the new functions", () => {
    for (const role of ["anon", "authenticated"]) {
      for (const t of ["crm_companies", "crm_contacts", "inquiry_crm", "crm_activity", "crm_proposals", "crm_projects", "crm_prospects", "admin_auth_throttle"]) {
        assert.match(db.psqlExpectError(`set role ${role}; select count(*) from public.${t}`), /permission denied/, `${role} ${t}`);
      }
      assert.match(db.psqlExpectError(`set role ${role}; select public.crm_overview(current_date)`), /permission denied/, role);
      assert.match(db.psqlExpectError(`set role ${role}; select public.admin_auth_locked('${"a".repeat(64)}')`), /permission denied/, role);
    }
  });

  test("applying Release 1 a second time changes nothing", () => {
    const fingerprint = inquiryFingerprint();
    for (const file of RELEASE_1) db.applyMigration(file);
    assert.equal(inquiryFingerprint(), fingerprint);
  });
});

describe("the two-founder workflow, applied on top of Release 1, file by file", () => {
  let preWorkflow;
  let booked;
  before(() => {
    preWorkflow = inquiryFingerprint();
    booked = db.psql("select string_agg(id::text, ',' order by id) from public.project_inquiries where deleted_at is null and booking_status = 'booked' and meeting_start_at > now()").split(",").filter(Boolean);
    for (const file of TWO_FOUNDER) db.applyMigration(file);
  });

  test("existing inquiries are exactly as they were", () => {
    // The budget currency is new: no existing row is given one.
    assert.equal(db.psql("select count(*) from public.project_inquiries where budget_currency is not null"), "0");
    assert.equal(inquiryFingerprint(), preWorkflow);
  });

  test("every booked meeting still ahead gets one review action, due the day before, with no owner until one is set", () => {
    assert.ok(booked.length >= 1, "the rehearsal has a booked meeting ahead");
    for (const b of booked) {
      assert.equal(db.psql(`select count(*) || '|' || coalesce(max(owner), 'none') || '|' || (max(due_on) = public.pack_review_due(max(i.meeting_start_at)))::text
                            from public.inquiry_follow_ups f join public.project_inquiries i on i.id = f.inquiry_id where f.inquiry_id = ${lit(b)} and f.kind = 'pack_review' and f.done_at is null`), "1|none|true");
    }
    assert.equal(count("select count(*) from public.inquiry_follow_ups where kind = 'pack_review'"), booked.length, "only for meetings still ahead");
  });

  test("existing manual jobs stay manual; nothing is queued for an inquiry without a booking", () => {
    assert.equal(count("select count(*) from public.inquiry_preparations where status = 'manual'"), before_.rows, "the pre-launch inquiries' backfilled jobs");
    assert.equal(count("select count(*) from public.inquiry_preparations p join public.project_inquiries i on i.id = p.inquiry_id where p.status in ('queued', 'retry_scheduled') and i.booking_status <> 'booked'"), 0);
    assert.equal(count("select count(*) from public.preparation_drafts where artifact <> 'note'"), 0, "earlier drafts are labelled 'note'");
  });

  test("a new public inquiry waits for a booking; booking it queues the pack and creates the action", () => {
    const fresh = id(94);
    svc(`insert into public.project_inquiries (id, full_name, email, project_description, preferred_language, consent_given, consent_at, budget_range, timeline, company_url)
         values (${lit(fresh)}, 'Form Client', 'form@example.com', 'Submitted after the workflow.', 'en', true, now(), 'Not sure yet', 'Within 3 months', 'https://acme.example.com/')`);
    assert.equal(db.psql(`select status from public.inquiry_preparations where inquiry_id = ${lit(fresh)}`), "waiting_booking");
    svc(`select public.apply_booking_created(${lit(fresh)}, 'tf-1', now() + interval '6 days', 'Africa/Cairo', now())`);
    assert.equal(db.psql(`select status from public.inquiry_preparations where inquiry_id = ${lit(fresh)}`), "queued");
    assert.equal(count(`select count(*) from public.inquiry_follow_ups where inquiry_id = ${lit(fresh)} and kind = 'pack_review' and done_at is null`), 1);
    db.psql(`delete from public.crm_activity where inquiry_id = ${lit(fresh)}; delete from public.inquiry_follow_ups where inquiry_id = ${lit(fresh)}; delete from public.inquiry_preparations where inquiry_id = ${lit(fresh)}; delete from public.project_inquiries where id = ${lit(fresh)}`);
  });

  test("the public roles can read none of the new tables and run none of the new functions", () => {
    for (const role of ["anon", "authenticated"]) {
      assert.match(db.psqlExpectError(`set role ${role}; select count(*) from public.crm_settings`), /permission denied/);
      for (const call of ["public.crm_command_centre(current_date)", "public.lead_list('{}')", `public.lead_detail(${lit(BOOKED)})`, "public.growth_prospect_list()", `public.pack_latest(${lit(BOOKED)})`]) {
        assert.match(db.psqlExpectError(`set role ${role}; select ${call}`), /permission denied/, `${role} ${call}`);
      }
    }
  });

  test("applying it a second time changes nothing and creates no second action", () => {
    const actions = count("select count(*) from public.inquiry_follow_ups");
    for (const file of TWO_FOUNDER) db.applyMigration(file);
    assert.equal(count("select count(*) from public.inquiry_follow_ups"), actions);
    assert.equal(inquiryFingerprint(), preWorkflow);
  });
});

describe("recovery scripts", () => {
  test("script 1 stops new jobs and keeps all data; an inquiry submitted afterwards still saves", () => {
    const jobs = count("select count(*) from public.inquiry_preparations");
    applyRollback("01_stop_new_preparation_jobs.sql");
    assert.equal(count("select count(*) from pg_trigger where tgname = 'project_inquiries_queue_preparation' and not tgisinternal"), 0);
    assert.equal(count("select count(*) from public.inquiry_preparations"), jobs);
    const later = id(91);
    svc(`insert into public.project_inquiries (id, full_name, email, project_description, preferred_language, consent_given, consent_at) values (${lit(later)}, 'After Stop', 'later@example.com', 'Saved without a job.', 'en', true, now())`);
    assert.equal(count(`select count(*) from public.inquiry_preparations where inquiry_id = ${lit(later)}`), 0, "no job is created");
    // The dashboard still lists it; a missing job is shown as such (the page offers manual preparation).
    assert.match(svc("select public.dashboard_inquiries()"), new RegExp(later));
    // Turning job creation back on is just the migration's trigger section again.
    db.applyMigration(CRM[0]);
    assert.equal(count("select count(*) from pg_trigger where tgname = 'project_inquiries_queue_preparation' and not tgisinternal"), 1);
    // ...and the migration's backfill gives anything saved in the meantime a manual job, so no inquiry stays without one.
    assert.equal(db.psql(`select status from public.inquiry_preparations where inquiry_id = ${lit(later)}`), "manual");
  });

  test("script 2 removes everything the CRM added, and the database is exactly what it was before the launch", () => {
    // The two-founder workflow comes off first, then Release 1 (its own script), then v1.
    applyRollback("04_remove_two_founder_workflow.sql");
    assert.equal(count("select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'crm_settings'"), 0);
    assert.equal(count("select count(*) from information_schema.columns where table_schema = 'public' and table_name in ('inquiry_follow_ups', 'preparation_drafts') and column_name in ('kind', 'artifact')"), 0);
    assert.equal(count("select count(*) from public.inquiry_preparations where status = 'waiting_booking'"), 0);
    applyRollback("03_remove_crm_release_1.sql");
    assert.equal(count("select count(*) from information_schema.tables where table_schema = 'public' and (table_name like 'crm\_%' or table_name in ('inquiry_crm', 'admin_auth_throttle'))"), 0);
    assert.equal(count("select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and (p.proname like 'crm\_%' or p.proname like 'admin\_auth\_%')"), 0);
    assert.equal(count("select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'project_inquiries' and column_name = 'utm_content'"), 0);
    db.psql(`delete from public.preparation_drafts; delete from public.inquiry_follow_ups; delete from public.inquiry_notes;`); // team data the runbook says to export first
    // Restore inquiry rows the earlier tests changed, so the comparison is about schema and untouched data.
    applyRollback("02_remove_operations_crm_v1.sql");
    assert.equal(customFunctions(), 0);
    assert.equal(count("select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('inquiry_preparations','preparation_drafts','inquiry_follow_ups','inquiry_notes','generation_usage','automation_control')"), 0);
    assert.equal(count("select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'project_inquiries' and column_name = 'owners'"), 0);
    assert.equal(schemaFingerprint(), before_.schema, "tables, columns, functions, triggers and constraints match the pre-launch database");
    assert.equal(count("select count(*) from public.project_inquiries where id = " + lit(LEGACY)), 1);
  });

  test("after the removal the public form's insert and the booking functions work exactly as before", () => {
    const afterId = id(92);
    assert.equal(svc(`insert into public.project_inquiries (id, full_name, email, project_description, preferred_language, consent_given, consent_at, source_page, submission_token)
                      values (${lit(afterId)}, 'After Removal', 'removal@example.com', 'Saved with no CRM at all.', 'en', true, now(), '/en/start', 'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa') returning id`).split("\n")[0], afterId);
    assert.equal(svc(`select public.apply_booking_created(${lit(afterId)}, 'r-1', '2026-10-28 09:00:00+00', 'Africa/Cairo', '2026-10-09 10:00:00+00')`), afterId);
    assert.equal(svc(`select public.apply_booking_cancelled(${lit(afterId)}, 'r-1', '2026-10-28 09:00:00+00', 'Africa/Cairo', '2026-10-09 10:05:00+00')`), afterId);
    assert.equal(svc(`select public.apply_booking_created(${lit(afterId)}, 'r-2', '2026-10-29 09:00:00+00', 'Africa/Cairo', '2026-10-09 10:10:00+00')`), afterId);
  });

  test("after a full removal the launch can be done again from the same files", () => {
    for (const file of [...CRM, ...RELEASE_1, ...TWO_FOUNDER]) db.applyMigration(file);
    assert.equal(count("select count(*) from public.inquiry_preparations"), count("select count(*) from public.project_inquiries"));
    assert.equal(count("select count(*) from public.inquiry_preparations where status = 'manual'"), count("select count(*) from public.project_inquiries"));
  });

  test("the recovery scripts say they are recovery only, and are not in the migrations folder", () => {
    for (const file of readdirSync(ROLLBACK_DIR).filter((f) => f.endsWith(".sql"))) {
      assert.match(readFileSync(join(ROLLBACK_DIR, file), "utf8").split("\n")[0], /^-- RECOVERY ONLY\. Never apply as a migration/, file);
    }
    assert.deepEqual(readdirSync(join(process.cwd(), "supabase", "migrations")).filter((f) => /rollback|remove|stop/i.test(f)), []);
  });
});

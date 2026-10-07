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
const ROLLBACK_DIR = join(process.cwd(), "supabase", "rollback");

// The SQL in the launch runbook is run here, so the document cannot drift from the database.
const RUNBOOK = readFileSync(join(process.cwd(), "docs", "operations-crm-v1-launch.md"), "utf8");
const runbookSql = (heading) => {
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
// "owners" column is excluded, so the same fingerprint works before and after.
const inquiryFingerprint = () => db.psql(`select md5(coalesce(string_agg((to_jsonb(t) - 'owners')::text, '|' order by t.id), '')) from public.project_inquiries t`);

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
  test("the CRM migrations are exactly the two not yet applied, and nothing else is pending or excluded by accident", () => {
    const onDisk = readdirSync(join(process.cwd(), "supabase", "migrations")).filter((f) => f.endsWith(".sql")).sort();
    assert.deepEqual([...PRODUCTION_BEFORE, ...CRM].sort(), onDisk, "supabase/migrations changed: update the runbook and this rehearsal");
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
    for (const file of CRM) db.applyMigration(file);
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

// The review-only cleanup and the curated seed (supabase/review/), on a throwaway
// local cluster: never a remote database.
//   npm run test:db

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { startCluster } from "./pg-harness.mjs";

const file = (...p) => join(process.cwd(), ...p);
const TOOLS = file("supabase", "review", "review_tools.sql");
const SEED = file("supabase", "review", "seed_curated.sql");
const MARKER = file("tests", "fixtures", "review-marker.sql");
const FIXTURE = file("tests", "fixtures", "synthetic-inquiries.sql");
const LOTUS = "5eed0000-0000-4000-8000-000000000009";
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

let db;
before(async () => {
  db = await startCluster();
  for (const f of db.migrations) db.applyMigration(f);
});
after(() => db?.stop());

const count = (sql) => Number(db.psql(`select count(*) from (${sql}) as x`));

// What one old-style and one new-style live-test run leave behind, made the way the
// live test makes them: test sign-ins, live-test emails and booking ids.
function liveTestRun({ tag, email, uid }) {
  const id = db.psql(`insert into public.project_inquiries (full_name, email, company_name, preferred_language, project_type, project_description, consent_given, consent_at)
    values (${lit(`Client ${tag}`)}, ${lit(email)}, ${lit(`Company ${tag}`)}, 'en', 'web_app', 'We run clinics and want online booking.', true, now()) returning id`).split(/\r?\n/)[0];
  db.psql(`select public.apply_booking_created(${lit(id)}, ${lit(uid)}, now() + interval '3 days', 'Africa/Cairo', now())`);
  db.psql(`select public.crm_create_from_inquiry(${lit(id)}, 'new', null, 'omar.review@example.com')`);
  db.psql(`select public.pack_save_artifact(${lit(id)}, 'discovery', '{"format":"text","body":"x"}'::jsonb, 'manual', 'omar.review@example.com')`);
  db.psql(`select public.crm_set_stage(${lit(id)}, 'proposal_prep', 'omar.review@example.com')`);
  db.psql(`select public.crm_create_proposal(${lit(id)}, '{"summary":"s"}'::jsonb, 'omar.review@example.com')`);
  db.psql(`do $$ declare v uuid; begin
    v := public.crm_save_prospect(null, '{"company_name":"Prospect ${tag}","contact_handle":"handle-${tag}","owner":"omar"}'::jsonb, 'omar.review@example.com');
    perform public.crm_log_touch(v, 'outbound', 1, 'linkedin', current_date, 'Touch', 'omar.review@example.com', 'Next', 'omar', current_date + 3);
    perform public.crm_link_prospect_inquiry(v, ${lit(id)}, 'omar.review@example.com');
  end $$`);
  return id;
}

describe("the review-only tools", () => {
  test("refuse to install anywhere but the synthetic review database", () => {
    assert.match(db.psqlExpectError(`\\i ${TOOLS.replace(/\\/g, "/")}`), /Not the synthetic review database/);
    assert.equal(db.psql("select count(*) from pg_proc where proname in ('review_purge', 'review_delete')"), "0");
  });

  test("install on the review database; only the server key may run the purge", () => {
    db.applyFile(MARKER);
    db.applyFile(TOOLS);
    for (const role of ["anon", "authenticated"]) assert.match(db.psqlExpectError(`set role ${role}; select * from public.review_purge();`), /permission denied/);
    assert.match(db.psql("set role service_role; select item from public.review_purge();"), /dry run/);
  });

  test("find live-test rows by internal evidence, dry-run first, then remove exactly them", () => {
    db.applyFile(FIXTURE);
    db.applyFile(SEED);
    // Someone's own work in the review project, and a chosen default reviewer: both kept.
    const kept = db.psql(`insert into public.project_inquiries (full_name, email, preferred_language, project_description, consent_given, consent_at)
      values ('Reviewer test lead', 'someone@reviewer.example', 'en', 'Kept: not a live test.', true, now()) returning id`).split(/\r?\n/)[0];
    db.psql(`insert into public.crm_companies (name, name_key, created_by) values ('Kept Co', 'kept co', 'someone@reviewer.example')`);
    db.psql(`select public.crm_set_setting('default_owner', 'omar', 'someone@reviewer.example')`);
    const old = liveTestRun({ tag: "2610101311", email: "e2e-2610101311@example.com", uid: "review-2610101311" });
    const fresh = liveTestRun({ tag: "k3x9q2", email: "k3x9q2-en@review-run.invalid", uid: "review-k3x9q2" });

    const before = Number(db.psql("select count(*) from public.project_inquiries"));
    const dry = db.psql("select item || '=' || total from public.review_purge()").split(/\r?\n/);
    assert.ok(dry.includes("inquiries: live-test email (earlier runs)=1"), dry.join("\n"));
    assert.ok(dry.includes("inquiries: live-test email (review-run.invalid)=1"));
    assert.ok(dry.includes("inquiries: old synthetic fixture (fixed id)=4"));
    assert.ok(dry.includes("prospects created by test sign-ins=2"));
    assert.ok(dry.includes("companies created by test sign-ins=2"));
    assert.equal(Number(db.psql("select count(*) from public.project_inquiries")), before, "a dry run changes nothing");

    // One run only.
    db.psql("select * from public.review_purge(p_apply => true, p_run => 'k3x9q2')");
    assert.equal(count(`select 1 from public.project_inquiries where id = ${lit(fresh)}`), 0);
    assert.equal(count(`select 1 from public.project_inquiries where id = ${lit(old)}`), 1);
    assert.equal(count("select 1 from public.crm_prospects where company_name = 'Prospect k3x9q2'"), 0);
    assert.equal(count("select 1 from public.crm_prospects where company_name = 'Prospect 2610101311'"), 1);

    // Everything left.
    const applied = db.psql("select item || '=' || total from public.review_purge(p_apply => true)").split(/\r?\n/);
    assert.ok(applied.includes("removed from project_inquiries=5"), applied.join("\n"));
    assert.equal(count("select 1 from public.project_inquiries where email ~* '^e2e-' or email like '%@review-run.invalid' or id::text like '11111111-%'"), 0);
    assert.equal(count("select 1 from public.crm_prospects where created_by like '%.review@example.com'"), 0);
    assert.equal(count("select 1 from public.crm_companies where created_by like '%.review@example.com'"), 0);
    assert.equal(count("select 1 from public.crm_outreach_touches as t where not exists (select 1 from public.crm_prospects as p where p.id = t.prospect_id)"), 0);
    assert.equal(count("select 1 from public.crm_activity where actor like '%.review@example.com'"), 0);
    // Kept: someone's own lead and company, the default reviewer, and the curated seed.
    assert.equal(count(`select 1 from public.project_inquiries where id = ${lit(kept)}`), 1);
    assert.equal(count("select 1 from public.crm_companies where name = 'Kept Co'"), 1);
    assert.equal(db.psql("select value from public.crm_settings where key = 'default_owner'"), "omar");
    assert.equal(count("select 1 from public.project_inquiries where email like '%@review-seed.invalid'"), 10);
    // Nothing more to find.
    assert.ok(db.psql("select item || '=' || total from public.review_purge()").split(/\r?\n/).every((l) => /=0$/.test(l)));
  });

  test("every function refuses once the database is no longer marked as the review project", () => {
    db.psql("create or replace function public.review_environment() returns text language sql as $$ select 'live'::text $$");
    assert.match(db.psqlExpectError("select * from public.review_purge(p_apply => true)"), /not_review_database/);
    assert.match(db.psqlExpectError("select * from public.review_delete(array[]::uuid[], null, null, null)"), /not_review_database/);
    assert.match(db.psqlExpectError(`\\i ${SEED.replace(/\\/g, "/")}`), /Not the synthetic review database/);
    db.applyFile(MARKER);
  });
});

describe("the curated review seed", () => {
  test("re-running replaces the previous seed and nothing else", () => {
    const counts = () => db.psql("select (select count(*) from public.project_inquiries) || '/' || (select count(*) from public.crm_prospects) || '/' || (select count(*) from public.preparation_drafts) || '/' || (select count(*) from public.crm_projects)");
    const first = counts();
    db.applyFile(SEED);
    assert.equal(counts(), first);
  });

  test("one lead in every position, readable names, no contact details, and no default reviewer chosen", () => {
    db.psql("delete from public.crm_settings where key = 'default_owner'");
    db.applyFile(SEED);
    const stages = db.psql("select distinct lead_status from public.project_inquiries where email like '%@review-seed.invalid' order by 1").split(/\r?\n/);
    for (const s of ["new", "reviewing", "meeting_booked", "qualified", "proposal_sent", "negotiation", "won", "lost"]) assert.ok(stages.includes(s), `${s} in ${stages}`);
    assert.equal(count("select 1 from public.project_inquiries where email like '%@review-seed.invalid' and (full_name ~ '[0-9]' or phone is not null)"), 0);
    assert.equal(count("select 1 from public.project_inquiries where email like '%@review-seed.invalid' and preferred_language = 'ar'"), 4);
    assert.equal(count("select 1 from public.project_inquiries where email like '%@review-seed.invalid' and company_name is null"), 2);
    assert.equal(count("select 1 from public.crm_settings where key = 'default_owner'"), 0);
    // Outbound: a prospect handed over to an inquiry.
    assert.equal(count("select 1 from public.crm_prospects where stage = 'inquiry_submitted' and inquiry_id is not null and created_by like '%@review-seed.invalid'"), 1);
    assert.equal(count("select 1 from public.inquiry_crm as d join public.project_inquiries as i on i.id = d.inquiry_id where i.email like '%@review-seed.invalid' and d.lead_origin = 'outbound'"), 1);
    // A paused lead and an Arabic Pack waiting for review.
    assert.equal(count("select 1 from public.inquiry_crm where paused_until > current_date"), 1);
    assert.equal(count("select 1 from public.preparation_drafts where review_status = 'in_review' and content ->> 'language' = 'ar'"), 1);
  });

  test("the complete case: booked, Pack approved part by part by the other founder, proposal accepted, won, contract signed, project active", () => {
    const row = JSON.parse(db.psql(`select jsonb_build_object('status', lead_status, 'booking', booking_status) from public.project_inquiries where id = ${lit(LOTUS)}`));
    assert.deepEqual(row, { status: "won", booking: "booked" });
    const latest = JSON.parse(db.psql(`select public.pack_latest(${lit(LOTUS)})`));
    assert.deepEqual(
      Object.fromEntries(Object.entries(latest).map(([k, v]) => [k, [v.version, v.review_status]])),
      { design: [4, "approved"], proposal: [2, "approved"], discovery: [3, "approved"] },
    );
    assert.equal(count(`select 1 from public.preparation_drafts where inquiry_id = ${lit(LOTUS)} and review_status = 'approved' and reviewed_by = created_by`), 0);
    assert.equal(db.psql(`select status from public.crm_proposals where inquiry_id = ${lit(LOTUS)}`), "accepted");
    assert.equal(db.psql(`select status from public.crm_projects where inquiry_id = ${lit(LOTUS)}`), "active");
    assert.equal(db.psql(`select contract_status from public.inquiry_crm where inquiry_id = ${lit(LOTUS)}`), "signed");
    assert.equal(count(`select 1 from public.inquiry_crm where inquiry_id = ${lit(LOTUS)} and company_id is not null`), 1);
  });
});

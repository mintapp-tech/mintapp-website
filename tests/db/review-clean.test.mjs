// The review cleanup (supabase/review/review_clean.sql and scripts/lib/review-clean.mjs) on a
// real PostgreSQL with every migration, so the foreign keys, the privileges and the
// transaction are the database's own, not the code reading itself. A throwaway local
// cluster, never a remote database.
//   npm run test:db

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { CLEAN_FUNCTION, CLEAN_PLAN, CleanError, GateError, PRESERVED_TABLES, cleanReview } from "../../scripts/lib/review-clean.mjs";
import { startCluster } from "./pg-harness.mjs";

const file = (...p) => join(process.cwd(), ...p);
const MARKER = file("tests", "fixtures", "review-marker.sql");
const FIXTURE = file("tests", "fixtures", "synthetic-inquiries.sql");
const CLEAN = file("supabase", "review", "review_clean.sql");
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;
const ACTOR = "omar.review@example.com";

let db;
before(async () => {
  db = await startCluster();
  for (const f of db.migrations) db.applyMigration(f);
});
after(() => db?.stop());

// The review project through psql instead of the API; the same questions, and the removal
// through the one function, called as the server role exactly as the API does.
function pgExecutor() {
  const rows = (sql) => JSON.parse(db.psql(`select coalesce(json_agg(t), '[]') from (${sql}) t`));
  return {
    marker: async () => {
      try {
        return db.psql("select public.review_environment()");
      } catch {
        return null;
      }
    },
    tableNames: async () => db.psql("select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'").split(/\r?\n/).filter(Boolean),
    functionNames: async () => db.psql("select distinct proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'").split(/\r?\n/).filter(Boolean),
    count: async (t) => Number(db.psql(`select count(*) from public.${t}`)),
    countNull: async (t, c) => Number(db.psql(`select count(*) from public.${t} where ${c} is null`)),
    inquiries: async () => rows("select id, email, cal_booking_id from public.project_inquiries"),
    creators: async (t) => rows(`select created_by from public.${t}`).map((r) => r.created_by),
    removeAll: async () => {
      let out;
      try {
        out = db.psql("set role service_role; select item || '=' || total from public.review_clean(p_apply => true)");
      } catch (err) {
        const message = /ERROR:\s+([a-z_]+)\b/.exec(String(err.stderr))?.[1];
        throw Object.assign(new Error("cleanup failed"), { code: message });
      }
      return Object.fromEntries(out.split(/\r?\n/).filter((l) => l.startsWith("removed from ")).map((l) => [l.slice(13).split("=")[0], Number(l.split("=")[1])]));
    },
  };
}

const n = (sql) => Number(db.psql(sql));
const counts = () => Object.fromEntries([...CLEAN_PLAN, ...PRESERVED_TABLES].map(({ table }) => [table, n(`select count(*) from public.${table}`)]));
const asServer = (sql) => db.psql(`set role service_role; ${sql}`);

// What a live-test run leaves behind, made the way the live test makes it.
function liveTestRun({ tag, email, uid }) {
  const id = db.psql(`insert into public.project_inquiries (full_name, email, company_name, preferred_language, project_type, project_description, consent_given, consent_at)
    values (${lit(`Client ${tag}`)}, ${lit(email)}, ${lit(`Company ${tag}`)}, 'en', 'web_app', 'We run clinics and want online booking.', true, now()) returning id`).split(/\r?\n/)[0];
  db.psql(`select public.apply_booking_created(${lit(id)}, ${lit(uid)}, now() + interval '3 days', 'Africa/Cairo', now())`);
  db.psql(`select public.crm_create_from_inquiry(${lit(id)}, 'new', null, ${lit(ACTOR)})`);
  db.psql(`select public.pack_save_artifact(${lit(id)}, 'discovery', '{"format":"text","body":"x"}'::jsonb, 'manual', ${lit(ACTOR)})`);
  db.psql(`select public.crm_create_proposal(${lit(id)}, '{"summary":"s"}'::jsonb, ${lit(ACTOR)})`);
  db.psql(`insert into public.inquiry_follow_ups (inquiry_id, action, owner, due_on, created_by) values (${lit(id)}, 'Call', 'omar', current_date + 3, ${lit(ACTOR)})`);
  db.psql(`insert into public.inquiry_notes (inquiry_id, author, body) values (${lit(id)}, 'omar@mint.tech', 'A reviewer note on test data.')`);
  db.psql(`insert into public.generation_usage (inquiry_id, provider, outcome, total_tokens) values (${lit(id)}, 'codecraft', 'ok', 10)`);
  db.psql(`do $$ declare v uuid; begin
    v := public.crm_save_prospect(null, '{"company_name":"Prospect ${tag}","contact_handle":"handle-${tag}","owner":"omar"}'::jsonb, ${lit(ACTOR)});
    perform public.crm_log_touch(v, 'outbound', 1, 'linkedin', current_date, 'Touch', ${lit(ACTOR)}, 'Next', 'omar', current_date + 3);
    perform public.crm_link_prospect_inquiry(v, ${lit(id)}, ${lit(ACTOR)});
  end $$`);
  return id;
}

describe("the review cleanup on a real database", () => {
  test("the function installs only on a database marked as the review environment", () => {
    assert.match(db.psqlExpectError(`\\i ${CLEAN.replace(/\\/g, "/")}`), /Not the synthetic review database/);
    assert.equal(db.psql("select count(*) from pg_proc where proname = 'review_clean'"), "0");
    db.applyFile(MARKER);
    db.applyFile(CLEAN);
    assert.equal(db.psql("select count(*) from pg_proc where proname = 'review_clean'"), "1");
  });

  test("only the server key may run it; the public roles cannot", () => {
    for (const role of ["anon", "authenticated"]) {
      assert.match(db.psqlExpectError(`set role ${role}; select * from public.review_clean();`), /permission denied/, role);
      assert.match(db.psqlExpectError(`set role ${role}; select * from public.review_clean(p_apply => true);`), /permission denied/, role);
    }
    assert.match(asServer("select item from public.review_clean() limit 1"), /would remove/);
  });

  test("without the marker the function refuses, and nothing changes", async () => {
    db.applyFile(FIXTURE);
    liveTestRun({ tag: "2610101311", email: "e2e-2610101311@example.com", uid: "review-2610101311" });
    const before = counts();
    db.psql("drop function public.review_environment()");
    assert.match(db.psqlExpectError("set role service_role; select * from public.review_clean(p_apply => true)"), /not_review_database/);
    await assert.rejects(cleanReview(pgExecutor(), { apply: true }), GateError);
    assert.deepEqual(counts(), before);
    db.applyFile(MARKER);
  });

  test("the function repeats the safety checks itself, so calling it directly is no way round them", () => {
    const before = counts();
    // An inquiry with no synthetic evidence.
    const real = db.psql(`insert into public.project_inquiries (full_name, email, preferred_language, project_description, consent_given, consent_at)
      values ('Someone', 'someone@business.example', 'en', 'Not a test.', true, now()) returning id`).split(/\r?\n/)[0];
    assert.match(db.psqlExpectError("set role service_role; select * from public.review_clean(p_apply => true)"), /unrecognised_inquiry/);
    db.psql(`delete from public.inquiry_preparations where inquiry_id = ${lit(real)}; delete from public.project_inquiries where id = ${lit(real)}`);
    assert.deepEqual(counts(), before);

    // A company made by a reviewer rather than a test sign-in.
    db.psql(`insert into public.crm_companies (name, name_key, created_by) values ('Kept Co', 'kept co', 'omar@mint.tech')`);
    assert.match(db.psqlExpectError("set role service_role; select * from public.review_clean(p_apply => true)"), /unrecognised_creator/);
    db.psql("delete from public.crm_companies where created_by = 'omar@mint.tech'");

    // A table the function does not know.
    db.psql("create table public.zz_unknown (id int)");
    assert.match(db.psqlExpectError("set role service_role; select * from public.review_clean(p_apply => true)"), /unknown_table/);
    db.psql("drop table public.zz_unknown");
    assert.deepEqual(counts(), before);
  });

  test("it is one transaction: a failure at the very end puts back everything it had already removed", async () => {
    const won = liveTestRun({ tag: "k3x9q2", email: "k3x9q2-en@review-run.invalid", uid: "review-k3x9q2" });
    db.psql(`select public.crm_set_stage(${lit(won)}, 'won', ${lit(ACTOR)}, 'Agreed')`);
    db.psql(`select public.crm_convert_to_project(${lit(won)}, 'A project', ${lit(ACTOR)})`);
    db.psql(`insert into public.admin_auth_throttle (key, failures) values (${lit("a".repeat(64))}, 3)`);
    db.psql(`select public.crm_set_setting('default_owner', 'omar', 'omar@mint.tech')`);
    db.psql(`insert into public.automation_control (provider, paused) values ('codecraft', true)`);
    const populated = counts();
    for (const { table } of CLEAN_PLAN) assert.ok(populated[table] > 0, `the test needs rows in ${table}`);

    // The last table to go refuses: everything before it must come back.
    db.psql(`create function public.zz_refuse() returns trigger language plpgsql as $$ begin raise exception 'zz_refused'; end $$;
             create trigger zz_refuse before delete on public.admin_auth_throttle for each row execute function public.zz_refuse();`);
    await assert.rejects(cleanReview(pgExecutor(), { apply: true }), (e) => e instanceof CleanError && /one transaction, so nothing was removed/.test(e.message) && /zz_refused/.test(e.message));
    assert.deepEqual(counts(), populated, "every table is exactly as it was");
    db.psql("drop trigger zz_refuse on public.admin_auth_throttle; drop function public.zz_refuse()");
  });

  test("it removes every operational table in an order the foreign keys accept, keeps the configuration, and a second run removes nothing", async () => {
    const populated = counts();
    const dry = await cleanReview(pgExecutor(), { apply: false });
    assert.equal(dry.applied, false);
    assert.deepEqual(counts(), populated, "a dry run changes nothing");

    const first = await cleanReview(pgExecutor(), { apply: true });
    assert.equal(first.clean, true);
    for (const { table } of CLEAN_PLAN) assert.equal(n(`select count(*) from public.${table}`), 0, table);
    assert.equal(first.removed.project_inquiries, populated.project_inquiries);
    assert.equal(first.removed.crm_activity, populated.crm_activity);

    // Configuration, marker and everything else are exactly as they were.
    assert.equal(n("select count(*) from public.crm_settings where key = 'default_owner' and value = 'omar'"), 1);
    assert.equal(n("select count(*) from public.automation_control where provider = 'codecraft' and paused"), 1);
    assert.equal(db.psql("select public.review_environment()"), "synthetic-review");
    assert.equal(db.psql("select count(*) from pg_proc where proname = 'crm_command_centre'"), "1");
    assert.equal(db.psql(`select count(*) from pg_proc where proname = ${lit(CLEAN_FUNCTION)}`), "1");

    const second = await cleanReview(pgExecutor(), { apply: true });
    assert.deepEqual(Object.values(second.removed).filter((x) => x > 0), [], "the second run removes nothing");
    assert.equal(second.clean, true);
  });

  test("the cleaned database accepts new work: the cleanup breaks no default, trigger or sequence", () => {
    const id = liveTestRun({ tag: "after1", email: "after1-en@review-run.invalid", uid: "review-after1" });
    assert.equal(n(`select count(*) from public.project_inquiries where id = ${lit(id)}`), 1);
    assert.ok(n("select count(*) from public.crm_activity") > 0);
  });
});

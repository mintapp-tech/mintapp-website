// Database-level tests for supabase/migrations/20261004000000_allow_not_sure_project_type.sql
// and for what the dashboard functions hand to the application.
//   npm run test:db

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { startCluster, lit } from "./pg-harness.mjs";

let db;
const insert = (id, projectType) =>
  db.psql(`insert into public.project_inquiries (id, full_name, email, preferred_language, project_type, project_description, consent_given, consent_at)
           values (${lit(id)}, 'Synthetic Client', 'synthetic@example.com', 'en', ${lit(projectType)}, 'We run three clinics and want online booking.', true, now())`);
const uuid = (n) => `cccccccc-0000-4000-8000-${String(n).padStart(12, "0")}`;

before(async () => {
  db = await startCluster();
  for (const file of db.migrations) db.applyMigration(file);
});
after(() => db?.stop());

test("the form's four choices are accepted, and so is no choice at all", () => {
  ["website", "web_app", "mobile_app", "not_sure", null].forEach((value, i) => insert(uuid(i + 1), value));
  assert.equal(db.psql("select count(*) from public.project_inquiries"), "5");
  assert.equal(db.psql(`select project_type is null from public.project_inquiries where id = '${uuid(5)}'`), "t");
});

test("the migration is additive: the older values remain allowed", () => {
  insert(uuid(6), "website_and_mobile");
  insert(uuid(7), "other");
  assert.equal(db.psql("select count(*) from public.project_inquiries"), "7");
});

test("anything else is refused by the database itself", () => {
  for (const [i, value] of ["bogus", "Website", "web app", ""].entries()) {
    assert.match(db.psqlExpectError(`insert into public.project_inquiries (id, full_name, email, preferred_language, project_type, project_description, consent_given, consent_at)
      values ('${uuid(20 + i)}', 'X', 'x@example.com', 'en', ${lit(value)}, 'We run three clinics and want online booking.', true, now())`), /project_type_values/, value);
  }
});

test("the migration can be applied again without harm", () => {
  db.applyFile(join(process.cwd(), "supabase", "migrations", "20261004000000_allow_not_sure_project_type.sql"));
  assert.equal(db.psql("select count(*) from public.project_inquiries"), "7");
});

test("the dashboard functions pass the stored value through untouched; the application decides what to call it", () => {
  const detail = (id) => JSON.parse(db.psql(`set role service_role; select public.dashboard_inquiry(${lit(id)})`));
  assert.equal(detail(uuid(4)).inquiry.project_type, "not_sure");
  assert.equal(detail(uuid(5)).inquiry.project_type, null, "no choice stays null: never defaulted to other");
  assert.equal(detail(uuid(7)).inquiry.project_type, "other", "an older value is returned as stored");
  const list = JSON.parse(db.psql("set role service_role; select public.dashboard_inquiries()"));
  const byId = Object.fromEntries(list.map((r) => [r.id, r.project_type]));
  assert.equal(byId[uuid(4)], "not_sure");
  assert.equal(byId[uuid(5)], null);
});

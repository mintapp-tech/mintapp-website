// The review marker (a test fixture; it exists only in an isolated synthetic
// review project, never in supabase/migrations/).
//   npm run test:db

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { startCluster } from "./pg-harness.mjs";

let db;
before(async () => {
  db = await startCluster();
  for (const file of db.migrations) db.applyMigration(file);
});
after(() => db?.stop());

test("a database is a review database only once the marker is applied, and only service_role can ask", () => {
  assert.match(db.psqlExpectError("set role service_role; select public.review_environment();"), /does not exist/);
  db.applyFile(join(process.cwd(), "tests", "fixtures", "review-marker.sql"));
  assert.equal(db.psql("set role service_role; select public.review_environment();"), "synthetic-review");
  for (const role of ["anon", "authenticated"]) assert.match(db.psqlExpectError(`set role ${role}; select public.review_environment();`), /permission denied/);
});

test("the synthetic fixture loads through the real booking function and can be re-run", () => {
  const seed = join(process.cwd(), "tests", "fixtures", "synthetic-inquiries.sql");
  db.applyFile(seed);
  db.applyFile(seed);
  assert.equal(db.psql("select count(*) from public.project_inquiries"), "4");
  assert.equal(db.psql("select booking_status from public.project_inquiries where id = '11111111-0000-4000-8000-000000000002'"), "booked");
  assert.equal(db.psql("select count(*) from public.inquiry_preparations"), "4", "the trigger queued a job for each");
  assert.equal(db.psql("select count(*) from public.project_inquiries where email not like '%@example.com'"), "0");
});

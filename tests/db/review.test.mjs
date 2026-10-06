// Database-level tests for supabase/review/ (the isolated synthetic review
// project only; never the live database).
//   npm run test:db

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { startCluster } from "./pg-harness.mjs";

let db;
const review = (file) => db.applyFile(join(process.cwd(), "supabase", "review", file));

before(async () => {
  db = await startCluster();
  for (const file of db.migrations) db.applyMigration(file);
});
after(() => db?.stop());

test("a database is a review database only once the marker is applied, and only service_role can ask", () => {
  assert.match(db.psqlExpectError("set role service_role; select public.review_environment();"), /does not exist/);
  review("01_review_marker.sql");
  assert.equal(db.psql("set role service_role; select public.review_environment();"), "synthetic-review");
  for (const role of ["anon", "authenticated"]) assert.match(db.psqlExpectError(`set role ${role}; select public.review_environment();`), /permission denied/);
});

test("the Arabic seed is stored exactly, and re-running the seed repairs mojibake", () => {
  const expected = JSON.parse(readFileSync(join(process.cwd(), "tests", "fixtures", "review-seed-ar.json"), "utf8")).rows;
  const stored = (id, column) => db.psql(`select ${column} from public.project_inquiries where id = '${id}'`);
  review("02_synthetic_inquiries.sql");
  for (const [id, columns] of Object.entries(expected)) for (const [column, text] of Object.entries(columns)) assert.equal(stored(id, column), text, `${id} ${column}`);

  // What the review project actually held: UTF-8 bytes read as code page 437.
  const id = "11111111-0000-4000-8000-000000000002";
  const mojibake = "┘à╪»╪▒╪│╪⌐ ╪¬╪¼╪▒┘è╪¿┘è╪⌐";
  db.psql(`update public.project_inquiries set full_name = '${mojibake}' where id = '${id}'`);
  assert.equal(stored(id, "full_name"), mojibake);
  review("02_synthetic_inquiries.sql");
  assert.equal(stored(id, "full_name"), expected[id].full_name, "re-running the seed restores the Arabic");
});

test("the synthetic seed loads through the real booking function and can be re-run", () => {
  review("02_synthetic_inquiries.sql");
  review("02_synthetic_inquiries.sql");
  assert.equal(db.psql("select count(*) from public.project_inquiries"), "4");
  assert.equal(db.psql("select booking_status from public.project_inquiries where id = '11111111-0000-4000-8000-000000000002'"), "booked");
  assert.equal(db.psql("select count(*) from public.inquiry_preparations"), "4", "the trigger queued a job for each");
  assert.equal(db.psql("select count(*) from public.project_inquiries where email not like '%@example.com'"), "0");
});

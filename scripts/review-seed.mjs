// Loads (or REPAIRS) the synthetic inquiries in the isolated review Supabase
// project, from the ASCII-only seed supabase/review/02_synthetic_inquiries.sql.
//
//   npm run review:seed
//
// Safe by construction:
//  - only the REVIEW_SUPABASE_* variables are read (git-ignored .env.review.local);
//  - the project must answer public.review_environment() = 'synthetic-review'
//    before anything is written, otherwise it refuses (the live database never
//    has that marker);
//  - it touches only the synthetic inquiry ids in the seed, and only their
//    content columns: bookings, owners, notes and drafts are left alone;
//  - the text comes from the escaped seed, decoded by this process, never from a
//    clipboard or a terminal pipe, so no code page can alter it;
//  - keys are never printed, and neither is the Arabic (a console could mangle
//    it); each field reports OK or MISMATCH.

import { createClient } from "@supabase/supabase-js";
import { assertReviewProject, reviewProjectFromEnv } from "./lib/review-auth.mjs";
import { parseSeedRows } from "./lib/review-seed.mjs";

const SYNTHETIC_ID = /^11111111-0000-4000-8000-0000000000\d\d$/;
const CONTENT = ["full_name", "email", "preferred_language", "project_type", "budget_range", "timeline", "country", "project_description"];

const project = reviewProjectFromEnv();
await assertReviewProject(project); // refuses unless this is the synthetic review project
console.log("Marker verified: synthetic-review.");

const rows = parseSeedRows();
if (rows.length === 0 || rows.some((r) => !SYNTHETIC_ID.test(r.id))) throw new Error("The seed contains an id that is not a synthetic review id. Refusing.");

const db = createClient(project.url, project.secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const check = async (message, promise) => {
  const { data, error } = await promise;
  if (error?.message.includes("project_type_values")) {
    throw new Error(`${message}: the review project does not accept the "not_sure" project type yet. Run supabase/migrations/20261004000000_allow_not_sure_project_type.sql in its SQL editor first (additive, safe to run again), then repeat this command.`);
  }
  if (error) throw new Error(`${message}: ${error.message}`);
  return data;
};

for (const row of rows) {
  const content = Object.fromEntries(CONTENT.map((c) => [c, row[c]]));
  const updated = await check(`update ${row.id}`, db.from("project_inquiries").update(content).eq("id", row.id).select("id"));
  if (updated.length === 0) await check(`insert ${row.id}`, db.from("project_inquiries").insert({ id: row.id, ...content, consent_given: true, consent_at: new Date().toISOString() }));
  console.log(`${row.id.slice(-2)} ${updated.length ? "updated" : "inserted"}`);
}

// Read back and compare every content field with the seed.
const stored = await check("read back", db.from("project_inquiries").select(["id", ...CONTENT].join(", ")).in("id", rows.map((r) => r.id)));
let mismatches = 0;
for (const row of rows) {
  const found = stored.find((s) => s.id === row.id);
  for (const column of CONTENT) {
    const ok = found && found[column] === row[column];
    if (!ok) mismatches++;
    if (!ok || /[^\x00-\x7f]/.test(String(row[column] ?? ""))) console.log(`${row.id.slice(-2)} ${column.padEnd(20)} ${ok ? "OK" : "MISMATCH"}`);
  }
}
if (mismatches) {
  console.error(`${mismatches} field(s) do not match the seed.`);
  process.exit(1);
}
console.log(`Verified: ${rows.length} synthetic inquiries match the seed exactly.`);

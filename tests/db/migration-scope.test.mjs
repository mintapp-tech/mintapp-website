// Guards what may reach a remote database. supabase/migrations/ is what a
// remote apply would run: no demo login tables, no review marker, no synthetic data.
//   npm run test:db

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = (...p) => join(process.cwd(), "supabase", ...p);
const sql = (sub) => readdirSync(dir(sub)).filter((f) => f.endsWith(".sql")).map((f) => [f, readFileSync(dir(sub, f), "utf8")]);

test("no remote migration creates login or session tables or functions (Supabase Auth owns sign-in)", () => {
  for (const [file, body] of sql("migrations")) assert.doesNotMatch(body, /team_login|team_session/i, file);
});

test("no remote migration contains the review marker or synthetic seed", () => {
  for (const [file, body] of sql("migrations")) assert.doesNotMatch(body, /review_environment|example\.com/i, file);
});

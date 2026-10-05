// Guards what may reach a remote database. supabase/migrations/ is what a
// remote apply would run; the local demo's custom login must stay outside it.
//   npm run test:db

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = (...p) => join(process.cwd(), "supabase", ...p);
const sql = (sub) => readdirSync(dir(sub)).filter((f) => f.endsWith(".sql")).map((f) => [f, readFileSync(dir(sub, f), "utf8")]);

test("no remote migration creates the local demo's login tables or functions", () => {
  for (const [file, body] of sql("migrations")) assert.doesNotMatch(body, /team_login|team_session/i, file);
});

test("the local demo SQL says it must never be applied remotely", () => {
  const files = sql("local-demo");
  assert.ok(files.length >= 2);
  for (const [file, body] of files) assert.match(body.split("\n")[0], /LOCAL SYNTHETIC DEMO ONLY\. Never apply to a remote database\./, file);
});

// The guarded cleanup of the synthetic review project (scripts/review-clean.mjs and
// scripts/lib/review-clean.mjs), against a fake database. No network, no real project.
//   npm run test:scripts
// Its order against real foreign keys is tested in tests/db/review-clean.test.mjs.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CLEAN_FUNCTION, CLEAN_PLAN, CleanError, GateError, PRESERVED_TABLES, REQUIRED_OBJECTS, cleanReview, creatorIsSynthetic, inquiryEvidence } from "../../scripts/lib/review-clean.mjs";

const repo = process.cwd();
const SECRET = "sk-canary-secret-key-0001";
const CANARY_EMAIL = "canary.person@client-example.org";
const CANARY_URL = "canary-project-ref.supabase.co";

// A fake review project: rows per table, a record of every delete, optional failure.
function fakeProject(overrides = {}) {
  const tables = {};
  for (const { table } of CLEAN_PLAN) tables[table] = [];
  for (const { table } of PRESERVED_TABLES) tables[table] = [];
  tables.project_inquiries = [
    { id: "a1", email: "e2e-2610101311@example.com", cal_booking_id: null },
    { id: "a2", email: "x1y2z3-en@review-run.invalid", cal_booking_id: "review-x1y2z3" },
    { id: "11111111-0000-4000-8000-000000000001", email: CANARY_EMAIL.replace("canary.person@client-example.org", "fixture@mintapp.local"), cal_booking_id: null },
  ];
  tables.crm_companies = [{ id: "c1", created_by: "omar.review@example.com" }];
  tables.crm_contacts = [{ id: "k1", created_by: "adam.review@example.com" }];
  tables.crm_prospects = [{ id: "p1", created_by: "omar.review@example.com" }];
  tables.crm_activity = [{ id: "y1" }, { id: "y2" }];
  tables.inquiry_notes = [{ id: "n1", author: CANARY_EMAIL }];
  tables.admin_auth_throttle = [{ key: "h1" }];
  tables.crm_settings = [{ key: "default_owner", value: "omar" }];
  tables.automation_control = [{ provider: "codecraft" }];
  const state = { marker: "synthetic-review", removals: 0, failOn: false, tables, functions: [...REQUIRED_OBJECTS.functions, CLEAN_FUNCTION], unlinkedUsage: 0, ...overrides };
  const ex = {
    marker: async () => state.marker,
    tableNames: async () => Object.keys(state.tables),
    functionNames: async () => state.functions,
    count: async (t) => state.tables[t].length,
    countNull: async () => state.unlinkedUsage,
    inquiries: async () => state.tables.project_inquiries,
    creators: async (t) => state.tables[t].map((r) => r.created_by),
    // review_clean is one transaction: it removes everything or, on failure, nothing.
    removeAll: async () => {
      state.removals++;
      if (state.failOn) throw Object.assign(new Error(`boom ${CANARY_EMAIL} ${SECRET}`), { code: "23503" });
      const removed = {};
      for (const { table } of CLEAN_PLAN) {
        removed[table] = state.tables[table].length;
        state.tables[table] = [];
      }
      return removed;
    },
  };
  return { ex, state };
}

const run = (ex, options = {}) => {
  const lines = [];
  return cleanReview(ex, { log: (l) => lines.push(l), ...options }).then(
    (result) => ({ result, lines }),
    (error) => Promise.reject(Object.assign(error, { lines })),
  );
};

test("an inquiry is synthetic only by internal evidence, never by how its address looks", () => {
  assert.equal(inquiryEvidence({ id: "x", email: "e2e-2610101311@example.com" }), "live-test email (earlier runs)");
  assert.equal(inquiryEvidence({ id: "x", email: "e2e-ar-2610101311@example.com" }), "live-test email (earlier runs)");
  assert.equal(inquiryEvidence({ id: "x", email: "k3x9q2-ar@review-run.invalid" }), "live-test email (review-run.invalid)");
  assert.equal(inquiryEvidence({ id: "x", email: "sara@review-seed.invalid" }), "curated seed (review-seed.invalid)");
  assert.equal(inquiryEvidence({ id: "x", email: "a@b.co", cal_booking_id: "review-k3x9q2" }), "live-test booking id");
  assert.equal(inquiryEvidence({ id: "11111111-0000-4000-8000-000000000003", email: "a@b.co" }), "old synthetic fixture (fixed id)");
  for (const email of ["someone@example.com", "e2e-123@example.com", "x@review-run.invalid.evil.com", "client@real-business.com", null]) {
    assert.equal(inquiryEvidence({ id: "x", email }), null, String(email));
  }
  assert.equal(inquiryEvidence({ id: "11111111-0000-4000-8000-000000000009", email: "a@b.co" }), null, "only the four fixture ids");
  assert.equal(creatorIsSynthetic("omar.review@example.com"), true);
  assert.equal(creatorIsSynthetic("omar@review-seed.invalid"), true);
  assert.equal(creatorIsSynthetic("omar@mint.tech"), false);
  assert.equal(creatorIsSynthetic(null), false);
});

test("it refuses, before any write, anything that is not provably the synthetic review project", async () => {
  const cases = {
    "a project with no marker": fakeProject({ marker: null }),
    "a project with another marker": fakeProject({ marker: "live" }),
    "the live project's own address": fakeProject(),
    "a missing migration 15/16 function": fakeProject({ functions: REQUIRED_OBJECTS.functions.slice(1) }),
    "generation usage that belongs to no inquiry": fakeProject({ unlinkedUsage: 2 }),
  };
  for (const [name, { ex, state }] of Object.entries(cases)) {
    const options = name.includes("live project") ? { productionHost: "same.host", projectHost: "same.host" } : {};
    await assert.rejects(run(ex, { apply: true, ...options }), GateError, name);
    assert.equal(state.removals, 0, `${name}: nothing may be written`);
  }

  // The cleanup function must be installed before anything can be removed; a dry run needs no function.
  const notInstalled = fakeProject({ functions: [...REQUIRED_OBJECTS.functions] });
  await assert.rejects(run(notInstalled.ex, { apply: true }), (e) => e instanceof GateError && e.message.includes("supabase/review/review_clean.sql"));
  assert.equal(notInstalled.state.removals, 0);
  assert.equal((await run(notInstalled.ex)).result.applied, false, "a dry run works without the function");

  const unknownInquiry = fakeProject();
  unknownInquiry.state.tables.project_inquiries.push({ id: "z9", email: "real.client@business.example", cal_booking_id: null });
  await assert.rejects(run(unknownInquiry.ex, { apply: true }), (e) => e instanceof GateError && /1 inquiries are not recognised/.test(e.message));
  assert.equal(unknownInquiry.state.removals, 0);

  const reviewerCompany = fakeProject();
  reviewerCompany.state.tables.crm_companies.push({ id: "c9", created_by: "omar@mint.tech" });
  await assert.rejects(run(reviewerCompany.ex, { apply: true }), (e) => e instanceof GateError && /not created by a synthetic test sign-in/.test(e.message));
  assert.equal(reviewerCompany.state.removals, 0);

  const newTable = fakeProject();
  newTable.state.tables.crm_future_thing = [{ id: "f1" }];
  await assert.rejects(run(newTable.ex, { apply: true }), (e) => e instanceof GateError && /does not know about: crm_future_thing/.test(e.message));
  assert.equal(newTable.state.removals, 0);

  const missingTable = fakeProject();
  delete missingTable.state.tables.crm_settings;
  await assert.rejects(run(missingTable.ex, { apply: true }), GateError);
});

test("the dry run lists what would go and changes nothing", async () => {
  const { ex, state } = fakeProject();
  const { result, lines } = await run(ex);
  assert.equal(result.applied, false);
  assert.equal(state.removals, 0);
  assert.equal(result.before.project_inquiries, 3);
  assert.equal(result.before.crm_activity, 2);
  const text = lines.join("\n");
  assert.match(text, /Would remove \(dry run\)/);
  assert.match(text, /Dry run: nothing was changed/);
  for (const { table } of CLEAN_PLAN) assert.ok(text.includes(table), table);
  for (const { table } of PRESERVED_TABLES) assert.ok(text.includes(table), table);
  assert.equal(state.tables.project_inquiries.length, 3);
});

test("applying removes the operational rows in one call and keeps the configuration", async () => {
  const { ex, state } = fakeProject();
  const { result } = await run(ex, { apply: true });
  assert.equal(result.applied, true);
  assert.equal(result.clean, true);
  assert.equal(state.removals, 1, "one call: one transaction");
  for (const { table } of CLEAN_PLAN) assert.equal(state.tables[table].length, 0, table);
  for (const { table } of PRESERVED_TABLES) assert.equal(state.tables[table].length, 1, `${table} is kept`);
  assert.equal(result.removed.project_inquiries, 3);
  assert.equal(result.removed.crm_activity, 2);
});

test("a failed cleanup says nothing was removed; the next one succeeds, and one after that removes nothing", async () => {
  const { ex, state } = fakeProject();
  state.failOn = true;
  let error;
  try {
    await run(ex, { apply: true });
  } catch (e) {
    error = e;
  }
  assert.ok(error instanceof CleanError);
  assert.match(error.message, /\(23503\)\. It is one transaction, so nothing was removed\./);
  assert.equal(state.tables.project_inquiries.length, 3, "the rows are still there");
  assert.equal(state.tables.crm_activity.length, 2);

  state.failOn = false;
  const second = (await run(ex, { apply: true })).result;
  assert.equal(second.clean, true);
  assert.equal(second.removed.project_inquiries, 3);

  const third = (await run(ex, { apply: true })).result;
  assert.equal(third.clean, true);
  assert.deepEqual(Object.values(third.removed).filter((n) => n > 0), [], "idempotent: the second full run removes zero rows");
  for (const { table } of PRESERVED_TABLES) assert.equal(state.tables[table].length, 1);
});

test("nothing it prints or throws contains a key, an address, a project address or any row content", async () => {
  const { ex, state } = fakeProject();
  state.failOn = true;
  let failed;
  try {
    await run(ex, { apply: true, projectHost: CANARY_URL });
  } catch (e) {
    failed = e;
  }
  const output = `${(failed.lines ?? []).join("\n")}\n${failed.message}`;
  state.failOn = false;
  const ok = (await run(ex, { apply: true, projectHost: CANARY_URL })).lines.join("\n");
  const refused = fakeProject({ marker: "live" });
  let gateMessage;
  try {
    await run(refused.ex, { apply: true, projectHost: CANARY_URL });
  } catch (e) {
    gateMessage = `${(e.lines ?? []).join("\n")}\n${e.message}`;
  }
  for (const text of [output, ok, gateMessage]) {
    for (const secret of [SECRET, CANARY_EMAIL, CANARY_URL, "omar.review@example.com", "e2e-2610101311", "review-x1y2z3"]) {
      assert.ok(!text.includes(secret), `output must not contain ${secret}`);
    }
  }
});

test("the plan matches the real schema: every table classified once, and no parent removed before a child", () => {
  const dir = join(repo, "supabase", "migrations");
  const sql = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort().map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
  const tables = new Map(); // name -> { block, parents:Set }
  for (const m of sql.matchAll(/create table if not exists public\.([a-z_]+)\s*\(/g)) {
    const start = m.index + m[0].length;
    const end = sql.indexOf("\n);", start);
    const block = sql.slice(start, end);
    const parents = new Set([...block.matchAll(/references public\.([a-z_]+)/g)].map((r) => r[1]));
    tables.set(m[1], { block, parents });
  }
  const planned = CLEAN_PLAN.map((p) => p.table);
  const kept = PRESERVED_TABLES.map((p) => p.table);
  assert.deepEqual([...tables.keys()].sort(), [...planned, ...kept].sort(), "every table is either removed or kept, on purpose");
  assert.equal(new Set([...planned, ...kept]).size, planned.length + kept.length, "none twice");
  for (const [child, { parents }] of tables) {
    for (const parent of parents) {
      if (parent === child || !planned.includes(child)) continue;
      assert.ok(planned.includes(parent), `${child} references ${parent}, which is not in the plan`);
      assert.ok(planned.indexOf(child) < planned.indexOf(parent), `${child} must be removed before ${parent}`);
    }
  }
  for (const { table, key } of CLEAN_PLAN) {
    assert.match(tables.get(table).block, new RegExp(`\\n\\s*${key}\\s+[a-z]+\\s+primary key`), `${table}: ${key} is its primary key`);
  }
  for (const f of REQUIRED_OBJECTS.functions) assert.match(sql, new RegExp(`function public\\.${f}\\b`), `migration defines ${f}`);
});

test("the SQL function deletes exactly the plan's tables, in the plan's order, and keeps exactly the preserved ones", () => {
  const sql = readFileSync(join(repo, "supabase", "review", "review_clean.sql"), "utf8");
  const deletes = [...sql.matchAll(/^\s*delete from public\.([a-z_]+) where true;/gm)].map((m) => m[1]);
  assert.deepEqual(deletes, CLEAN_PLAN.map((p) => p.table), "the same tables in the same order");
  const list = (name) => [...sql.match(new RegExp(`${name} constant text\\[\\] := array\\[([^\\]]+)\\]`))[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  assert.deepEqual(list("v_plan"), CLEAN_PLAN.map((p) => p.table), "its own list of tables to count");
  assert.deepEqual(list("v_keep"), PRESERVED_TABLES.map((p) => p.table));
  assert.ok(!/\bdelete from public\.(crm_settings|automation_control)\b/.test(sql), "it never deletes the preserved tables");
  assert.ok(!/\bauth\./i.test(sql.replace(/--.*$/gm, "")), "it never touches Supabase Auth");
  assert.match(sql, /revoke all on function public\.review_clean\(boolean\) from public, anon, authenticated;/);
  assert.match(sql, /grant execute on function public\.review_clean\(boolean\) to service_role;/);
  assert.match(sql, /security definer/);
});

// The command line, with the API unreachable: it must fail closed and say nothing it should not.
const cli = (env, args = []) =>
  spawnSync(process.execPath, [join(repo, "scripts", "review-clean.mjs"), ...args], {
    env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...env },
    encoding: "utf8",
    timeout: 60_000,
  });

test("the command refuses without review settings, with the live project's address, and with unknown options", () => {
  const none = cli({});
  assert.notEqual(none.status, 0);
  assert.match(none.stderr, /Set REVIEW_SUPABASE_URL/);

  const same = cli({ REVIEW_SUPABASE_URL: `https://${CANARY_URL}`, REVIEW_SUPABASE_PUBLISHABLE_KEY: "pub-canary", REVIEW_SUPABASE_SECRET_KEY: SECRET, SUPABASE_URL: `https://${CANARY_URL}` }, ["--apply"]);
  assert.notEqual(same.status, 0);
  assert.match(same.stderr, /same project as SUPABASE_URL/);
  assert.ok(!(same.stdout + same.stderr).includes(CANARY_URL));

  const flag = cli({}, ["--everything"]);
  assert.equal(flag.status, 2);
  assert.match(flag.stderr, /Usage/);
});

test("with the API unreachable the command fails closed and prints no key or address", () => {
  const out = cli({ REVIEW_SUPABASE_URL: "http://127.0.0.1:9", REVIEW_SUPABASE_PUBLISHABLE_KEY: "pub-canary-0002", REVIEW_SUPABASE_SECRET_KEY: SECRET }, ["--apply"]);
  assert.notEqual(out.status, 0);
  const text = out.stdout + out.stderr;
  assert.match(text, /Nothing was changed/);
  for (const secret of [SECRET, "pub-canary-0002", "127.0.0.1:9"]) assert.ok(!text.includes(secret), `output must not contain ${secret}`);
});

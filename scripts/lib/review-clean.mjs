// Guarded cleanup of the SYNTHETIC review project (mintapp-review): removes the operational
// rows left by earlier test runs and the old fixtures, and nothing else. Never the live
// project. See supabase/review/README.md.
//
// The logic here is separate from how the database is reached (an "executor"), so the same
// code runs against the review project's API, against a local test database, and against a
// fake in unit tests.
//
// Reading is done through the API. Removal cannot be: the API roles have no DELETE on these
// tables, so it is one privileged function, review_clean (supabase/review/review_clean.sql,
// installed once by the owner), which is a single transaction: it either removes everything or
// nothing, and it repeats the safety checks inside the database.

// Children before parents, the order review_clean.sql deletes in. tests/scripts/review-clean.test.mjs
// derives the foreign keys from supabase/migrations and fails if this order breaks one, if a table
// is missing, or if the SQL deletes in a different order.
export const CLEAN_PLAN = [
  { table: "crm_outreach_touches", key: "id" },
  { table: "crm_prospects", key: "id" },
  { table: "crm_projects", key: "id" },
  { table: "crm_proposals", key: "id" },
  { table: "crm_activity", key: "id" },
  { table: "crm_stage_history", key: "id" },
  { table: "inquiry_follow_ups", key: "id" },
  { table: "inquiry_notes", key: "id" },
  { table: "preparation_drafts", key: "id" },
  { table: "generation_usage", key: "id" },
  { table: "inquiry_preparations", key: "inquiry_id" },
  { table: "inquiry_crm", key: "inquiry_id" },
  { table: "crm_contacts", key: "id" },
  { table: "crm_companies", key: "id" },
  { table: "project_inquiries", key: "id" },
  { table: "admin_auth_throttle", key: "key" },
];

// Kept as they are: configuration, not test data.
export const PRESERVED_TABLES = [
  { table: "crm_settings", what: "settings, including the default reviewer" },
  { table: "automation_control", what: "automation switches and counters" },
];

// Kept because this tool never touches them.
export const PRESERVED_OTHER = [
  "reviewer accounts, their sign-in identities and authenticators (Supabase Auth is never read or written)",
  "the review-environment marker, the schema, migrations, functions, row-level security and grants",
];

// What migrations 15 and 16 added: the project must have them, or it is not the project we expect.
export const REQUIRED_OBJECTS = {
  tables: ["crm_settings"],
  functions: ["pack_latest", "lead_list", "lead_detail", "crm_command_centre", "growth_prospect_list", "automation_paused"],
};

// The function that does the removal, and the file that installs it.
export const CLEAN_FUNCTION = "review_clean";
export const CLEAN_FUNCTION_FILE = "supabase/review/review_clean.sql";

// The synthetic sign-ins whose work is always test data, and the curated seed's domain.
export const TEST_ACTORS = ["omar.review@example.com", "adam.review@example.com", "outsider.review@example.com"];
const SEED_ACTOR = /@review-seed\.invalid$/i;
// Tables whose rows are not necessarily tied to an inquiry: the creator must be a test actor.
export const CREATOR_CHECKED = ["crm_companies", "crm_contacts", "crm_prospects"];

const FIXTURE_IDS = new Set([1, 2, 3, 4].map((n) => `11111111-0000-4000-8000-00000000000${n}`));

// The evidence an inquiry is synthetic, or null. Same rules as supabase/review/review_tools.sql
// and review_clean.sql plus the curated seed; an address alone ("looks fake") is never enough.
export function inquiryEvidence({ id, email, cal_booking_id }) {
  if (/^e2e-(ar-)?[0-9]{10}@example\.com$/i.test(email ?? "")) return "live-test email (earlier runs)";
  if (/@review-run\.invalid$/i.test(email ?? "")) return "live-test email (review-run.invalid)";
  if (SEED_ACTOR.test(email ?? "")) return "curated seed (review-seed.invalid)";
  if (/^review-[0-9a-z]+$/.test(cal_booking_id ?? "")) return "live-test booking id";
  if (FIXTURE_IDS.has(id)) return "old synthetic fixture (fixed id)";
  return null;
}

export function creatorIsSynthetic(value) {
  return TEST_ACTORS.includes(value ?? "") || SEED_ACTOR.test(value ?? "");
}

export class GateError extends Error {
  constructor(problems) {
    super(`Refusing to clean. Nothing was changed.\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    this.problems = problems;
  }
}

export class CleanError extends Error {
  constructor(code) {
    super(`The cleanup failed${code ? ` (${code})` : ""}. It is one transaction, so nothing was removed.`);
    this.code = code;
  }
}

// Every check that must pass before the first write. Reads only. Returns the problems found.
export async function gate(ex, { apply = false, productionHost = null, projectHost = null } = {}) {
  const problems = [];
  const marker = await ex.marker();
  if (marker !== "synthetic-review") problems.push("this project does not answer review_environment() = 'synthetic-review'");
  if (productionHost && projectHost && productionHost === projectHost) problems.push("this project is the same as SUPABASE_URL (the live project)");
  if (problems.length) return { problems, inquiriesByEvidence: {} };

  const tables = await ex.tableNames();
  const functions = await ex.functionNames();
  for (const t of REQUIRED_OBJECTS.tables) if (!tables.includes(t)) problems.push(`migration 15 or 16 is missing: table ${t}`);
  for (const f of REQUIRED_OBJECTS.functions) if (!functions.includes(f)) problems.push(`migration 15 or 16 is missing: function ${f}`);
  if (apply && !functions.includes(CLEAN_FUNCTION)) {
    problems.push(`${CLEAN_FUNCTION}() is not installed in the review project: run ${CLEAN_FUNCTION_FILE} once in the SQL editor of mintapp-review, then try again`);
  }

  const known = new Set([...CLEAN_PLAN.map((p) => p.table), ...PRESERVED_TABLES.map((p) => p.table)]);
  for (const t of tables) if (!known.has(t)) problems.push(`a table this tool does not know about: ${t} (decide whether it is test data before cleaning)`);
  for (const t of known) if (!tables.includes(t)) problems.push(`an expected table is missing: ${t}`);

  const inquiriesByEvidence = {};
  let unknown = 0;
  for (const row of await ex.inquiries()) {
    const evidence = inquiryEvidence(row);
    if (evidence) inquiriesByEvidence[evidence] = (inquiriesByEvidence[evidence] ?? 0) + 1;
    else unknown++;
  }
  if (unknown) problems.push(`${unknown} inquiries are not recognised as synthetic (no live-test, seed or fixture evidence)`);

  for (const t of CREATOR_CHECKED) {
    if (!tables.includes(t)) continue;
    const other = (await ex.creators(t)).filter((v) => !creatorIsSynthetic(v)).length;
    if (other) problems.push(`${other} rows in ${t} were not created by a synthetic test sign-in`);
  }
  const unlinkedUsage = await ex.countNull("generation_usage", "inquiry_id");
  if (unlinkedUsage) problems.push(`${unlinkedUsage} generation_usage rows belong to no inquiry`);
  return { problems, inquiriesByEvidence };
}

async function countAll(ex) {
  const counts = {};
  for (const { table } of CLEAN_PLAN) counts[table] = await ex.count(table);
  return counts;
}

// Checks, then (only with apply) removes. Never prints a row. Returns what it found and did.
export async function cleanReview(ex, { apply = false, log = () => {}, productionHost = null, projectHost = null } = {}) {
  const { problems, inquiriesByEvidence } = await gate(ex, { apply, productionHost, projectHost });
  if (problems.length) throw new GateError(problems);
  log("Safety checks passed: the review marker answers synthetic-review, the project is not the live one, migrations 15 and 16 are present, and every inquiry is recognised as synthetic.");
  log(`Inquiries by evidence: ${Object.entries(inquiriesByEvidence).map(([k, v]) => `${k} ${v}`).join("; ") || "none"}`);

  const before = await countAll(ex);
  log(`\n${apply ? "Will remove" : "Would remove (dry run)"}:`);
  for (const { table } of CLEAN_PLAN) log(`  ${table.padEnd(24)} ${before[table]}`);
  log("Kept:");
  for (const p of PRESERVED_TABLES) log(`  ${p.table.padEnd(24)} ${await ex.count(p.table)} rows, ${p.what}`);
  for (const line of PRESERVED_OTHER) log(`  ${line}`);

  if (!apply) {
    log("\nDry run: nothing was changed. Add --apply to remove the rows above.");
    return { applied: false, before, after: null, removed: null };
  }

  let removed;
  try {
    removed = await ex.removeAll();
  } catch (err) {
    throw new CleanError(err?.code);
  }
  const after = await countAll(ex);
  log("\nRemoved (one transaction):");
  for (const { table } of CLEAN_PLAN) log(`  ${table.padEnd(24)} ${removed[table] ?? 0}`);
  const left = Object.entries(after).filter(([, n]) => n > 0);
  log(left.length ? `\nVerification FAILED, rows remain in: ${left.map(([t, n]) => `${t} ${n}`).join(", ")}` : "\nVerification: every table above is now empty.");
  return { applied: true, before, after, removed, clean: left.length === 0 };
}

// The review project through its API, with the server key. Reads, plus the one cleanup function.
export function supabaseExecutor(project, client) {
  const headers = { apikey: project.secretKey, authorization: `Bearer ${project.secretKey}` };
  let spec = null;
  const openapi = async () => {
    if (!spec) {
      const res = await fetch(`${project.url}/rest/v1/`, { headers: { ...headers, accept: "application/openapi+json" } });
      if (!res.ok) throw new Error(`could not read the API description (HTTP ${res.status})`);
      spec = await res.json();
    }
    return Object.keys(spec.paths ?? {});
  };
  const page = async (table, columns) => {
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await client.from(table).select(columns).range(from, from + 999);
      if (error) throw Object.assign(new Error("read failed"), { code: error.code });
      rows.push(...data);
      if (data.length < 1000) return rows;
    }
  };
  return {
    marker: async () => (await client.rpc("review_environment")).data ?? null,
    tableNames: async () => (await openapi()).filter((p) => !p.startsWith("/rpc/") && p !== "/").map((p) => p.slice(1)),
    functionNames: async () => (await openapi()).filter((p) => p.startsWith("/rpc/")).map((p) => p.slice(5)),
    count: async (table) => {
      const { count, error } = await client.from(table).select("*", { count: "exact", head: true });
      if (error) throw Object.assign(new Error("count failed"), { code: error.code });
      return count;
    },
    countNull: async (table, column) => {
      const { count, error } = await client.from(table).select("*", { count: "exact", head: true }).is(column, null);
      if (error) throw Object.assign(new Error("count failed"), { code: error.code });
      return count;
    },
    inquiries: () => page("project_inquiries", "id, email, cal_booking_id"),
    creators: async (table) => (await page(table, "created_by")).map((r) => r.created_by),
    // One call, one transaction, inside the database. Returns how many rows went from each table.
    removeAll: async () => {
      const { data, error } = await client.rpc(CLEAN_FUNCTION, { p_apply: true });
      if (error) {
        // Our own function raises short lowercase codes (unrecognised_inquiry, ...): safe to show. Anything else: the SQL state only.
        const own = /^[a-z_]{3,40}$/.test(error.message ?? "") ? error.message : null;
        throw Object.assign(new Error("cleanup failed"), { code: own ?? error.code });
      }
      return Object.fromEntries((data ?? []).map((r) => [String(r.item).replace(/^removed from /, ""), Number(r.total)]));
    },
  };
}

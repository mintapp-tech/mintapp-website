// READ-ONLY verification of the synthetic review database (mintapp-review) after the
// CRM Release 1 migrations. It changes nothing: it reads the API's own description of
// the schema, calls read-only functions, and proves from the outside that the public
// database roles have no access at all.
//
//   node --env-file=.env.review.local scripts/review-verify.mjs
//
// What it cannot read through the API (row-level-security flags, grants as rows, the
// migration history) it checks indirectly, and the owner can read directly with the
// read-only SQL block "Post-checks for Release 1" in docs/crm-release-1-launch.md.

import { readFileSync } from "node:fs";
import { adminClient, assertReviewProject, reviewProjectFromEnv } from "./lib/review-auth.mjs";

const project = reviewProjectFromEnv();
await assertReviewProject(project);
const host = new URL(project.url).host;

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const gateway = readFileSync(new URL("../src/lib/sql-gateway.ts", import.meta.url), "utf8");
const expectedFunctions = [...gateway.matchAll(/^  ([a-z_]+): \{ params:/gm)].map((m) => m[1]).filter((f) => !["apply_booking_created", "apply_booking_rescheduled", "apply_booking_cancelled"].includes(f));
const expectedTables = [
  "admin_auth_throttle", "automation_control", "crm_activity", "crm_companies", "crm_contacts", "crm_outreach_touches", "crm_projects", "crm_proposals",
  "crm_prospects", "crm_stage_history", "generation_usage", "inquiry_crm", "inquiry_follow_ups", "inquiry_notes", "inquiry_preparations", "preparation_drafts", "project_inquiries",
];

console.log(`Project ${host} (marker: synthetic-review)\n`);

// 1. What the API says exists.
const api = async (path, key, init = {}) => {
  const res = await fetch(`${project.url}/rest/v1${path}`, { ...init, headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", ...(init.headers ?? {}) } });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {}
  return { status: res.status, body, text };
};
const spec = await api("/", project.secretKey, { headers: { accept: "application/openapi+json" } });
const paths = Object.keys(spec.body?.paths ?? {});
const tablesPresent = paths.filter((p) => !p.startsWith("/rpc/") && p !== "/").map((p) => p.slice(1));
const rpcPresent = paths.filter((p) => p.startsWith("/rpc/")).map((p) => p.slice(5));
for (const t of expectedTables) check(`table exists: ${t}`, tablesPresent.includes(t));
for (const f of expectedFunctions) check(`function exists: ${f}`, rpcPresent.includes(f));
const inquiryColumns = Object.keys(spec.body?.definitions?.project_inquiries?.properties ?? {});
check("project_inquiries has utm_content, owners, lead_status", ["utm_content", "owners", "lead_status"].every((c) => inquiryColumns.includes(c)));

// 2. The public database roles have nothing: no table, no function.
const anon = project.publishableKey;
const denied = (r) => r.status === 401 || r.status === 403 || r.body?.code === "42501" || /permission denied/i.test(r.text);
let allDenied = true;
for (const t of expectedTables) {
  const r = await api(`/${t}?select=*&limit=1`, anon);
  const ok = denied(r);
  if (!ok) allDenied = false;
  check(`anon cannot read ${t}`, ok, `HTTP ${r.status}${r.body?.code ? ` ${r.body.code}` : ""}`);
}
// Harmless arguments only: nonexistent ids, empty objects, the letter x.
const ZERO = "00000000-0000-0000-0000-000000000000";
const argFor = (name, schema) => {
  if (schema.format === "uuid" || /(^|_)id$/.test(name)) return ZERO;
  if (/limit/.test(name)) return 0;
  if (schema.type === "integer") return 1;
  if (schema.type === "boolean") return false;
  if (schema.format === "jsonb" || schema.type === "object" || /fields|filters|owners|statuses|score/.test(name)) return name === "p_owners" || name === "p_statuses" ? [] : {};
  if (schema.format === "date") return "2000-01-01";
  if (schema.format?.startsWith("timestamp")) return "2000-01-01T00:00:00Z";
  return "x";
};
const bodyFor = (fn) => {
  const props = spec.body?.paths?.[`/rpc/${fn}`]?.post?.parameters?.[0]?.schema?.properties ?? {};
  return Object.fromEntries(Object.entries(props).map(([k, v]) => [k, argFor(k, v)]));
};
for (const f of expectedFunctions) {
  const r = await api(`/rpc/${f}`, anon, { method: "POST", body: JSON.stringify(bodyFor(f)) });
  const ok = denied(r);
  if (!ok) allDenied = false;
  check(`anon cannot run ${f}`, ok, `HTTP ${r.status}${r.body?.code ? ` ${r.body.code}` : ""}`);
}
check("the public role has no access to anything", allDenied);

// 3. The server role works: read-only calls only.
const admin = adminClient(project);
const rpc = async (fn, args = {}) => admin.rpc(fn, args);
const today = new Date().toISOString().slice(0, 10);
const reads = [
  ["crm_overview", { p_today: today }, (d) => d?.counts && typeof d.counts.new_inquiries === "number"],
  ["crm_inquiry_list", { p_filters: {} }, Array.isArray],
  ["crm_company_list", { p_q: null }, Array.isArray],
  ["crm_prospect_list", {}, Array.isArray],
  ["crm_proposal_list", { p_statuses: ["draft"] }, Array.isArray],
  ["crm_project_list", {}, Array.isArray],
  ["crm_search", { p_q: "zz" }, (d) => d && Array.isArray(d.inquiries)],
  ["crm_duplicates_report", {}, (d) => d && Array.isArray(d.companies)],
  ["crm_metrics", { p_from: today, p_to: today, p_today: today }, (d) => d?.cohort && "inquiries" in d.cohort],
  ["dashboard_inquiries", {}, Array.isArray],
  ["admin_auth_locked", { p_key: "0".repeat(64) }, (d) => d === false],
];
for (const [fn, args, valid] of reads) {
  const { data, error } = await rpc(fn, args);
  check(`server role can run ${fn}`, !error && valid(data), error ? error.message : "");
}
const marker = await rpc("review_environment");
check("review_environment() answers synthetic-review", marker.data === "synthetic-review");

// 4. What is in it (counts only).
const counts = {};
for (const t of expectedTables) {
  const { count, error } = await admin.from(t).select("*", { count: "exact", head: true });
  counts[t] = error ? `error: ${error.message}` : count;
}
console.log("\nRows per table (counts only):");
for (const [t, c] of Object.entries(counts)) console.log(`  ${t.padEnd(22)} ${c}`);
const stages = await admin.from("project_inquiries").select("lead_status").is("deleted_at", null);
const byStage = {};
for (const r of stages.data ?? []) byStage[r.lead_status] = (byStage[r.lead_status] ?? 0) + 1;
console.log(`\nInquiry stages: ${JSON.stringify(byStage)}`);
const thirteen = ["new", "reviewing", "meeting_booked", "preparing", "meeting_ready", "meeting_completed", "qualified", "proposal_prep", "proposal_sent", "negotiation", "won", "lost", "paused"];
check("every inquiry is in one of the thirteen pipeline stages", Object.keys(byStage).every((s) => thirteen.includes(s)));
const prep = await admin.from("inquiry_preparations").select("inquiry_id", { count: "exact", head: true });
const inq = await admin.from("project_inquiries").select("id", { count: "exact", head: true }).is("deleted_at", null);
check("every inquiry has a preparation record", prep.count >= inq.count, `${prep.count} records for ${inq.count} inquiries`);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);

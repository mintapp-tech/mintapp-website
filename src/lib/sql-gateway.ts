import "server-only";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { getSupabaseServerClient } from "@/lib/supabase-server";

// Calls the server-only database functions used by meeting preparation and
// the team dashboard. Deployed: Supabase RPC with the service role. Local
// demo only (never in production): the same SQL functions on a throwaway
// local PostgreSQL started by scripts/dashboard-demo.mjs.

type PgType = "uuid" | "text" | "integer" | "boolean" | "jsonb" | "timestamptz" | "date";
type Signature = { params: [string, PgType][]; returnsSet?: boolean };

// The only functions callable through the gateway, with their parameters in order.
export const SQL_FUNCTIONS = {
  claim_preparation_jobs: { params: [["p_provider", "text"], ["p_limit", "integer"], ["p_lease_seconds", "integer"]], returnsSet: true },
  claim_preparation_job_for: { params: [["p_provider", "text"], ["p_inquiry_id", "uuid"], ["p_lease_seconds", "integer"]], returnsSet: true },
  complete_pack: { params: [["p_inquiry_id", "uuid"], ["p_artifacts", "jsonb"], ["p_source", "text"], ["p_model", "text"]] },
  record_pack_payload: { params: [["p_inquiry_id", "uuid"], ["p_payload", "jsonb"]] },
  // The two-founder workflow (supabase/migrations/20261015 and 20261016).
  pack_save_artifact: { params: [["p_inquiry_id", "uuid"], ["p_artifact", "text"], ["p_content", "jsonb"], ["p_source", "text"], ["p_author", "text"]] },
  pack_save_all: { params: [["p_inquiry_id", "uuid"], ["p_artifacts", "jsonb"], ["p_source", "text"], ["p_author", "text"]] },
  crm_save_lead: { params: [["p_inquiry_id", "uuid"], ["p_fields", "jsonb"], ["p_actor", "text"]] },
  crm_get_settings: { params: [] },
  crm_set_setting: { params: [["p_key", "text"], ["p_value", "text"], ["p_actor", "text"]] },
  crm_assign_follow_up: { params: [["p_inquiry_id", "uuid"], ["p_follow_up_id", "uuid"], ["p_owner", "text"], ["p_actor", "text"]] },
  crm_set_prospect_priority: { params: [["p_id", "uuid"], ["p_priority", "text"], ["p_actor", "text"]] },
  lead_list: { params: [["p_filters", "jsonb"]] },
  lead_detail: { params: [["p_inquiry_id", "uuid"]] },
  crm_command_centre: { params: [["p_today", "date"]] },
  growth_prospect_list: { params: [] },
  automation_paused: { params: [] },
  complete_preparation: { params: [["p_inquiry_id", "uuid"], ["p_content", "jsonb"], ["p_source", "text"], ["p_model", "text"]] },
  fail_preparation: { params: [["p_inquiry_id", "uuid"], ["p_error", "text"], ["p_retryable", "boolean"], ["p_retry_after_seconds", "integer"]] },
  pause_preparation_automation: { params: [["p_provider", "text"], ["p_reason", "text"], ["p_inquiry_id", "uuid"]] },
  resume_preparation_automation: { params: [["p_provider", "text"]] },
  record_generation_usage: {
    params: [["p_inquiry_id", "uuid"], ["p_provider", "text"], ["p_model", "text"], ["p_prompt_tokens", "integer"], ["p_completion_tokens", "integer"], ["p_total_tokens", "integer"], ["p_outcome", "text"]],
  },
  monthly_generation_tokens: { params: [["p_provider", "text"]] },
  preparation_input: { params: [["p_inquiry_id", "uuid"]] },
  preparation_redactions: { params: [["p_inquiry_id", "uuid"]] },
  admin_auth_locked: { params: [["p_key", "text"]] },
  admin_auth_record: { params: [["p_key", "text"], ["p_success", "boolean"], ["p_limit", "integer"]] },
  dashboard_inquiries: { params: [] },
  // Exists only in a synthetic review database (the marker is never a migration).
  review_environment: { params: [] },
  dashboard_inquiry: { params: [["p_inquiry_id", "uuid"]] },
  dashboard_set_owners: { params: [["p_inquiry_id", "uuid"], ["p_owners", "jsonb"]] },
  dashboard_add_follow_up: { params: [["p_inquiry_id", "uuid"], ["p_action", "text"], ["p_owner", "text"], ["p_due_on", "date"], ["p_created_by", "text"]] },
  dashboard_complete_follow_up: { params: [["p_inquiry_id", "uuid"], ["p_follow_up_id", "uuid"], ["p_done_by", "text"]] },
  dashboard_add_note: { params: [["p_inquiry_id", "uuid"], ["p_author", "text"], ["p_body", "text"]] },
  dashboard_save_draft: { params: [["p_inquiry_id", "uuid"], ["p_content", "jsonb"], ["p_source", "text"], ["p_author", "text"]] },
  dashboard_review: { params: [["p_inquiry_id", "uuid"], ["p_version", "integer"], ["p_to", "text"], ["p_reviewer", "text"]] },
  dashboard_retry_preparation: { params: [["p_inquiry_id", "uuid"]] },
  dashboard_mark_manual: { params: [["p_inquiry_id", "uuid"]] },
  // CRM Release 1 (supabase/migrations/20261011 to 20261014). Writes carry the signed-in member's email as p_actor.
  crm_save_company: { params: [["p_id", "uuid"], ["p_fields", "jsonb"], ["p_actor", "text"]] },
  crm_save_contact: { params: [["p_id", "uuid"], ["p_company_id", "uuid"], ["p_fields", "jsonb"], ["p_actor", "text"]] },
  crm_link_inquiry: { params: [["p_inquiry_id", "uuid"], ["p_company_id", "uuid"], ["p_contact_id", "uuid"], ["p_actor", "text"]] },
  crm_create_from_inquiry: { params: [["p_inquiry_id", "uuid"], ["p_company_mode", "text"], ["p_company_id", "uuid"], ["p_actor", "text"]] },
  crm_save_inquiry_details: { params: [["p_inquiry_id", "uuid"], ["p_fields", "jsonb"], ["p_actor", "text"]] },
  crm_set_stage: { params: [["p_inquiry_id", "uuid"], ["p_to", "text"], ["p_actor", "text"], ["p_reason", "text"], ["p_note", "text"], ["p_paused_until", "date"]] },
  crm_set_owners: { params: [["p_inquiry_id", "uuid"], ["p_owners", "jsonb"], ["p_actor", "text"]] },
  crm_create_proposal: { params: [["p_inquiry_id", "uuid"], ["p_fields", "jsonb"], ["p_actor", "text"]] },
  crm_update_proposal: { params: [["p_id", "uuid"], ["p_fields", "jsonb"], ["p_actor", "text"]] },
  crm_proposal_transition: { params: [["p_id", "uuid"], ["p_to", "text"], ["p_actor", "text"], ["p_note", "text"]] },
  crm_convert_to_project: { params: [["p_inquiry_id", "uuid"], ["p_name", "text"], ["p_actor", "text"]] },
  crm_set_project_status: { params: [["p_id", "uuid"], ["p_status", "text"], ["p_actor", "text"]] },
  crm_save_prospect: { params: [["p_id", "uuid"], ["p_fields", "jsonb"], ["p_actor", "text"]] },
  crm_set_prospect_stage: {
    params: [["p_id", "uuid"], ["p_to", "text"], ["p_actor", "text"], ["p_follow_up_action", "text"], ["p_follow_up_owner", "text"], ["p_follow_up_due_on", "date"], ["p_reason", "text"]],
  },
  crm_set_prospect_follow_up: { params: [["p_id", "uuid"], ["p_action", "text"], ["p_owner", "text"], ["p_due_on", "date"], ["p_actor", "text"]] },
  crm_log_touch: {
    params: [
      ["p_prospect_id", "uuid"], ["p_kind", "text"], ["p_touch_no", "integer"], ["p_channel", "text"], ["p_occurred_on", "date"], ["p_summary", "text"], ["p_actor", "text"],
      ["p_next_action", "text"], ["p_next_owner", "text"], ["p_next_due_on", "date"],
    ],
  },
  crm_link_prospect_inquiry: { params: [["p_prospect_id", "uuid"], ["p_inquiry_id", "uuid"], ["p_actor", "text"]] },
  crm_inquiry_list: { params: [["p_filters", "jsonb"]] },
  crm_inquiry_extra: { params: [["p_inquiry_id", "uuid"]] },
  crm_overview: { params: [["p_today", "date"]] },
  crm_company_list: { params: [["p_q", "text"]] },
  crm_company_get: { params: [["p_id", "uuid"]] },
  crm_contact_get: { params: [["p_id", "uuid"]] },
  crm_search: { params: [["p_q", "text"]] },
  crm_duplicates_report: { params: [] },
  crm_prospect_list: { params: [] },
  crm_prospect_get: { params: [["p_id", "uuid"]] },
  crm_proposal_list: { params: [["p_statuses", "jsonb"]] },
  crm_project_list: { params: [] },
  crm_project_get: { params: [["p_id", "uuid"]] },
  crm_metrics: { params: [["p_from", "date"], ["p_to", "date"], ["p_today", "date"]] },
  crm_export: { params: [["p_kind", "text"], ["p_actor", "text"]] },
  // Local demo simulations of booking webhooks (see isLocalDashboardDemo).
  apply_booking_created: { params: [["p_inquiry_id", "uuid"], ["p_uid", "text"], ["p_start_time", "timestamptz"], ["p_timezone", "text"], ["p_event_at", "timestamptz"]] },
  apply_booking_rescheduled: {
    params: [["p_inquiry_id", "uuid"], ["p_reschedule_uid", "text"], ["p_new_uid", "text"], ["p_start_time", "timestamptz"], ["p_timezone", "text"], ["p_event_at", "timestamptz"]],
  },
  apply_booking_cancelled: { params: [["p_inquiry_id", "uuid"], ["p_uid", "text"], ["p_start_time", "timestamptz"], ["p_timezone", "text"], ["p_event_at", "timestamptz"]] },
} satisfies Record<string, Signature>;

export type SqlFunction = keyof typeof SQL_FUNCTIONS;

// A failed call. `code` is the name of an exception the database raised on
// purpose (for example loss_reason_required), "invalid_input" for a value that
// broke a table constraint, or "failed" for anything else. The message never
// contains data.
export class SqlError extends Error {
  constructor(
    readonly fn: string,
    readonly code: string,
  ) {
    super(`sql_${fn}_failed`);
  }
}

export function sqlErrorCode(message: string | undefined | null, pgCode?: string | null): string {
  const named = /(?:^|ERROR:\s+)([a-z][a-z0-9_]{2,60})\s*$/m.exec(message ?? "");
  if (named && !/^(error|fatal)$/.test(named[1]) && !named[1].includes("violates")) return named[1];
  if (pgCode && /^(23|22)/.test(pgCode)) return "invalid_input";
  if (/violates|invalid input|out of range|value too long/i.test(message ?? "")) return "invalid_input";
  return "failed";
}

export interface SqlGateway {
  readonly kind: "supabase" | "local-demo";
  call<T = unknown>(fn: SqlFunction, args?: Record<string, unknown>): Promise<T>;
}

// Local demo is active only outside production and only when the demo
// script provided a local database port.
export function localDemoPort(env: Record<string, string | undefined> = process.env): number | null {
  if (env.NODE_ENV === "production") return null;
  const port = Number(env.DASHBOARD_LOCAL_PG_PORT);
  return Number.isInteger(port) && port > 1024 && port < 65536 ? port : null;
}

export function isLocalDashboardDemo(env: Record<string, string | undefined> = process.env): boolean {
  return localDemoPort(env) !== null && env.DASHBOARD_DEMO === "1";
}

export function getSqlGateway(): SqlGateway {
  const port = localDemoPort();
  return port ? localPgGateway(port) : supabaseGateway();
}

function supabaseGateway(): SqlGateway {
  return {
    kind: "supabase",
    async call(fn, args = {}) {
      const { data, error } = await getSupabaseServerClient().rpc(fn, args);
      if (error) throw new SqlError(fn, sqlErrorCode(error.message, error.code));
      return data as never;
    },
  };
}

function psqlPath(): string {
  const exe = process.platform === "win32" ? ".exe" : "";
  const dirs = [process.env.PG_BIN, ...(process.platform === "win32" ? ["17", "16", "15"].map((v) => `C:\\Program Files\\PostgreSQL\\${v}\\bin`) : [])];
  for (const dir of dirs) if (dir && existsSync(join(dir, `psql${exe}`))) return join(dir, `psql${exe}`);
  return `psql${exe}`;
}

// Builds one statement for a whitelisted function. User data only ever
// travels inside a single dollar-quoted JSON literal with a random tag.
export function buildLocalCall(fn: SqlFunction, args: Record<string, unknown>): string {
  const sig: Signature = SQL_FUNCTIONS[fn];
  if (!sig) throw new Error("unknown_function");
  const payload = JSON.stringify(args);
  let tag: string;
  do tag = `a${randomBytes(6).toString("hex")}`;
  while (payload.includes(`$${tag}$`));
  const params = sig.params.map(([name, type]) => (type === "jsonb" ? `(a -> '${name}')` : `(a ->> '${name}')::${type}`)).join(", ");
  const call = `public.${fn}(${params})`;
  const select = sig.returnsSet ? `coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from args, ${call} as t` : `jsonb_build_object('v', ${call}) from args`;
  return `set role service_role;\nwith args as (select $${tag}$${payload}$${tag}$::jsonb as a) select ${select};\n`;
}

function localPgGateway(port: number): SqlGateway {
  return {
    kind: "local-demo",
    call(fn, args = {}) {
      const sql = buildLocalCall(fn, args);
      return new Promise((resolve, reject) => {
        const child = spawn(psqlPath(), ["-h", "127.0.0.1", "-p", String(port), "-U", "postgres", "-d", "postgres", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"], {
          env: { ...process.env, PGCLIENTENCODING: "UTF8" },
        });
        let out = "";
        let err = "";
        child.stdout.setEncoding("utf8").on("data", (d) => (out += d));
        child.stderr.setEncoding("utf8").on("data", (d) => (err += d));
        child.on("error", () => reject(new SqlError(fn, "failed")));
        child.on("close", (code) => {
          if (code !== 0) return reject(new SqlError(fn, sqlErrorCode(err.split(/\r?\n/).find((l) => l.startsWith("ERROR:")) ?? err)));
          try {
            const parsed = JSON.parse(out.trim());
            resolve(SQL_FUNCTIONS[fn] && (SQL_FUNCTIONS[fn] as Signature).returnsSet ? parsed : parsed.v);
          } catch {
            reject(new SqlError(fn, "failed"));
          }
        });
        child.stdin.end(sql, "utf8");
      });
    },
  };
}

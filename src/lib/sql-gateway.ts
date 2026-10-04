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

type PgType = "uuid" | "text" | "integer" | "boolean" | "jsonb" | "timestamptz";
type Signature = { params: [string, PgType][]; returnsSet?: boolean };

// The only functions callable through the gateway, with their parameters in order.
export const SQL_FUNCTIONS = {
  claim_preparation_jobs: { params: [["p_provider", "text"], ["p_limit", "integer"], ["p_lease_seconds", "integer"]], returnsSet: true },
  claim_preparation_job_for: { params: [["p_provider", "text"], ["p_inquiry_id", "uuid"], ["p_lease_seconds", "integer"]], returnsSet: true },
  complete_preparation: { params: [["p_inquiry_id", "uuid"], ["p_content", "jsonb"], ["p_source", "text"], ["p_model", "text"]] },
  fail_preparation: { params: [["p_inquiry_id", "uuid"], ["p_error", "text"], ["p_retryable", "boolean"], ["p_retry_after_seconds", "integer"]] },
  pause_preparation_automation: { params: [["p_provider", "text"], ["p_reason", "text"], ["p_inquiry_id", "uuid"]] },
  resume_preparation_automation: { params: [["p_provider", "text"]] },
  record_generation_usage: {
    params: [["p_inquiry_id", "uuid"], ["p_provider", "text"], ["p_model", "text"], ["p_prompt_tokens", "integer"], ["p_completion_tokens", "integer"], ["p_total_tokens", "integer"], ["p_outcome", "text"]],
  },
  monthly_generation_tokens: { params: [["p_provider", "text"]] },
  preparation_input: { params: [["p_inquiry_id", "uuid"]] },
  dashboard_inquiries: { params: [] },
  dashboard_inquiry: { params: [["p_inquiry_id", "uuid"]] },
  dashboard_assign: { params: [["p_inquiry_id", "uuid"], ["p_owner", "text"], ["p_next_action", "text"]] },
  dashboard_add_note: { params: [["p_inquiry_id", "uuid"], ["p_author", "text"], ["p_body", "text"]] },
  dashboard_save_draft: { params: [["p_inquiry_id", "uuid"], ["p_content", "jsonb"], ["p_source", "text"], ["p_author", "text"]] },
  dashboard_review: { params: [["p_inquiry_id", "uuid"], ["p_version", "integer"], ["p_to", "text"], ["p_reviewer", "text"]] },
  dashboard_retry_preparation: { params: [["p_inquiry_id", "uuid"]] },
  dashboard_mark_manual: { params: [["p_inquiry_id", "uuid"]] },
  team_login_locked: { params: [["p_key", "text"]] },
  team_login_record: { params: [["p_key", "text"], ["p_success", "boolean"]] },
  // Local demo simulations of booking webhooks (see isLocalDashboardDemo).
  apply_booking_created: { params: [["p_inquiry_id", "uuid"], ["p_uid", "text"], ["p_start_time", "timestamptz"], ["p_timezone", "text"], ["p_event_at", "timestamptz"]] },
  apply_booking_rescheduled: {
    params: [["p_inquiry_id", "uuid"], ["p_reschedule_uid", "text"], ["p_new_uid", "text"], ["p_start_time", "timestamptz"], ["p_timezone", "text"], ["p_event_at", "timestamptz"]],
  },
  apply_booking_cancelled: { params: [["p_inquiry_id", "uuid"], ["p_uid", "text"], ["p_start_time", "timestamptz"], ["p_timezone", "text"], ["p_event_at", "timestamptz"]] },
} satisfies Record<string, Signature>;

export type SqlFunction = keyof typeof SQL_FUNCTIONS;

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
      if (error) throw new Error(`sql_${fn}_failed`);
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
        child.stdout.setEncoding("utf8").on("data", (d) => (out += d));
        child.on("error", () => reject(new Error(`sql_${fn}_failed`)));
        child.on("close", (code) => {
          if (code !== 0) return reject(new Error(`sql_${fn}_failed`));
          try {
            const parsed = JSON.parse(out.trim());
            resolve(SQL_FUNCTIONS[fn] && (SQL_FUNCTIONS[fn] as Signature).returnsSet ? parsed : parsed.v);
          } catch {
            reject(new Error(`sql_${fn}_failed`));
          }
        });
        child.stdin.end(sql, "utf8");
      });
    },
  };
}

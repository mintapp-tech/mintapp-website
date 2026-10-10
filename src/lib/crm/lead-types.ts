import type { Artifact, LatestArtifact } from "@/lib/pack/state";
import type { ContractStatus, Priority } from "./schemas";

// The shapes returned by the two-founder reads (migration 20261016000000).
// Lists carry names and ids, never email addresses or phone numbers.

export type PackLatest = Partial<Record<Artifact, LatestArtifact>>;

export interface LeadRow {
  id: string;
  created_at: string;
  client_name: string;
  company_name: string | null;
  language: string;
  project_type: string | null;
  summary: string;
  booking_status: string;
  meeting_start_at: string | null;
  lead_status: string;
  paused_until: string | null;
  priority: Priority | null;
  owners: string[];
  next_action: { id: string; action: string; owner: string | null; due_on: string; kind: "manual" | "pack_review" } | null;
  pack: { job: string | null; error: string | null; artifacts: PackLatest; review_due: string | null };
  proposal_status: string | null;
  project_id: string | null;
}

export interface LeadDetail {
  // The submitted budget's currency (USD or EGP); null on rows from before it was asked.
  budget_currency: string | null;
  priority: Priority | null;
  paused_until: string | null;
  deal: { contract_status: ContractStatus | null; contract_signed_on: string | null; contract_reference: string | null; commercial_notes: string | null };
  review_action: { id: string; owner: string | null; due_on: string } | null;
  pack_latest: PackLatest;
  last_payload: unknown;
}

export interface CommandCentre {
  actions: { kind: "pack_review" | "lead" | "prospect"; id: string; inquiry_id: string | null; name: string; action: string; owner: string | null; due_on: string; meeting_start_at: string | null }[];
  meetings: { id: string; name: string; start: string; timezone: string | null; booking_uid: string | null; owners: string[]; artifacts: PackLatest; job: string | null }[];
  packs_to_review: { id: string; name: string; meeting_start_at: string | null; artifacts: PackLatest }[];
  awaiting_response: { id: string; name: string; created_at: string; owners: string[] }[];
  projects: { id: string; name: string; status: string; owners: string[] }[];
  workload: { owner: string; open: number; overdue: number; leads: number }[];
  campaign: { active_prospects: number; touches_7d: number; replies_7d: number; inquiries_30d: number };
  alerts: {
    unowned_actions: { id: string; inquiry_id: string; name: string }[];
    pack_problems: { id: string; name: string; status: string; error: string | null }[];
    automation_paused: { provider: string; reason: string | null; at: string | null }[];
    unready_soon: { id: string; name: string; start: string }[];
  };
}

export interface GrowthProspect {
  id: string;
  company_name: string;
  contact_name: string | null;
  priority: Priority | null;
  trigger_note: string | null;
  owner: string | null;
  stage: string;
  pool: string | null;
  lead_origin: string | null;
  follow_up: { action: string; owner: string; due_on: string } | null;
  touches: number;
  last_touch_on: string | null;
  do_not_contact: boolean;
  inquiry_id: string | null;
}

export type CrmSettings = Partial<Record<"default_owner", { value: string | null; updated_by: string | null; updated_at: string }>>;

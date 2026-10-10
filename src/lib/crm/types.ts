// Shapes returned by the CRM database functions (supabase/migrations/20261011 to 20261014).
// Lists carry names and ids only; contact details appear on detail views.

export const STAGES = [
  "new",
  "reviewing",
  "meeting_booked",
  "preparing",
  "meeting_ready",
  "meeting_completed",
  "qualified",
  "proposal_prep",
  "proposal_sent",
  "negotiation",
  "won",
  "lost",
  "paused",
] as const;
export type Stage = (typeof STAGES)[number];

export const LOSS_REASONS = ["no_budget", "no_response", "not_a_fit", "chose_other", "timing", "scope", "client_withdrew", "other"] as const;
export type LossReason = (typeof LOSS_REASONS)[number];

export const LEAD_ORIGINS = ["inbound", "warm", "outbound", "referral", "partner"] as const;
export type LeadOrigin = (typeof LEAD_ORIGINS)[number];

export const FIT_TIERS = ["tier_1", "tier_2", "tier_3", "partner", "poor_fit"] as const;
export type FitTier = (typeof FIT_TIERS)[number];

// The seven lead-score categories, each 0 to 2 (campaign playbook, section 11).
export const SCORE_KEYS = ["trigger", "problem", "access", "proof", "timing", "commercial", "geo"] as const;
export type ScoreKey = (typeof SCORE_KEYS)[number];
export type Score = Partial<Record<ScoreKey, 0 | 1 | 2>>;

export const CONSENT_STATUSES = ["form_consent", "given_other", "not_recorded", "withdrawn"] as const;
export type ConsentStatus = (typeof CONSENT_STATUSES)[number];

export const PROPOSAL_STATUSES = ["draft", "internal_review", "approved", "sent", "accepted", "rejected", "withdrawn", "superseded"] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const PROJECT_STATUSES = ["planned", "active", "on_hold", "completed"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROSPECT_STAGES = ["identified", "researched", "contacted", "replied", "qualified", "inquiry_submitted", "not_now", "disqualified"] as const;
export type ProspectStage = (typeof PROSPECT_STAGES)[number];

export const PROSPECT_POOLS = ["warm", "trigger_startup", "operational_sme", "referral_partner"] as const;
export type ProspectPool = (typeof PROSPECT_POOLS)[number];

export const CONTACT_CHANNELS = ["linkedin", "email", "whatsapp", "phone", "introduction", "other"] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

export const TOUCH_KINDS = ["outbound", "reply", "meeting", "note"] as const;
export type TouchKind = (typeof TOUCH_KINDS)[number];

export const CURRENCIES = ["EGP", "USD", "EUR", "GBP", "SAR", "AED"] as const;

export interface InquiryListRow {
  id: string;
  created_at: string;
  client_name: string;
  company_name: string | null;
  crm_company: { id: string; name: string } | null;
  language: string;
  project_type: string | null;
  summary: string;
  booking_status: string;
  meeting_start_at: string | null;
  lead_status: Stage;
  stage_changed_at: string;
  owners: string[];
  next_follow_up: { action: string; owner: string; due_on: string } | null;
  open_follow_ups: number;
  preparation_status: string | null;
  preparation_error: string | null;
  latest_draft: { version: number; review_status: string; source: string } | null;
  approved_version: number | null;
  lead_origin: LeadOrigin;
  source: string | null;
  campaign: string | null;
  fit_tier: FitTier | null;
  lead_score: number | null;
  proposal_status: ProposalStatus | null;
}

export interface InquiryFilters {
  q?: string;
  owner?: string;
  stage?: string;
  meeting?: string;
  preparation?: string;
  origin?: string;
  campaign?: string;
  attention?: string;
}

export interface ProposalFields {
  summary: string | null;
  recommended_scope: string | null;
  deliverables: string | null;
  exclusions: string | null;
  assumptions: string | null;
  timeline_weeks_min: number | null;
  timeline_weeks_max: number | null;
  price_min: number | string | null;
  price_max: number | string | null;
  currency: string | null;
  price_notes: string | null;
}

export interface Proposal extends ProposalFields {
  id: string;
  version: number;
  status: ProposalStatus;
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
  submitted_by: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  sent_by: string | null;
  sent_at: string | null;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
}

export interface DuplicateHints {
  contacts: { id: string; name: string; company: string | null }[];
  companies: { id: string; name: string }[];
  inquiries: { id: string; created_at: string; client_name: string }[];
}

export interface ActivityEntry {
  at: string;
  actor: string;
  action: string;
  entity: string;
  detail: Record<string, unknown>;
}

export interface InquiryExtra {
  stage: Stage;
  stage_changed_at: string;
  source: {
    lead_origin: LeadOrigin;
    referral_partner: string | null;
    referral_source: string | null;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    utm_content: string | null;
    campaign: string | null;
    content_id: string | null;
    source_page: string | null;
  };
  qualification: {
    fit_tier: FitTier | null;
    score: Score | null;
    lead_score: number | null;
    trigger_note: string | null;
    research_note: string | null;
    loss_reason: LossReason | null;
    loss_note: string | null;
    paused_until: string | null;
    won_at: string | null;
    lost_at: string | null;
  };
  company: { id: string; name: string } | null;
  contact: { id: string; name: string; role: string | null; consent_status: ConsentStatus; do_not_contact: boolean } | null;
  duplicates: DuplicateHints;
  stage_history: { at: string; from: string | null; to: string; by: string; reason: string | null }[];
  proposals: Proposal[];
  project: { id: string; name: string; status: ProjectStatus } | null;
  prospect: { id: string; company_name: string; stage: ProspectStage } | null;
  activity: ActivityEntry[];
}

export interface Overview {
  counts: {
    new_inquiries: number;
    open_inquiries: number;
    upcoming_meetings: number;
    meetings_to_prepare: number;
    overdue_follow_ups: number;
    prep_failures: number;
    drafts_awaiting_review: number;
    proposals_awaiting: number;
    unowned_open: number;
    no_next_action: number;
  };
  new_inquiries: { id: string; name: string; at: string; owners: string[] }[];
  meetings_to_prepare: { id: string; name: string; at: string }[];
  upcoming_meetings: { id: string; name: string; at: string; ready: boolean }[];
  overdue_follow_ups: { kind: "inquiry" | "prospect"; id: string; name: string; action: string; owner: string; due_on: string }[];
  prep_failures: { id: string; name: string; status: string; error: string | null }[];
  drafts_awaiting_review: { id: string; name: string; version: number; author: string }[];
  proposals_awaiting: { id: string; inquiry_id: string; name: string; version: number; status: ProposalStatus }[];
  attention: { id: string; name: string; reasons: ("no_owner" | "no_next_action")[] }[];
  owner_workload: { owner: string; open_inquiries: number; open_follow_ups: number; overdue_follow_ups: number; prospects: number }[];
  recent_activity: { at: string; actor: string; action: string; entity: string; inquiry_id: string | null; entity_id: string | null; name: string | null }[];
}

export interface CompanyRow {
  id: string;
  name: string;
  country: string | null;
  sector: string | null;
  language: string | null;
  website_host: string | null;
  created_at: string;
  contacts: number;
  open_inquiries: number;
  inquiries: number;
  possible_duplicate: boolean;
}

export interface ContactCard {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  language: string | null;
  consent_status: ConsentStatus;
  consent_at: string | null;
  do_not_contact: boolean;
}

export interface CompanyDetail {
  company: { id: string; name: string; website: string | null; website_host: string | null; country: string | null; sector: string | null; language: string | null; created_at: string; created_by: string };
  contacts: ContactCard[];
  inquiries: { id: string; client_name: string; created_at: string; stage: Stage; project_type: string | null }[];
  projects: { id: string; name: string; status: ProjectStatus }[];
  duplicates: { id: string; name: string; website_host: string | null }[];
}

export interface ContactDetail {
  contact: ContactCard & { company_id: string | null; created_at: string; created_by: string };
  company: { id: string; name: string } | null;
  inquiries: { id: string; client_name: string; created_at: string; stage: Stage }[];
  duplicates: { id: string; name: string; company: string | null }[];
}

export interface SearchResults {
  inquiries: { id: string; name: string; company: string | null; stage: Stage; at: string }[];
  companies: { id: string; name: string; country: string | null }[];
  contacts: { id: string; name: string; role: string | null; company: string | null }[];
  prospects: { id: string; company: string; contact: string | null; stage: ProspectStage }[];
}

export interface DuplicatesReport {
  companies: { id: string; name: string; website_host: string | null }[][];
  contacts: { id: string; name: string; company: string | null }[][];
  inquiries: { id: string; name: string; created_at: string }[][];
}

export interface ProspectRow {
  id: string;
  company_name: string;
  country: string | null;
  sector: string | null;
  pool: ProspectPool | null;
  lead_origin: LeadOrigin;
  contact_name: string | null;
  contact_role: string | null;
  language: string | null;
  fit_tier: FitTier | null;
  lead_score: number | null;
  trigger_note: string | null;
  owner: string;
  stage: ProspectStage;
  follow_up: { action: string; owner: string; due_on: string } | null;
  touches: number;
  last_touch_on: string | null;
  do_not_contact: boolean;
  inquiry_id: string | null;
  created_at: string;
}

export interface ProspectDetail {
  prospect: Omit<ProspectRow, "follow_up" | "touches" | "last_touch_on"> & {
    website: string | null;
    contact_channel: ContactChannel | null;
    contact_handle: string | null;
    score: Score | null;
    observation: string | null;
    proof_case: string | null;
    fit_reason: string | null;
    follow_up_action: string | null;
    follow_up_owner: string | null;
    follow_up_due_on: string | null;
    closed_reason: string | null;
    created_by: string;
    // Added by the two-founder workflow.
    priority?: "high" | "medium" | "low" | null;
  };
  touches: { id: string; kind: TouchKind; touch_no: number | null; channel: ContactChannel | null; occurred_on: string; summary: string; by: string; at: string }[];
  inquiry: { id: string; client_name: string; stage: Stage } | null;
  activity: { at: string; actor: string; action: string; detail: Record<string, unknown> }[];
}

export interface ProposalRow {
  id: string;
  inquiry_id: string;
  client_name: string;
  company_name: string | null;
  version: number;
  status: ProposalStatus;
  summary: string | null;
  created_by: string;
  updated_by: string;
  updated_at: string;
  sent_at: string | null;
  owners: string[];
}

export interface ProjectRow {
  id: string;
  name: string;
  status: ProjectStatus;
  owners: string[];
  created_at: string;
  inquiry_id: string;
  company: string | null;
}

export interface ProjectDetail {
  project: {
    id: string;
    name: string;
    status: ProjectStatus;
    owners: string[];
    source: Record<string, string>;
    scope: (Partial<ProposalFields> & { proposal_id: string; version: number; status: string }) | null;
    decisions: { at: string; by: string; what: string }[];
    preparation_version: number | null;
    meeting_start_at: string | null;
    created_at: string;
    created_by: string;
    inquiry_id: string;
  };
  company: { id: string; name: string } | null;
  contact: { id: string; name: string; role: string | null } | null;
  inquiry: { id: string; client_name: string; created_at: string; project_type: string | null } | null;
}

export interface Metrics {
  period: { from: string; to: string };
  cohort: { inquiries: number; booked: number; meeting_ready: number; discovery_complete: number; qualified: number; proposal_made: number; proposal_sent: number; won: number; lost: number };
  events: { proposals_sent: number; wins: number; losses: number; meetings_booked: number; overdue_follow_ups_now: number };
  sources: { source: string; medium: string | null; campaign: string | null; content: string | null; origin: LeadOrigin; inquiries: number; booked: number; qualified: number; won: number; lost: number }[];
  loss_reasons: { reason: LossReason; count: number }[];
  outreach: {
    prospects: number;
    touches: number;
    replies: number;
    contacted: number;
    replied: number;
    qualified: number;
    inquiries: number;
    median_days_first_touch_to_meeting: number | null;
    by_stage: Partial<Record<ProspectStage, number>>;
  };
}

export type ExportKind = "inquiries" | "companies" | "contacts" | "prospects";

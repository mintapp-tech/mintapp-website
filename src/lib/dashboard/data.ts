import "server-only";
import { getSqlGateway } from "@/lib/sql-gateway";
import type { InquiryForPreparation } from "@/lib/preparation/input";

// Typed access to the dashboard's database functions. Callers must have
// passed requireAdmin() first.

export interface InquiryRow {
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
  assigned_to: string | null;
  next_action: string | null;
  preparation_status: string | null;
  preparation_error: string | null;
  latest_draft: { version: number; review_status: string; source: string } | null;
  approved_version: number | null;
}

export interface DraftRow {
  id: string;
  version: number;
  content: unknown;
  source: string;
  model: string | null;
  review_status: "draft" | "in_review" | "approved" | "superseded";
  created_by: string;
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export interface InquiryDetail {
  inquiry: {
    id: string;
    created_at: string;
    client_name: string;
    email: string;
    phone: string | null;
    company_name: string | null;
    company_url: string | null;
    language: string;
    project_type: string | null;
    project_description: string;
    budget_range: string | null;
    timeline: string | null;
    country: string | null;
    lead_status: string;
    assigned_to: string | null;
    next_action: string | null;
  };
  meeting: { booking_status: string; meeting_start_at: string | null; meeting_timezone: string | null; cal_booking_id: string | null };
  preparation: {
    status: string;
    attempts: number;
    max_attempts: number;
    next_attempt_at: string;
    last_error: string | null;
    generator: string | null;
    model: string | null;
    finished_at: string | null;
  } | null;
  automation: { provider: string; paused_reason: string | null; paused_at: string | null }[];
  drafts: DraftRow[];
  notes: { id: string; author: string; body: string; created_at: string }[];
}

const sql = () => getSqlGateway();

export const listInquiries = async () => (await sql().call<InquiryRow[] | null>("dashboard_inquiries")) ?? [];
export const getInquiry = (id: string) => sql().call<InquiryDetail | null>("dashboard_inquiry", { p_inquiry_id: id });
export const getPreparationInput = (id: string) => sql().call<InquiryForPreparation | null>("preparation_input", { p_inquiry_id: id });

export const assign = (id: string, owner: string | null, nextAction: string | null) => sql().call<boolean>("dashboard_assign", { p_inquiry_id: id, p_owner: owner, p_next_action: nextAction });
export const addNote = (id: string, author: string, body: string) => sql().call<boolean>("dashboard_add_note", { p_inquiry_id: id, p_author: author, p_body: body });
export const saveDraft = (id: string, body: string, source: "manual" | "edited", author: string) =>
  sql().call<number | null>("dashboard_save_draft", { p_inquiry_id: id, p_content: { format: "text", body }, p_source: source, p_author: author });
export const review = (id: string, version: number, to: "in_review" | "approved" | "draft", reviewer: string) =>
  sql().call<boolean>("dashboard_review", { p_inquiry_id: id, p_version: version, p_to: to, p_reviewer: reviewer });
export const retryPreparation = (id: string) => sql().call<boolean>("dashboard_retry_preparation", { p_inquiry_id: id });
export const markManual = (id: string) => sql().call<boolean>("dashboard_mark_manual", { p_inquiry_id: id });
export const resumeAutomation = (provider: string) => sql().call<number>("resume_preparation_automation", { p_provider: provider });

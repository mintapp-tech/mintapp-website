import "server-only";
import { adminSql } from "@/lib/admin/sql";
import type {
  CompanyDetail,
  CompanyRow,
  ContactDetail,
  DuplicatesReport,
  ExportKind,
  InquiryExtra,
  InquiryFilters,
  InquiryListRow,
  Metrics,
  Overview,
  ProjectDetail,
  ProjectRow,
  ProjectStatus,
  ProposalFields,
  ProposalRow,
  ProposalStatus,
  ProspectDetail,
  ProspectRow,
  SearchResults,
  Stage,
} from "./types";

// Typed access to the CRM's database functions. Callers must have passed
// requireAdmin() first; every call also passes the review guard (adminSql).
// Writes take the signed-in member's email as `actor`, recorded on the trail.

const sql = adminSql;

// ----- Reads

export const inquiryList = async (filters: InquiryFilters = {}) =>
  (await sql().call<InquiryListRow[] | null>("crm_inquiry_list", { p_filters: { ...filters, attention: undefined } })) ?? [];
export const inquiryExtra = (id: string) => sql().call<InquiryExtra | null>("crm_inquiry_extra", { p_inquiry_id: id });
export const overview = (today: string) => sql().call<Overview>("crm_overview", { p_today: today });
export const companyList = async (q?: string) => (await sql().call<CompanyRow[] | null>("crm_company_list", { p_q: q ?? null })) ?? [];
export const companyGet = (id: string) => sql().call<CompanyDetail | null>("crm_company_get", { p_id: id });
export const contactGet = (id: string) => sql().call<ContactDetail | null>("crm_contact_get", { p_id: id });
export const search = (q: string) => sql().call<SearchResults>("crm_search", { p_q: q });
export const duplicatesReport = () => sql().call<DuplicatesReport>("crm_duplicates_report");
export const prospectList = async () => (await sql().call<ProspectRow[] | null>("crm_prospect_list")) ?? [];
export const prospectGet = (id: string) => sql().call<ProspectDetail | null>("crm_prospect_get", { p_id: id });
export const proposalList = async (statuses?: ProposalStatus[]) =>
  (await sql().call<ProposalRow[] | null>("crm_proposal_list", { p_statuses: statuses ?? ["draft", "internal_review", "approved", "sent"] })) ?? [];
export const projectList = async () => (await sql().call<ProjectRow[] | null>("crm_project_list")) ?? [];
export const projectGet = (id: string) => sql().call<ProjectDetail | null>("crm_project_get", { p_id: id });
export const metrics = (from: string, to: string, today: string) => sql().call<Metrics>("crm_metrics", { p_from: from, p_to: to, p_today: today });
export const exportRows = async (kind: ExportKind, actor: string) => (await sql().call<Record<string, unknown>[] | null>("crm_export", { p_kind: kind, p_actor: actor })) ?? [];

// ----- Writes

export const saveCompany = (id: string | null, fields: Record<string, unknown>, actor: string) => sql().call<string | null>("crm_save_company", { p_id: id, p_fields: fields, p_actor: actor });
export const saveContact = (id: string | null, companyId: string | null, fields: Record<string, unknown>, actor: string) =>
  sql().call<string | null>("crm_save_contact", { p_id: id, p_company_id: companyId, p_fields: fields, p_actor: actor });
export const linkInquiry = (inquiryId: string, companyId: string | null, contactId: string | null, actor: string) =>
  sql().call<boolean>("crm_link_inquiry", { p_inquiry_id: inquiryId, p_company_id: companyId, p_contact_id: contactId, p_actor: actor });
export const createFromInquiry = (inquiryId: string, mode: "none" | "existing" | "new", companyId: string | null, actor: string) =>
  sql().call<{ company_id: string | null; contact_id: string; contact_reused: boolean } | null>("crm_create_from_inquiry", {
    p_inquiry_id: inquiryId,
    p_company_mode: mode,
    p_company_id: companyId,
    p_actor: actor,
  });
export const saveInquiryDetails = (inquiryId: string, fields: Record<string, unknown>, actor: string) =>
  sql().call<boolean>("crm_save_inquiry_details", { p_inquiry_id: inquiryId, p_fields: fields, p_actor: actor });
export const setStage = (inquiryId: string, to: Stage, actor: string, reason?: string | null, note?: string | null, pausedUntil?: string | null) =>
  sql().call<{ changed: boolean; from: string; to: string } | null>("crm_set_stage", {
    p_inquiry_id: inquiryId,
    p_to: to,
    p_actor: actor,
    p_reason: reason ?? null,
    p_note: note ?? null,
    p_paused_until: pausedUntil ?? null,
  });
export const setOwners = (inquiryId: string, owners: string[], actor: string) => sql().call<boolean>("crm_set_owners", { p_inquiry_id: inquiryId, p_owners: owners, p_actor: actor });

export const createProposal = (inquiryId: string, fields: Partial<ProposalFields>, actor: string) =>
  sql().call<string | null>("crm_create_proposal", { p_inquiry_id: inquiryId, p_fields: fields, p_actor: actor });
export const updateProposal = (id: string, fields: Partial<ProposalFields>, actor: string) => sql().call<boolean>("crm_update_proposal", { p_id: id, p_fields: fields, p_actor: actor });
export const proposalTransition = (id: string, to: ProposalStatus, actor: string, note?: string | null) =>
  sql().call<boolean>("crm_proposal_transition", { p_id: id, p_to: to, p_actor: actor, p_note: note ?? null });
export const convertToProject = (inquiryId: string, name: string | null, actor: string) =>
  sql().call<string | null>("crm_convert_to_project", { p_inquiry_id: inquiryId, p_name: name, p_actor: actor });
export const setProjectStatus = (id: string, status: ProjectStatus, actor: string) => sql().call<boolean>("crm_set_project_status", { p_id: id, p_status: status, p_actor: actor });

export const saveProspect = (id: string | null, fields: Record<string, unknown>, actor: string) => sql().call<string | null>("crm_save_prospect", { p_id: id, p_fields: fields, p_actor: actor });
export const setProspectStage = (
  id: string,
  to: string,
  actor: string,
  next?: { action: string; owner: string; dueOn: string } | null,
  reason?: string | null,
) =>
  sql().call<boolean>("crm_set_prospect_stage", {
    p_id: id,
    p_to: to,
    p_actor: actor,
    p_follow_up_action: next?.action ?? null,
    p_follow_up_owner: next?.owner ?? null,
    p_follow_up_due_on: next?.dueOn ?? null,
    p_reason: reason ?? null,
  });
export const setProspectFollowUp = (id: string, action: string, owner: string, dueOn: string, actor: string) =>
  sql().call<boolean>("crm_set_prospect_follow_up", { p_id: id, p_action: action, p_owner: owner, p_due_on: dueOn, p_actor: actor });
export const logTouch = (
  prospectId: string,
  touch: { kind: string; touchNo: number | null; channel: string | null; occurredOn: string; summary: string },
  actor: string,
  next?: { action: string; owner: string; dueOn: string } | null,
) =>
  sql().call<boolean>("crm_log_touch", {
    p_prospect_id: prospectId,
    p_kind: touch.kind,
    p_touch_no: touch.touchNo,
    p_channel: touch.channel,
    p_occurred_on: touch.occurredOn,
    p_summary: touch.summary,
    p_actor: actor,
    p_next_action: next?.action ?? null,
    p_next_owner: next?.owner ?? null,
    p_next_due_on: next?.dueOn ?? null,
  });
export const linkProspectInquiry = (prospectId: string, inquiryId: string, actor: string) =>
  sql().call<boolean>("crm_link_prospect_inquiry", { p_prospect_id: prospectId, p_inquiry_id: inquiryId, p_actor: actor });

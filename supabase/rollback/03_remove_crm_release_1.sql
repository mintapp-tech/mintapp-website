-- RECOVERY ONLY. Never apply as a migration; never run unless the runbook says so.
--
-- Removes what CRM Release 1 added on top of Operations/CRM v1
-- (supabase/migrations/20261010000000 to 20261014000000) and leaves v1 and
-- everything before it exactly as it was:
--   * the sign-in throttle, the CRM functions, triggers and tables,
--   * the utm_content column,
--   * the thirteen pipeline stages, folded back onto the six early ones.
-- Inquiries, bookings, preparation, drafts, notes and follow-ups are untouched.
--
-- THIS DELETES THE TEAM'S CRM DATA: companies, contacts, pipeline history,
-- proposals, projects, prospects, outreach touches and the activity trail.
-- Export them first (the runbook gives the commands) and run this only on the
-- person's go-ahead. To remove v1 as well, run 02_remove_operations_crm_v1.sql
-- afterwards.
--
-- Stage folding (the early values have no finer stages): reviewing,
-- meeting_booked, preparing, meeting_ready and meeting_completed become
-- 'reviewing'; qualified, proposal_prep, proposal_sent and negotiation become
-- 'qualified'; won becomes 'converted'; lost 'not_a_fit'; paused 'archived'.
--
-- One transaction: it either removes everything or nothing.

begin;

drop trigger if exists inquiry_follow_ups_trail on public.inquiry_follow_ups;
drop trigger if exists inquiry_notes_trail on public.inquiry_notes;
drop trigger if exists preparation_drafts_trail on public.preparation_drafts;
drop trigger if exists project_inquiries_booking_trail on public.project_inquiries;

drop table if exists public.crm_outreach_touches;
drop table if exists public.crm_prospects;
drop table if exists public.crm_projects;
drop table if exists public.crm_proposals;
drop table if exists public.crm_stage_history;
drop table if exists public.crm_activity;
drop table if exists public.inquiry_crm;
drop table if exists public.crm_contacts;
drop table if exists public.crm_companies;
drop table if exists public.admin_auth_throttle;

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as signature
    from pg_proc as p join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public' and (p.proname like 'crm\_%' or p.proname like 'admin\_auth\_%')
  loop
    execute format('drop function if exists %s', f.signature);
  end loop;
end;
$$;

alter table public.project_inquiries drop constraint if exists lead_status_values;
update public.project_inquiries
set lead_status = case lead_status
  when 'meeting_booked' then 'reviewing' when 'preparing' then 'reviewing' when 'meeting_ready' then 'reviewing' when 'meeting_completed' then 'reviewing'
  when 'proposal_prep' then 'qualified' when 'proposal_sent' then 'qualified' when 'negotiation' then 'qualified'
  when 'won' then 'converted' when 'lost' then 'not_a_fit' when 'paused' then 'archived'
  else lead_status end
where lead_status not in ('new', 'reviewing', 'qualified', 'converted', 'not_a_fit', 'archived');
alter table public.project_inquiries add constraint lead_status_values
  check (lead_status = any (array['new', 'reviewing', 'qualified', 'converted', 'not_a_fit', 'archived']));
comment on column public.project_inquiries.lead_status is
  'Business/sales pipeline stage only. Does NOT track meeting-booking (see booking_status) or internal-prep progress (see concept_pack_status) — avoid re-adding those meanings here.';

alter table public.project_inquiries drop constraint if exists utm_content_length;
alter table public.project_inquiries drop column if exists utm_content;

commit;

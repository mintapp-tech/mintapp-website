-- RECOVERY ONLY. Never apply as a migration; never run unless the runbook says so.
--
-- Removes everything Operations/CRM v1 added, returning the database to the
-- state it had after supabase/migrations/20261007000000_allow_rebooking_after_cancellation.sql:
-- the preparation and dashboard functions, the trigger, the six tables and the
-- owners column. Inquiries, bookings and every public function are untouched.
--
-- THIS DELETES THE TEAM'S DATA entered in the dashboard: preparation notes
-- and versions, follow-ups, internal notes and owners. Export those first (the
-- runbook gives the exact commands) and run this only on the person's go-ahead.
--
-- One transaction: it either removes everything or nothing.

begin;

drop trigger if exists project_inquiries_queue_preparation on public.project_inquiries;

drop function if exists public.queue_inquiry_preparation();
drop function if exists public.claim_preparation_jobs(text, integer, integer);
drop function if exists public.complete_preparation(uuid, jsonb, text, text);
drop function if exists public.fail_preparation(uuid, text, boolean, integer);
drop function if exists public.pause_preparation_automation(text, text, uuid);
drop function if exists public.resume_preparation_automation(text);
drop function if exists public.record_generation_usage(uuid, text, text, integer, integer, integer, text);
drop function if exists public.monthly_generation_tokens(text);
drop function if exists public.preparation_input(uuid);
drop function if exists public.dashboard_inquiries();
drop function if exists public.dashboard_inquiry(uuid);
drop function if exists public.dashboard_set_owners(uuid, jsonb);
drop function if exists public.dashboard_add_follow_up(uuid, text, text, date, text);
drop function if exists public.dashboard_complete_follow_up(uuid, uuid, text);
drop function if exists public.dashboard_add_note(uuid, text, text);
drop function if exists public.dashboard_save_draft(uuid, jsonb, text, text);
drop function if exists public.dashboard_review(uuid, integer, text, text);
drop function if exists public.dashboard_retry_preparation(uuid);
drop function if exists public.dashboard_mark_manual(uuid);
drop function if exists public.claim_preparation_job_for(text, uuid, integer);

drop table if exists public.inquiry_notes;
drop table if exists public.inquiry_follow_ups;
drop table if exists public.preparation_drafts;
drop table if exists public.inquiry_preparations;
drop table if exists public.generation_usage;
drop table if exists public.automation_control;

alter table public.project_inquiries drop constraint if exists owners_shape;
alter table public.project_inquiries drop column if exists owners;

commit;

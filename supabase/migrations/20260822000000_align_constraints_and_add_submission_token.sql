-- Mintapp — corrective migration for project_inquiries
--
-- The original migration (20260815000000_create_project_inquiries.sql) was
-- written from what the Data-API-only architecture could see at the time,
-- which does not include CHECK constraints, real index definitions, or
-- trigger function names. Direct SQL inspection on 2026-08-22 (via the
-- Supabase SQL Editor, not a connection string) revealed the original
-- migration was missing several live constraints entirely, had the wrong
-- trigger function name, and had two indexes with the wrong definition.
--
-- This file does NOT rewrite or replace that original migration — it is a
-- separate, additive correction, safe to run against the already-live
-- database (which already has almost everything below) and safe to run
-- against a fresh database that only has the original migration applied.
--
-- Every constraint/index/trigger touched here uses drop-then-recreate so
-- this file is idempotent and re-runnable without erroring either way.

-- ============================================================
-- 1. CHECK constraints confirmed live via direct SQL inspection,
--    missing from the original migration.
-- ============================================================

alter table public.project_inquiries drop constraint if exists consent_required;
alter table public.project_inquiries add constraint consent_required
  check (consent_given = true and consent_at is not null);
-- Corrects the original migration, which only checked consent_given = true
-- and missed the consent_at IS NOT NULL half of the live constraint.

alter table public.project_inquiries drop constraint if exists email_shape;
alter table public.project_inquiries add constraint email_shape
  check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

alter table public.project_inquiries drop constraint if exists email_length;
alter table public.project_inquiries add constraint email_length
  check (char_length(email) <= 320);

alter table public.project_inquiries drop constraint if exists email_lowercase;
alter table public.project_inquiries add constraint email_lowercase
  check (email = lower(email));

alter table public.project_inquiries drop constraint if exists full_name_length;
alter table public.project_inquiries add constraint full_name_length
  check (char_length(trim(full_name)) >= 1 and char_length(trim(full_name)) <= 200);

alter table public.project_inquiries drop constraint if exists description_length;
alter table public.project_inquiries add constraint description_length
  check (char_length(trim(project_description)) >= 1 and char_length(trim(project_description)) <= 8000);
-- Corrects the original migration, which had no length bound on this column
-- at all — this is the constraint that rejected the ~500KB test payload
-- during API testing, discovered by hitting it rather than by inspection.

alter table public.project_inquiries drop constraint if exists phone_length;
alter table public.project_inquiries add constraint phone_length
  check (char_length(phone) <= 40);

alter table public.project_inquiries drop constraint if exists company_name_length;
alter table public.project_inquiries add constraint company_name_length
  check (char_length(company_name) <= 200);

alter table public.project_inquiries drop constraint if exists company_url_length;
alter table public.project_inquiries add constraint company_url_length
  check (char_length(company_url) <= 500);

alter table public.project_inquiries drop constraint if exists country_length;
alter table public.project_inquiries add constraint country_length
  check (char_length(country) <= 100);

alter table public.project_inquiries drop constraint if exists budget_range_length;
alter table public.project_inquiries add constraint budget_range_length
  check (char_length(budget_range) <= 100);

alter table public.project_inquiries drop constraint if exists timeline_length;
alter table public.project_inquiries add constraint timeline_length
  check (char_length(timeline) <= 100);

alter table public.project_inquiries drop constraint if exists referral_source_length;
alter table public.project_inquiries add constraint referral_source_length
  check (char_length(referral_source) <= 200);

alter table public.project_inquiries drop constraint if exists source_page_length;
alter table public.project_inquiries add constraint source_page_length
  check (char_length(source_page) <= 300);

alter table public.project_inquiries drop constraint if exists internal_notes_length;
alter table public.project_inquiries add constraint internal_notes_length
  check (char_length(internal_notes) <= 5000);

alter table public.project_inquiries drop constraint if exists submission_error_length;
alter table public.project_inquiries add constraint submission_error_length
  check (char_length(submission_error) <= 2000);

alter table public.project_inquiries drop constraint if exists utm_source_length;
alter table public.project_inquiries add constraint utm_source_length
  check (char_length(utm_source) <= 200);

alter table public.project_inquiries drop constraint if exists utm_medium_length;
alter table public.project_inquiries add constraint utm_medium_length
  check (char_length(utm_medium) <= 200);

alter table public.project_inquiries drop constraint if exists utm_campaign_length;
alter table public.project_inquiries add constraint utm_campaign_length
  check (char_length(utm_campaign) <= 200);

alter table public.project_inquiries drop constraint if exists preferred_language_values;
alter table public.project_inquiries add constraint preferred_language_values
  check (preferred_language = any (array['en', 'ar']));

-- Verified live: notification_status is locked to exactly these three
-- values. Confirms the application must never write anything else here
-- (e.g. no separate "send_failed" / "status_update_failed" states without a
-- follow-up migration widening this constraint first).
alter table public.project_inquiries drop constraint if exists notification_status_values;
alter table public.project_inquiries add constraint notification_status_values
  check (notification_status = any (array['pending', 'sent', 'failed']));

alter table public.project_inquiries drop constraint if exists notification_timestamp_required;
alter table public.project_inquiries add constraint notification_timestamp_required
  check (notification_status <> 'sent' or notification_sent_at is not null);

alter table public.project_inquiries drop constraint if exists lead_status_values;
alter table public.project_inquiries add constraint lead_status_values
  check (lead_status = any (array['new', 'reviewing', 'qualified', 'converted', 'not_a_fit', 'archived']));

alter table public.project_inquiries drop constraint if exists booking_status_values;
alter table public.project_inquiries add constraint booking_status_values
  check (booking_status = any (array['not_booked', 'booked', 'completed', 'cancelled', 'no_show']));

alter table public.project_inquiries drop constraint if exists booking_reference_required;
alter table public.project_inquiries add constraint booking_reference_required
  check (booking_status = 'not_booked' or cal_booking_id is not null);

alter table public.project_inquiries drop constraint if exists meeting_time_required;
alter table public.project_inquiries add constraint meeting_time_required
  check (booking_status = 'not_booked' or meeting_start_at is not null);

alter table public.project_inquiries drop constraint if exists concept_pack_status_values;
alter table public.project_inquiries add constraint concept_pack_status_values
  check (concept_pack_status = any (array['not_started', 'queued', 'in_progress', 'ready_for_review', 'approved', 'failed']));

-- Verified live: the exact controlled vocabulary for project_type, in case
-- it's ever surfaced as a form field. Not currently collected by the UI.
alter table public.project_inquiries drop constraint if exists project_type_values;
alter table public.project_inquiries add constraint project_type_values
  check (project_type is null or project_type = any (array['website', 'web_app', 'mobile_app', 'website_and_mobile', 'other']));

-- ============================================================
-- 2. Index corrections — the original migration's email and
--    lead_status indexes didn't match the live definitions.
-- ============================================================

drop index if exists public.project_inquiries_email_idx;
create index project_inquiries_email_idx on public.project_inquiries using btree (lower(email));
-- Corrects the original migration: live index is functional on lower(email),
-- not a plain index on email (consistent with the email_lowercase
-- constraint always normalizing the stored value anyway).

drop index if exists public.project_inquiries_lead_status_idx;
create index project_inquiries_lead_status_idx on public.project_inquiries using btree (lead_status)
  where (deleted_at is null);
-- Corrects the original migration: live index is partial (excludes
-- soft-deleted rows), the original created a plain, non-partial index.

-- project_inquiries_created_at_idx was already correct in the original
-- migration — no change needed.

-- ============================================================
-- 3. Trigger function name correction.
-- ============================================================

-- The live trigger calls a function named set_updated_at(), not
-- set_project_inquiries_updated_at() as the original migration created.
-- Recreated here under the correct, live name; the trigger is repointed to
-- it. The differently-named function from the original migration is
-- harmless if left in place (unused), so it is not dropped here.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists project_inquiries_set_updated_at on public.project_inquiries;
create trigger project_inquiries_set_updated_at
  before update on public.project_inquiries
  for each row
  execute function public.set_updated_at();

-- ============================================================
-- 4. New: submission_token, for server-side idempotency.
-- ============================================================

alter table public.project_inquiries
  add column if not exists submission_token uuid;

comment on column public.project_inquiries.submission_token is
  'Client-generated UUID, stable across retries of the same form submission. Used to make duplicate/retried POSTs to /api/inquiries a safe no-op instead of a second row. Nullable for historical rows inserted before this column existed.';

drop index if exists public.project_inquiries_submission_token_key;
create unique index project_inquiries_submission_token_key
  on public.project_inquiries (submission_token)
  where (submission_token is not null);
-- Partial unique index (not a plain unique constraint) so historical rows
-- with a null token don't collide with each other under uniqueness rules —
-- Postgres treats every NULL as distinct for a plain unique constraint
-- already, but the explicit WHERE clause keeps intent obvious and keeps
-- this index out of the way for any row that predates this column.

-- ============================================================
-- 5. Grants — reconfirmed, no changes required.
-- ============================================================

-- Verified live: service_role has exactly SELECT, INSERT, UPDATE — matching
-- docs/supabase-database-permissions.md. No DELETE grant exists for
-- service_role; this migration does not add one.
--
-- Verified live: RLS remains enabled with zero policies on this table —
-- anon/authenticated have no SELECT/INSERT/UPDATE/DELETE grant of any kind.
--
-- Separately noted, not changed by this migration: anon and authenticated
-- both currently hold REFERENCES, TRIGGER and TRUNCATE grants on this
-- table. None of these are reachable through the Data API (PostgREST has no
-- HTTP-level operation that maps to TRUNCATE/TRIGGER/REFERENCES), so this
-- isn't currently exploitable given this project's architecture — but it's
-- more privilege than these roles need, and revoking it would be a
-- reasonable follow-up hardening step. Left untouched here since that's a
-- deliberate decision for a human to make, not something to bundle into a
-- migration about validation/idempotency.

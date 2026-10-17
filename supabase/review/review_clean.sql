-- SYNTHETIC REVIEW DATABASE ONLY (mintapp-review). Never apply to the live database.
-- Not a migration: it lives outside supabase/migrations on purpose, and a test fails if
-- anything here appears there.
--
-- Installs ONE function, review_clean, that empties the review project of its operational
-- test data in a single transaction:
--
--   select * from public.review_clean();                 -- dry run: what would be removed
--   select * from public.review_clean(p_apply => true);  -- removes it
--
-- `npm run review:clean` calls it. Why a function: the API roles cannot delete from these
-- tables at all (they are append-only for them), so removal has to run with the owner's
-- rights. It is the narrowest way to do that: it deletes nothing but the listed tables, it
-- refuses unless every check below passes, and it is one statement from the caller's side,
-- so any failure rolls everything back.
--
-- It refuses, before deleting anything, unless:
--   - review_environment() answers 'synthetic-review';
--   - every table in the public schema is one it knows;
--   - every inquiry (soft-deleted ones included) carries synthetic evidence: a live-test
--     address or booking id, one of the old fixture's four ids, or the curated seed's address;
--   - every company, contact and prospect was created by a synthetic test sign-in or the seed;
--   - no generation usage is unlinked from an inquiry.
-- It never touches Supabase Auth (reviewer accounts and authenticators), crm_settings
-- (including the default reviewer), automation_control, the marker, the schema or any grant.
-- Children go before parents: tests/db/review-clean.test.mjs proves the order against the
-- database's own foreign keys.

begin;

do $$
declare
  v text;
begin
  if to_regprocedure('public.review_environment()') is null then
    raise exception 'Not the synthetic review database (no review_environment()). Nothing was changed.';
  end if;
  execute 'select public.review_environment()' into v;
  if v is distinct from 'synthetic-review' then
    raise exception 'Not the synthetic review database. Nothing was changed.';
  end if;
end;
$$;

create or replace function public.review_clean(p_apply boolean default false)
returns table (item text, total bigint)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_marker text;
  v bigint;
  n bigint;
  t text;
  v_keep constant text[] := array['crm_settings', 'automation_control'];
  v_plan constant text[] := array[
    'crm_outreach_touches', 'crm_prospects', 'crm_projects', 'crm_proposals', 'crm_activity', 'crm_stage_history',
    'inquiry_follow_ups', 'inquiry_notes', 'preparation_drafts', 'generation_usage', 'inquiry_preparations',
    'inquiry_crm', 'crm_contacts', 'crm_companies', 'project_inquiries', 'admin_auth_throttle'];
  v_actors constant text[] := array['omar.review@example.com', 'adam.review@example.com', 'outsider.review@example.com'];
begin
  if to_regprocedure('public.review_environment()') is null then
    raise exception 'not_review_database';
  end if;
  execute 'select public.review_environment()' into v_marker;
  if v_marker is distinct from 'synthetic-review' then
    raise exception 'not_review_database';
  end if;

  select count(*) into v from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE' and not (table_name = any (v_plan || v_keep));
  if v > 0 then
    raise exception 'unknown_table';
  end if;

  -- coalesce: a missing booking id makes a test NULL, and `not (NULL)` would let the row through.
  select count(*) into v from public.project_inquiries as i
  where not (
    coalesce(i.email ~* '^e2e-(ar-)?[0-9]{10}@example\.com$', false)
    or coalesce(i.email ~* '@review-run\.invalid$', false)
    or coalesce(i.email ~* '@review-seed\.invalid$', false)
    or coalesce(i.cal_booking_id ~ '^review-[0-9a-z]+$', false)
    or i.id in ('11111111-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000004'));
  if v > 0 then
    raise exception 'unrecognised_inquiry';
  end if;

  select count(*) into v from (
    select created_by from public.crm_companies
    union all select created_by from public.crm_contacts
    union all select created_by from public.crm_prospects) as c
  where not (coalesce(c.created_by = any (v_actors), false) or coalesce(c.created_by ~* '@review-seed\.invalid$', false));
  if v > 0 then
    raise exception 'unrecognised_creator';
  end if;

  select count(*) into v from public.generation_usage where inquiry_id is null;
  if v > 0 then
    raise exception 'unlinked_usage';
  end if;

  if not p_apply then
    foreach t in array v_plan loop
      execute format('select count(*) from public.%I', t) into n;
      item := 'would remove: ' || t;
      total := n;
      return next;
    end loop;
    return;
  end if;

  -- `where true`: some Supabase sessions refuse a DELETE without a WHERE clause.
  delete from public.crm_outreach_touches where true;
  get diagnostics n = row_count; item := 'removed from crm_outreach_touches'; total := n; return next;
  delete from public.crm_prospects where true;
  get diagnostics n = row_count; item := 'removed from crm_prospects'; total := n; return next;
  delete from public.crm_projects where true;
  get diagnostics n = row_count; item := 'removed from crm_projects'; total := n; return next;
  delete from public.crm_proposals where true;
  get diagnostics n = row_count; item := 'removed from crm_proposals'; total := n; return next;
  delete from public.crm_activity where true;
  get diagnostics n = row_count; item := 'removed from crm_activity'; total := n; return next;
  delete from public.crm_stage_history where true;
  get diagnostics n = row_count; item := 'removed from crm_stage_history'; total := n; return next;
  delete from public.inquiry_follow_ups where true;
  get diagnostics n = row_count; item := 'removed from inquiry_follow_ups'; total := n; return next;
  delete from public.inquiry_notes where true;
  get diagnostics n = row_count; item := 'removed from inquiry_notes'; total := n; return next;
  delete from public.preparation_drafts where true;
  get diagnostics n = row_count; item := 'removed from preparation_drafts'; total := n; return next;
  delete from public.generation_usage where true;
  get diagnostics n = row_count; item := 'removed from generation_usage'; total := n; return next;
  delete from public.inquiry_preparations where true;
  get diagnostics n = row_count; item := 'removed from inquiry_preparations'; total := n; return next;
  delete from public.inquiry_crm where true;
  get diagnostics n = row_count; item := 'removed from inquiry_crm'; total := n; return next;
  delete from public.crm_contacts where true;
  get diagnostics n = row_count; item := 'removed from crm_contacts'; total := n; return next;
  delete from public.crm_companies where true;
  get diagnostics n = row_count; item := 'removed from crm_companies'; total := n; return next;
  delete from public.project_inquiries where true;
  get diagnostics n = row_count; item := 'removed from project_inquiries'; total := n; return next;
  delete from public.admin_auth_throttle where true;
  get diagnostics n = row_count; item := 'removed from admin_auth_throttle'; total := n; return next;
end;
$$;

revoke all on function public.review_clean(boolean) from public, anon, authenticated;
grant execute on function public.review_clean(boolean) to service_role;

commit;

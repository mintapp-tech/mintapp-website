-- SYNTHETIC REVIEW DATABASE ONLY (mintapp-review). Never apply to the live database.
-- Not a migration: it lives outside supabase/migrations on purpose, and a test fails if
-- anything here appears there.
--
-- Installs the guarded tools that find and remove synthetic live-test rows:
--
--   select * from public.review_purge();                -- dry run: what would be removed
--   select * from public.review_purge(p_apply => true); -- removes it
--   select * from public.review_purge(p_apply => true, p_run => '<tag>');  -- one live-test run
--
-- Live-test rows are found by internal evidence, never by visible names alone:
--   - inquiries whose email is a live-test address (e2e-<run>@example.com from earlier
--     runs, <run>-*@review-run.invalid from later ones) or whose booking id is a
--     live-test booking (review-<run>), and the four rows of the old synthetic fixture
--     (its fixed ids);
--   - prospects, companies and contacts created by the three synthetic test sign-ins
--     (omar.review@, adam.review@, outsider.review@example.com).
-- Everything that depends on them is removed with them, in an order that respects every
-- foreign key. Reviewer accounts, their authenticators (Supabase Auth), settings
-- (including the default reviewer), automation state and the curated seed
-- (@review-seed.invalid) are never touched.
--
-- Every function refuses to run unless review_environment() answers 'synthetic-review'.

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

-- Raises unless this is the synthetic review database.
create or replace function public.review_guard()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v text;
begin
  if to_regprocedure('public.review_environment()') is null then
    raise exception 'not_review_database';
  end if;
  execute 'select public.review_environment()' into v;
  if v is distinct from 'synthetic-review' then
    raise exception 'not_review_database';
  end if;
end;
$$;

-- The synthetic test sign-ins whose work is always test data.
create or replace function public.review_test_actors()
returns text[]
language sql
immutable
security invoker
set search_path = ''
as $$ select array['omar.review@example.com', 'adam.review@example.com', 'outsider.review@example.com'] $$;

-- Removes the given inquiries, prospects, companies and contacts and everything that
-- depends on them. Returns how many rows went from each table.
create or replace function public.review_delete(p_inquiries uuid[], p_prospects uuid[], p_companies uuid[], p_contacts uuid[])
returns table (item text, removed bigint)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_projects uuid[];
  v_proposals uuid[];
  n bigint;
begin
  perform public.review_guard();
  p_inquiries := coalesce(p_inquiries, '{}');
  p_prospects := coalesce(p_prospects, '{}');
  p_companies := coalesce(p_companies, '{}');
  p_contacts := coalesce(p_contacts, '{}');
  v_projects := array(select id from public.crm_projects where inquiry_id = any (p_inquiries));
  v_proposals := array(select id from public.crm_proposals where inquiry_id = any (p_inquiries));

  delete from public.crm_outreach_touches where prospect_id = any (p_prospects);
  get diagnostics n = row_count; item := 'crm_outreach_touches'; removed := n; return next;
  -- A prospect someone else created keeps itself, without the link to a removed inquiry.
  update public.crm_prospects set inquiry_id = null where inquiry_id = any (p_inquiries) and not (id = any (p_prospects));
  update public.crm_prospects set company_id = null where company_id = any (p_companies) and not (id = any (p_prospects));
  delete from public.crm_prospects where id = any (p_prospects);
  get diagnostics n = row_count; item := 'crm_prospects'; removed := n; return next;
  delete from public.crm_projects where id = any (v_projects);
  get diagnostics n = row_count; item := 'crm_projects'; removed := n; return next;
  update public.crm_projects set company_id = null where company_id = any (p_companies);
  update public.crm_projects set contact_id = null where contact_id = any (p_contacts);
  delete from public.crm_proposals where id = any (v_proposals);
  get diagnostics n = row_count; item := 'crm_proposals'; removed := n; return next;
  delete from public.inquiry_crm where inquiry_id = any (p_inquiries);
  get diagnostics n = row_count; item := 'inquiry_crm'; removed := n; return next;
  update public.inquiry_crm set company_id = null where company_id = any (p_companies);
  update public.inquiry_crm set contact_id = null where contact_id = any (p_contacts);
  update public.crm_contacts set company_id = null where company_id = any (p_companies) and not (id = any (p_contacts));
  delete from public.crm_contacts where id = any (p_contacts);
  get diagnostics n = row_count; item := 'crm_contacts'; removed := n; return next;
  delete from public.crm_companies where id = any (p_companies);
  get diagnostics n = row_count; item := 'crm_companies'; removed := n; return next;
  delete from public.crm_activity
  where inquiry_id = any (p_inquiries) or entity_id = any (p_prospects || p_companies || p_contacts || v_projects || v_proposals);
  get diagnostics n = row_count; item := 'crm_activity'; removed := n; return next;
  delete from public.crm_stage_history where inquiry_id = any (p_inquiries);
  get diagnostics n = row_count; item := 'crm_stage_history'; removed := n; return next;
  delete from public.inquiry_follow_ups where inquiry_id = any (p_inquiries);
  get diagnostics n = row_count; item := 'inquiry_follow_ups'; removed := n; return next;
  delete from public.inquiry_notes where inquiry_id = any (p_inquiries);
  get diagnostics n = row_count; item := 'inquiry_notes'; removed := n; return next;
  delete from public.preparation_drafts where inquiry_id = any (p_inquiries);
  get diagnostics n = row_count; item := 'preparation_drafts'; removed := n; return next;
  delete from public.generation_usage where inquiry_id = any (p_inquiries);
  get diagnostics n = row_count; item := 'generation_usage'; removed := n; return next;
  delete from public.inquiry_preparations where inquiry_id = any (p_inquiries);
  get diagnostics n = row_count; item := 'inquiry_preparations'; removed := n; return next;
  delete from public.project_inquiries where id = any (p_inquiries);
  get diagnostics n = row_count; item := 'project_inquiries'; removed := n; return next;
end;
$$;

-- Live-test inquiries, with the evidence each was found by. p_run narrows to one run.
create or replace function public.review_live_test_inquiries(p_run text default null)
returns table (id uuid, evidence text)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.review_guard();
  return query
  select i.id,
    case
      when i.email ~* '^e2e-(ar-)?[0-9]{10}@example\.com$' then 'live-test email (earlier runs)'
      when i.email ~* '@review-run\.invalid$' then 'live-test email (review-run.invalid)'
      when i.cal_booking_id ~ '^review-[0-9a-z]+$' then 'live-test booking id'
      else 'old synthetic fixture (fixed id)'
    end
  from public.project_inquiries as i
  where (
      (p_run is null and (
        i.email ~* '^e2e-(ar-)?[0-9]{10}@example\.com$'
        or i.email ~* '@review-run\.invalid$'
        or i.cal_booking_id ~ '^review-[0-9a-z]+$'
        or i.id in ('11111111-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000004')))
      or (p_run is not null and char_length(p_run) >= 6 and (i.email ilike p_run || '-%@review-run.invalid' or i.cal_booking_id = 'review-' || p_run)));
end;
$$;

-- Dry run by default: what would be removed, by evidence and by table. With
-- p_apply => true it removes exactly that.
create or replace function public.review_purge(p_apply boolean default false, p_run text default null)
returns table (item text, total bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inquiries uuid[];
  v_prospects uuid[];
  v_companies uuid[];
  v_contacts uuid[];
  r record;
begin
  perform public.review_guard();
  v_inquiries := array(select t.id from public.review_live_test_inquiries(p_run) as t);
  v_prospects := array(select p.id from public.crm_prospects as p
                       where p.created_by = any (public.review_test_actors())
                         and (p_run is null or p.contact_handle ilike '%' || p_run || '%' or p.inquiry_id = any (v_inquiries)));
  v_companies := array(select c.id from public.crm_companies as c
                       where c.created_by = any (public.review_test_actors())
                         and (p_run is null or c.id in (select d.company_id from public.inquiry_crm as d where d.inquiry_id = any (v_inquiries))));
  v_contacts := array(select k.id from public.crm_contacts as k
                      where k.created_by = any (public.review_test_actors())
                        and (p_run is null or k.id in (select d.contact_id from public.inquiry_crm as d where d.inquiry_id = any (v_inquiries))));

  for r in select t.evidence, count(*) as n from public.review_live_test_inquiries(p_run) as t group by t.evidence order by t.evidence loop
    item := 'inquiries: ' || r.evidence; total := r.n; return next;
  end loop;
  item := 'prospects created by test sign-ins'; total := cardinality(v_prospects); return next;
  item := 'companies created by test sign-ins'; total := cardinality(v_companies); return next;
  item := 'contacts created by test sign-ins'; total := cardinality(v_contacts); return next;

  if p_apply then
    for r in select * from public.review_delete(v_inquiries, v_prospects, v_companies, v_contacts) loop
      item := 'removed from ' || r.item; total := r.removed; return next;
    end loop;
  else
    item := 'dry run: nothing was removed (call with p_apply => true)'; total := 0; return next;
  end if;
end;
$$;

revoke all on function public.review_guard() from public, anon, authenticated;
revoke all on function public.review_test_actors() from public, anon, authenticated;
revoke all on function public.review_delete(uuid[], uuid[], uuid[], uuid[]) from public, anon, authenticated;
revoke all on function public.review_live_test_inquiries(text) from public, anon, authenticated;
revoke all on function public.review_purge(boolean, text) from public, anon, authenticated;
-- The live tests clean up their own run through the server key (service_role).
grant execute on function public.review_purge(boolean, text) to service_role;
grant execute on function public.review_guard() to service_role;
grant execute on function public.review_test_actors() to service_role;

commit;

-- RECOVERY ONLY. Never apply as a migration; never run unless the runbook says so.
--
-- Removes what the two-founder workflow added
-- (supabase/migrations/20261015000000 and 20261016000000) and puts back the
-- CRM Release 1 behaviour exactly:
--   * the new read functions, settings, pack and action functions and triggers;
--   * the columns: inquiry_crm priority and deal fields, crm_prospects.priority,
--     inquiry_preparations.last_payload and .pack_progress, preparation_drafts.artifact,
--     inquiry_follow_ups.kind (and the owner becomes required again);
--   * the 'waiting_booking' job status (those jobs become 'queued', as before);
--   * the Release 1 definitions of the six functions this workflow changed.
--
-- THIS DELETES: the budget currency of newer inquiries (their range codes stay), the settings, priorities, deal fields, the stored generator
-- input, and the automatic review actions that have no owner (owned ones are
-- kept as ordinary follow-ups). Pack versions are kept as drafts; they lose only
-- their artifact label. Export first; run only on the owner's go-ahead.
-- To remove CRM Release 1 as well, run 03_remove_crm_release_1.sql afterwards.
--
-- One transaction: it either removes everything or nothing.

begin;

drop trigger if exists project_inquiries_pack_on_booking on public.project_inquiries;
drop trigger if exists project_inquiries_pack_on_owners on public.project_inquiries;

drop function if exists public.automation_paused();
drop function if exists public.growth_prospect_list();
drop function if exists public.crm_command_centre(date);
drop function if exists public.lead_detail(uuid);
drop function if exists public.lead_list(jsonb);
drop function if exists public.pack_latest(uuid);
drop function if exists public.crm_set_prospect_priority(uuid, text, text);
drop function if exists public.crm_assign_follow_up(uuid, uuid, text, text);
drop function if exists public.pack_on_owners_change();
drop function if exists public.pack_on_booking_change();
drop function if exists public.pack_review_owner(text[]);
drop function if exists public.pack_review_due(timestamptz);
drop function if exists public.record_pack_payload(uuid, jsonb);
drop function if exists public.pack_finish(uuid, text);
drop function if exists public.pack_progress_set(uuid, jsonb);
drop function if exists public.pack_progress_get(uuid);
drop function if exists public.pack_save_generated(uuid, text, jsonb, text, text);
drop function if exists public.pack_save_all(uuid, jsonb, text, text);
drop function if exists public.dashboard_save_draft(uuid, jsonb, text, text);
drop function if exists public.pack_save_artifact(uuid, text, jsonb, text, text);
drop function if exists public.crm_save_lead(uuid, jsonb, text);
drop function if exists public.crm_set_setting(text, text, text);
drop function if exists public.crm_get_settings();
drop function if exists public.crm_setting(text);
drop table if exists public.crm_settings;

-- Follow-ups: automatic actions without an owner go; the owner is required again.
delete from public.inquiry_follow_ups where owner is null;
drop index if exists public.inquiry_follow_ups_kind_idx;
alter table public.inquiry_follow_ups drop constraint if exists inquiry_follow_ups_owner_required;
alter table public.inquiry_follow_ups drop constraint if exists inquiry_follow_ups_kind_values;
alter table public.inquiry_follow_ups drop column if exists kind;
alter table public.inquiry_follow_ups alter column owner set not null;

-- Pack: artifact label and stored input go; waiting jobs are queued again.
drop index if exists public.preparation_drafts_artifact_idx;
alter table public.preparation_drafts drop constraint if exists preparation_drafts_artifact_values;
alter table public.preparation_drafts drop column if exists artifact;
alter table public.inquiry_preparations drop constraint if exists inquiry_preparations_payload_shape;
alter table public.inquiry_preparations drop column if exists last_payload;
alter table public.inquiry_preparations drop constraint if exists inquiry_preparations_progress_shape;
alter table public.inquiry_preparations drop column if exists pack_progress;
update public.inquiry_preparations set status = 'queued', updated_at = now() where status = 'waiting_booking';
alter table public.inquiry_preparations drop constraint if exists inquiry_preparations_status_values;
alter table public.inquiry_preparations add constraint inquiry_preparations_status_values
  check (status = any (array['queued', 'running', 'retry_scheduled', 'succeeded', 'failed', 'paused', 'manual']));

-- The budget's currency goes; the range codes stay as stored. The two functions
-- that read it return to their earlier definitions.
alter table public.project_inquiries drop constraint if exists project_inquiries_budget_currency_range;
alter table public.project_inquiries drop column if exists budget_currency;
create or replace function public.preparation_input(p_inquiry_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'preferred_language', i.preferred_language,
    'project_type', i.project_type,
    'project_description', i.project_description,
    'budget_range', i.budget_range,
    'timeline', i.timeline,
    'country', i.country)
  from public.project_inquiries as i
  where i.id = p_inquiry_id and i.deleted_at is null;
$$;
create or replace function public.crm_export(p_kind text, p_actor text)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_rows jsonb;
begin
  if p_kind = 'inquiries' then
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id, 'received', i.created_at, 'client', i.full_name, 'company', coalesce(co.name, i.company_name), 'language', i.preferred_language, 'project_type', i.project_type,
        'stage', i.lead_status, 'owners', array_to_string(i.owners, ' & '), 'meeting', i.booking_status, 'meeting_at', i.meeting_start_at,
        'preparation', p.status, 'origin', coalesce(d.lead_origin, 'inbound'), 'source', i.utm_source, 'medium', i.utm_medium, 'campaign', coalesce(d.campaign, i.utm_campaign),
        'content', coalesce(d.content_id, i.utm_content), 'partner', d.referral_partner, 'fit', d.fit_tier, 'score', d.lead_score, 'loss_reason', d.loss_reason,
        'next_action', (select f.action from public.inquiry_follow_ups as f where f.inquiry_id = i.id and f.done_at is null order by f.due_on limit 1),
        'next_action_owner', (select f.owner from public.inquiry_follow_ups as f where f.inquiry_id = i.id and f.done_at is null order by f.due_on limit 1),
        'next_action_due', (select f.due_on from public.inquiry_follow_ups as f where f.inquiry_id = i.id and f.done_at is null order by f.due_on limit 1)
      ) order by i.created_at desc), '[]'::jsonb) into v_rows
    from public.project_inquiries as i
    left join public.inquiry_preparations as p on p.inquiry_id = i.id
    left join public.inquiry_crm as d on d.inquiry_id = i.id
    left join public.crm_companies as co on co.id = d.company_id
    where i.deleted_at is null;
  elsif p_kind = 'companies' then
    select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'website', c.website, 'country', c.country, 'sector', c.sector, 'language', c.language,
        'contacts', (select count(*) from public.crm_contacts as k where k.company_id = c.id and k.archived_at is null), 'created', c.created_at) order by c.name), '[]'::jsonb) into v_rows
    from public.crm_companies as c where c.archived_at is null;
  elsif p_kind = 'contacts' then
    select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'name', k.full_name, 'role', k.role_title, 'company', co.name, 'email', k.email, 'phone', k.phone, 'language', k.preferred_language,
        'consent', k.consent_status, 'consent_at', k.consent_at, 'do_not_contact', k.do_not_contact) order by k.full_name), '[]'::jsonb) into v_rows
    from public.crm_contacts as k left join public.crm_companies as co on co.id = k.company_id where k.archived_at is null;
  elsif p_kind = 'prospects' then
    select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'company', p.company_name, 'country', p.country, 'pool', p.pool, 'origin', p.lead_origin, 'contact', p.contact_name, 'role', p.contact_role,
        'channel', p.contact_channel, 'language', p.language, 'fit', p.fit_tier, 'score', p.lead_score, 'trigger', p.trigger_note, 'owner', p.owner, 'stage', p.stage,
        'next_action', p.follow_up_action, 'next_action_owner', p.follow_up_owner, 'next_action_due', p.follow_up_due_on,
        'outbound_touches', (select count(*) from public.crm_outreach_touches as t where t.prospect_id = p.id and t.kind = 'outbound'),
        'last_touch', (select max(t.occurred_on) from public.crm_outreach_touches as t where t.prospect_id = p.id), 'closed_reason', p.closed_reason) order by p.company_name), '[]'::jsonb) into v_rows
    from public.crm_prospects as p;
  else
    raise exception 'unknown_export';
  end if;
  perform public.crm_log(p_actor, 'export', null, null, 'exported', jsonb_build_object('kind', p_kind, 'rows', jsonb_array_length(v_rows)));
  return v_rows;
end;
$$;

-- Lead and prospect fields.
alter table public.inquiry_crm drop constraint if exists inquiry_crm_signed_has_date;
alter table public.inquiry_crm drop constraint if exists inquiry_crm_contract_lengths;
alter table public.inquiry_crm drop constraint if exists inquiry_crm_contract_values;
alter table public.inquiry_crm drop constraint if exists inquiry_crm_priority_values;
alter table public.inquiry_crm drop column if exists commercial_notes;
alter table public.inquiry_crm drop column if exists contract_reference;
alter table public.inquiry_crm drop column if exists contract_signed_on;
alter table public.inquiry_crm drop column if exists contract_status;
alter table public.inquiry_crm drop column if exists priority;
alter table public.crm_prospects drop constraint if exists crm_prospects_priority_values;
alter table public.crm_prospects drop column if exists priority;

-- The Release 1 definitions (supabase/migrations/20261005000000 and 20261006000000).
create or replace function public.queue_inquiry_preparation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.inquiry_preparations (inquiry_id) values (new.id)
  on conflict (inquiry_id) do nothing;
  return new;
end;
$$;

create or replace function public.dashboard_save_draft(p_inquiry_id uuid, p_content jsonb, p_source text, p_author text)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_version integer;
begin
  if p_source not in ('manual', 'edited') then
    raise exception 'invalid draft source';
  end if;
  if not exists (select 1 from public.project_inquiries where id = p_inquiry_id and deleted_at is null) then
    return null;
  end if;
  perform 1 from public.inquiry_preparations where inquiry_id = p_inquiry_id for update;
  select coalesce(max(version), 0) + 1 into v_version from public.preparation_drafts where inquiry_id = p_inquiry_id;
  insert into public.preparation_drafts (inquiry_id, version, content, source, created_by) values (p_inquiry_id, v_version, p_content, p_source, p_author);
  update public.inquiry_preparations
  set status = 'manual', generator = 'manual', lease_expires_at = null, finished_at = now(), updated_at = now()
  where inquiry_id = p_inquiry_id and status in ('queued', 'retry_scheduled', 'failed', 'paused');
  return v_version;
end;
$$;

create or replace function public.dashboard_review(p_inquiry_id uuid, p_version integer, p_to text, p_reviewer text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_from text;
begin
  select review_status into v_from from public.preparation_drafts where inquiry_id = p_inquiry_id and version = p_version for update;
  if not found then
    return false;
  end if;
  if not ((v_from = 'draft' and p_to = 'in_review')
       or (v_from = 'in_review' and p_to in ('approved', 'draft'))
       or (v_from = 'approved' and p_to = 'draft')) then
    return false;
  end if;
  if p_to = 'approved' then
    update public.preparation_drafts set review_status = 'superseded'
    where inquiry_id = p_inquiry_id and version <> p_version and review_status = 'approved';
  end if;
  update public.preparation_drafts
  set review_status = p_to, reviewed_by = p_reviewer, reviewed_at = now()
  where inquiry_id = p_inquiry_id and version = p_version;
  return true;
end;
$$;

create or replace function public.dashboard_retry_preparation(p_inquiry_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.inquiry_preparations
  set status = 'queued', attempts = 0, last_error = null, next_attempt_at = now(), lease_expires_at = null, finished_at = null, updated_at = now()
  where inquiry_id = p_inquiry_id and status in ('failed', 'paused', 'manual', 'succeeded');
  return found;
end;
$$;

create or replace function public.dashboard_mark_manual(p_inquiry_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.inquiry_preparations
  set status = 'manual', generator = 'manual', lease_expires_at = null, updated_at = now()
  where inquiry_id = p_inquiry_id and status in ('queued', 'retry_scheduled', 'failed', 'paused');
  return found;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.dashboard_save_draft(uuid, jsonb, text, text)', 'public.dashboard_review(uuid, integer, text, text)',
    'public.dashboard_retry_preparation(uuid)', 'public.dashboard_mark_manual(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

commit;

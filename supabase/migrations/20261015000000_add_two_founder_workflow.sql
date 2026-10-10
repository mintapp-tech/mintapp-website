-- Forward-only, additive. The corrected two-founder workflow, part 1 of 2:
-- settings, lead and deal fields, the Pre-meeting Pack, and the booking-triggered
-- next action. Design: docs/two-founder-crm.md.
--
-- What it changes on existing data, and nothing else:
--   * preparation jobs that are still queued for an inquiry without a booked
--     meeting become 'waiting_booking' (no generation before a booking);
--   * every booked meeting still ahead gets the automatic action "Review and
--     approve the pre-meeting pack" (owner: the default owner, if one is set);
--   * existing preparation drafts are labelled artifact 'note'.
-- Nothing is deleted. Every function is service_role only. The Cal.com webhook,
-- the public insert and the booking functions are unchanged; the new triggers
-- report a warning and carry on if they ever fail, so they cannot block a booking.

-- ============================================================
-- 1. Settings (who owns automatic actions when an inquiry has no owner)
-- ============================================================

create table if not exists public.crm_settings (
  key         text primary key,
  value       text,
  updated_by  text not null,
  updated_at  timestamptz not null default now(),
  constraint crm_settings_key_values check (key = any (array['default_owner'])),
  constraint crm_settings_value_shape check (value is null or (key = 'default_owner' and value ~ '^[a-z][a-z0-9-]{0,31}$')),
  constraint crm_settings_updated_by_length check (char_length(updated_by) between 1 and 320)
);
alter table public.crm_settings enable row level security;
revoke all privileges on table public.crm_settings from anon, authenticated, service_role;
grant select, insert, update on table public.crm_settings to service_role;

create or replace function public.crm_setting(p_key text)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select value from public.crm_settings where key = p_key;
$$;

create or replace function public.crm_get_settings()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(key, jsonb_build_object('value', value, 'updated_by', updated_by, 'updated_at', updated_at)), '{}'::jsonb) from public.crm_settings;
$$;

create or replace function public.crm_set_setting(p_key text, p_value text, p_actor text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.crm_settings (key, value, updated_by) values (p_key, nullif(btrim(p_value), ''), p_actor)
  on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now();
  perform public.crm_log(p_actor, 'inquiry', null, null, 'setting_changed', jsonb_build_object('key', p_key));
  return true;
end;
$$;

-- ============================================================
-- 2. Lead and deal fields
-- ============================================================

alter table public.inquiry_crm add column if not exists priority text;
alter table public.inquiry_crm add column if not exists contract_status text;
alter table public.inquiry_crm add column if not exists contract_signed_on date;
alter table public.inquiry_crm add column if not exists contract_reference text;
alter table public.inquiry_crm add column if not exists commercial_notes text;
alter table public.inquiry_crm drop constraint if exists inquiry_crm_priority_values;
alter table public.inquiry_crm add constraint inquiry_crm_priority_values check (priority is null or priority = any (array['high', 'medium', 'low']));
alter table public.inquiry_crm drop constraint if exists inquiry_crm_contract_values;
alter table public.inquiry_crm add constraint inquiry_crm_contract_values check (contract_status is null or contract_status = any (array['not_started', 'sent', 'signed', 'declined']));
alter table public.inquiry_crm drop constraint if exists inquiry_crm_contract_lengths;
alter table public.inquiry_crm add constraint inquiry_crm_contract_lengths check ((contract_reference is null or char_length(contract_reference) <= 200) and (commercial_notes is null or char_length(commercial_notes) <= 4000));
alter table public.inquiry_crm drop constraint if exists inquiry_crm_signed_has_date;
alter table public.inquiry_crm add constraint inquiry_crm_signed_has_date check (contract_status is distinct from 'signed' or contract_signed_on is not null);

alter table public.crm_prospects add column if not exists priority text;
alter table public.crm_prospects drop constraint if exists crm_prospects_priority_values;
alter table public.crm_prospects add constraint crm_prospects_priority_values check (priority is null or priority = any (array['high', 'medium', 'low']));

-- Priority, the paused flag (with its resume date) and the deal. Only the keys
-- present in p_fields change.
create or replace function public.crm_save_lead(p_inquiry_id uuid, p_fields jsonb, p_actor text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_before public.inquiry_crm%rowtype;
begin
  if jsonb_typeof(p_fields) <> 'object' then
    raise exception 'fields_must_be_object';
  end if;
  if not public.crm_ensure(p_inquiry_id) then
    return false;
  end if;
  select * into v_before from public.inquiry_crm where inquiry_id = p_inquiry_id for update;
  update public.inquiry_crm d
  set priority = case when p_fields ? 'priority' then nullif(p_fields ->> 'priority', '') else d.priority end,
      paused_until = case when p_fields ? 'paused_until' then nullif(p_fields ->> 'paused_until', '')::date else d.paused_until end,
      contract_status = case when p_fields ? 'contract_status' then nullif(p_fields ->> 'contract_status', '') else d.contract_status end,
      contract_signed_on = case when p_fields ? 'contract_signed_on' then nullif(p_fields ->> 'contract_signed_on', '')::date else d.contract_signed_on end,
      contract_reference = case when p_fields ? 'contract_reference' then nullif(btrim(p_fields ->> 'contract_reference'), '') else d.contract_reference end,
      commercial_notes = case when p_fields ? 'commercial_notes' then nullif(btrim(p_fields ->> 'commercial_notes'), '') else d.commercial_notes end,
      updated_by = p_actor,
      updated_at = now()
  where d.inquiry_id = p_inquiry_id;
  if p_fields ? 'paused_until' then
    perform public.crm_log(p_actor, 'inquiry', p_inquiry_id, p_inquiry_id,
      case when nullif(p_fields ->> 'paused_until', '') is null then 'lead_resumed' else 'lead_paused' end,
      case when nullif(p_fields ->> 'paused_until', '') is null then '{}'::jsonb else jsonb_build_object('until', p_fields ->> 'paused_until') end);
  end if;
  if p_fields ? 'contract_status' and (p_fields ->> 'contract_status') is distinct from v_before.contract_status then
    perform public.crm_log(p_actor, 'inquiry', p_inquiry_id, p_inquiry_id, 'contract_status', jsonb_build_object('to', p_fields ->> 'contract_status'));
  end if;
  if p_fields ? 'priority' and (p_fields ->> 'priority') is distinct from v_before.priority then
    perform public.crm_log(p_actor, 'inquiry', p_inquiry_id, p_inquiry_id, 'priority_changed', jsonb_build_object('to', nullif(p_fields ->> 'priority', '')));
  end if;
  return true;
end;
$$;

-- ============================================================
-- 3. The Pre-meeting Pack: three artifacts in the versioned drafts table
-- ============================================================

alter table public.inquiry_preparations drop constraint if exists inquiry_preparations_status_values;
alter table public.inquiry_preparations add constraint inquiry_preparations_status_values
  check (status = any (array['waiting_booking', 'queued', 'running', 'retry_scheduled', 'succeeded', 'failed', 'paused', 'manual']));

-- The exact sanitized input last sent to a generator, for audit (never a key,
-- never contact details: it is built from the scrubbed brief).
alter table public.inquiry_preparations add column if not exists last_payload jsonb;
alter table public.inquiry_preparations drop constraint if exists inquiry_preparations_payload_shape;
alter table public.inquiry_preparations add constraint inquiry_preparations_payload_shape
  check (last_payload is null or (jsonb_typeof(last_payload) = 'object' and char_length(last_payload::text) <= 40000));

-- Automated preparation runs in four bounded steps (analysis, design, proposal,
-- discovery). Their progress, so a retry repeats only what did not finish:
-- {"v": 1, "tokens": n, "analysis": {...}, "steps": {"design": "done" | "failed"}, "failures": {...}}.
-- Cleared when the pack finishes. Holds only the validated analysis of the
-- scrubbed brief (never contact details) and step states.
alter table public.inquiry_preparations add column if not exists pack_progress jsonb;
alter table public.inquiry_preparations drop constraint if exists inquiry_preparations_progress_shape;
alter table public.inquiry_preparations add constraint inquiry_preparations_progress_shape
  check (pack_progress is null or (jsonb_typeof(pack_progress) = 'object' and char_length(pack_progress::text) <= 40000));

alter table public.preparation_drafts add column if not exists artifact text not null default 'note';
alter table public.preparation_drafts drop constraint if exists preparation_drafts_artifact_values;
alter table public.preparation_drafts add constraint preparation_drafts_artifact_values check (artifact = any (array['note', 'design', 'proposal', 'discovery']));
create index if not exists preparation_drafts_artifact_idx on public.preparation_drafts (inquiry_id, artifact, version desc);

-- New inquiries wait for a booking; one that somehow arrives already booked is queued.
create or replace function public.queue_inquiry_preparation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.inquiry_preparations (inquiry_id, status)
  values (new.id, case when new.booking_status = 'booked' then 'queued' else 'waiting_booking' end)
  on conflict (inquiry_id) do nothing;
  return new;
end;
$$;

update public.inquiry_preparations as prep
set status = 'waiting_booking', updated_at = now()
from public.project_inquiries as i
where i.id = prep.inquiry_id and prep.status = 'queued' and i.booking_status is distinct from 'booked';

-- "Prepare now" and "retry": hand the pack back to automation, also before a booking.
-- Steps that already finished are kept; steps that failed are tried again, with
-- a fresh per-pack token allowance.
create or replace function public.dashboard_retry_preparation(p_inquiry_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.inquiry_preparations
  set status = 'queued', attempts = 0, last_error = null, next_attempt_at = now(), lease_expires_at = null, finished_at = null, updated_at = now(),
      pack_progress = case when pack_progress is null then null else jsonb_strip_nulls(jsonb_build_object(
        'v', 1, 'tokens', 0, 'analysis', pack_progress -> 'analysis',
        'steps', (select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) from jsonb_each(coalesce(pack_progress -> 'steps', '{}'::jsonb)) as e where e.value = '"done"'::jsonb))) end
  where inquiry_id = p_inquiry_id and status in ('waiting_booking', 'failed', 'paused', 'manual', 'succeeded');
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
  where inquiry_id = p_inquiry_id and status in ('waiting_booking', 'queued', 'retry_scheduled', 'failed', 'paused');
  return found;
end;
$$;

-- A team member's version (pasted from their own Claude chat, or an edit) of
-- one artifact or of the 'note'. Versions are numbered per inquiry. If
-- automation had not produced anything, the job is handed over to manual
-- preparation so it does not later compete with the team.
create or replace function public.pack_save_artifact(p_inquiry_id uuid, p_artifact text, p_content jsonb, p_source text, p_author text)
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
  if p_artifact not in ('note', 'design', 'proposal', 'discovery') then
    raise exception 'invalid_artifact';
  end if;
  if not exists (select 1 from public.project_inquiries where id = p_inquiry_id and deleted_at is null) then
    return null;
  end if;
  perform 1 from public.inquiry_preparations where inquiry_id = p_inquiry_id for update;
  select coalesce(max(version), 0) + 1 into v_version from public.preparation_drafts where inquiry_id = p_inquiry_id;
  insert into public.preparation_drafts (inquiry_id, version, artifact, content, source, created_by) values (p_inquiry_id, v_version, p_artifact, p_content, p_source, p_author);
  update public.inquiry_preparations
  set status = 'manual', generator = 'manual', lease_expires_at = null, finished_at = now(), updated_at = now()
  where inquiry_id = p_inquiry_id and status in ('waiting_booking', 'queued', 'retry_scheduled', 'failed', 'paused');
  return v_version;
end;
$$;

-- The legacy single-draft path keeps working, as a 'note'.
create or replace function public.dashboard_save_draft(p_inquiry_id uuid, p_content jsonb, p_source text, p_author text)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select public.pack_save_artifact(p_inquiry_id, 'note', p_content, p_source, p_author);
$$;

-- A whole pack pasted back from the manual prompt: three versions at once.
create or replace function public.pack_save_all(p_inquiry_id uuid, p_artifacts jsonb, p_source text, p_author text)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_artifact text;
  v_last integer;
begin
  if jsonb_typeof(p_artifacts) <> 'object' or not (p_artifacts ? 'design' and p_artifacts ? 'proposal' and p_artifacts ? 'discovery') then
    raise exception 'pack_incomplete';
  end if;
  foreach v_artifact in array array['design', 'proposal', 'discovery'] loop
    v_last := public.pack_save_artifact(p_inquiry_id, v_artifact, p_artifacts -> v_artifact, p_source, p_author);
    if v_last is null then
      return null;
    end if;
  end loop;
  return v_last;
end;
$$;

-- The worker saves each generated artifact as soon as its step validates, so one
-- step failing never discards another. Only a job the worker still holds
-- (running) can save.
create or replace function public.pack_save_generated(p_inquiry_id uuid, p_artifact text, p_content jsonb, p_source text, p_model text)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_version integer;
begin
  if p_artifact not in ('design', 'proposal', 'discovery') then
    raise exception 'invalid_artifact';
  end if;
  perform 1 from public.inquiry_preparations as prep where prep.inquiry_id = p_inquiry_id and prep.status = 'running' for update;
  if not found then
    return null;
  end if;
  select coalesce(max(draft.version), 0) + 1 into v_version from public.preparation_drafts as draft where draft.inquiry_id = p_inquiry_id;
  insert into public.preparation_drafts (inquiry_id, version, artifact, content, source, model) values (p_inquiry_id, v_version, p_artifact, p_content, p_source, p_model);
  return v_version;
end;
$$;

create or replace function public.pack_progress_get(p_inquiry_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select pack_progress from public.inquiry_preparations where inquiry_id = p_inquiry_id;
$$;

create or replace function public.pack_progress_set(p_inquiry_id uuid, p_progress jsonb)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.inquiry_preparations set pack_progress = p_progress, updated_at = now() where inquiry_id = p_inquiry_id and status = 'running';
  return found;
end;
$$;

-- All three artifacts saved: the job succeeds and its progress is cleared.
create or replace function public.pack_finish(p_inquiry_id uuid, p_model text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.inquiry_preparations
  set status = 'succeeded', last_error = null, lease_expires_at = null, finished_at = now(), model = p_model, pack_progress = null, updated_at = now()
  where inquiry_id = p_inquiry_id and status = 'running';
  return found;
end;
$$;

create or replace function public.record_pack_payload(p_inquiry_id uuid, p_payload jsonb)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.inquiry_preparations set last_payload = p_payload, updated_at = now() where inquiry_id = p_inquiry_id;
  return found;
end;
$$;

-- Review per artifact: approving a version supersedes an earlier approved
-- version of the same artifact only.
create or replace function public.dashboard_review(p_inquiry_id uuid, p_version integer, p_to text, p_reviewer text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_from text;
  v_artifact text;
begin
  select review_status, artifact into v_from, v_artifact from public.preparation_drafts where inquiry_id = p_inquiry_id and version = p_version for update;
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
    where inquiry_id = p_inquiry_id and artifact = v_artifact and version <> p_version and review_status = 'approved';
  end if;
  update public.preparation_drafts
  set review_status = p_to, reviewed_by = p_reviewer, reviewed_at = now()
  where inquiry_id = p_inquiry_id and version = p_version;
  return true;
end;
$$;

-- ============================================================
-- 4. The automatic next action after a booking
-- ============================================================

alter table public.inquiry_follow_ups add column if not exists kind text not null default 'manual';
alter table public.inquiry_follow_ups drop constraint if exists inquiry_follow_ups_kind_values;
alter table public.inquiry_follow_ups add constraint inquiry_follow_ups_kind_values check (kind = any (array['manual', 'pack_review']));
-- Only an automatic action may briefly have no owner (no inquiry owner and no
-- default owner yet); it is shown as "Needs an owner" until someone takes it.
alter table public.inquiry_follow_ups alter column owner drop not null;
alter table public.inquiry_follow_ups drop constraint if exists inquiry_follow_ups_owner_required;
alter table public.inquiry_follow_ups add constraint inquiry_follow_ups_owner_required check (owner is not null or kind = 'pack_review');
create index if not exists inquiry_follow_ups_kind_idx on public.inquiry_follow_ups (inquiry_id) where kind = 'pack_review' and done_at is null;

-- The day before the meeting (Cairo calendar), never before today.
create or replace function public.pack_review_due(p_meeting timestamptz)
returns date
language sql
stable
set search_path = ''
as $$
  select greatest((now() at time zone 'Africa/Cairo')::date,
                  coalesce((p_meeting at time zone 'Africa/Cairo')::date - 1, (now() at time zone 'Africa/Cairo')::date + 1));
$$;

-- Who reviews: the default owner when they own the inquiry, otherwise its first
-- owner, otherwise the default owner, otherwise nobody yet.
create or replace function public.pack_review_owner(p_owners text[])
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    case when public.crm_setting('default_owner') = any (coalesce(p_owners, '{}')) then public.crm_setting('default_owner') end,
    (coalesce(p_owners, '{}'))[1],
    public.crm_setting('default_owner'));
$$;

create or replace function public.pack_on_booking_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.booking_status = 'booked' and old.booking_status is distinct from 'booked' then
    -- Booked: the pack is queued (if it was waiting) and the review action created or moved.
    update public.inquiry_preparations set status = 'queued', next_attempt_at = now(), updated_at = now()
    where inquiry_id = new.id and status = 'waiting_booking';
    update public.inquiry_follow_ups set due_on = public.pack_review_due(new.meeting_start_at)
    where inquiry_id = new.id and kind = 'pack_review' and done_at is null;
    if not found then
      insert into public.inquiry_follow_ups (inquiry_id, kind, action, owner, due_on, created_by)
      values (new.id, 'pack_review', 'Review and approve the pre-meeting pack', public.pack_review_owner(new.owners), public.pack_review_due(new.meeting_start_at), 'system');
    end if;
  elsif new.booking_status = 'booked' and new.meeting_start_at is distinct from old.meeting_start_at then
    -- Rescheduled: the deadline moves; nothing else changes.
    update public.inquiry_follow_ups set due_on = public.pack_review_due(new.meeting_start_at)
    where inquiry_id = new.id and kind = 'pack_review' and done_at is null;
  elsif old.booking_status = 'booked' and new.booking_status is distinct from 'booked' then
    -- Cancelled (or otherwise no longer booked): the action is closed by the
    -- system; the pack and every version stay.
    update public.inquiry_follow_ups set done_at = now(), done_by = 'system'
    where inquiry_id = new.id and kind = 'pack_review' and done_at is null;
  end if;
  return new;
exception when others then
  raise warning 'pack_on_booking_change_failed';
  return new;
end;
$$;
drop trigger if exists project_inquiries_pack_on_booking on public.project_inquiries;
create trigger project_inquiries_pack_on_booking after update of booking_status, meeting_start_at on public.project_inquiries
  for each row execute function public.pack_on_booking_change();

-- An unowned automatic action is given to the inquiry's owner as soon as it has one.
create or replace function public.pack_on_owners_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.inquiry_follow_ups set owner = public.pack_review_owner(new.owners)
  where inquiry_id = new.id and kind = 'pack_review' and done_at is null and owner is null;
  return new;
exception when others then
  raise warning 'pack_on_owners_change_failed';
  return new;
end;
$$;
drop trigger if exists project_inquiries_pack_on_owners on public.project_inquiries;
create trigger project_inquiries_pack_on_owners after update of owners on public.project_inquiries
  for each row execute function public.pack_on_owners_change();

-- Take an action (set its one responsible person).
create or replace function public.crm_assign_follow_up(p_inquiry_id uuid, p_follow_up_id uuid, p_owner text, p_actor text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.inquiry_follow_ups set owner = p_owner
  where id = p_follow_up_id and inquiry_id = p_inquiry_id and done_at is null;
  if not found then
    return false;
  end if;
  perform public.crm_log(p_actor, 'inquiry', p_inquiry_id, p_inquiry_id, 'follow_up_assigned', jsonb_build_object('owner', p_owner));
  return true;
end;
$$;

-- Meetings already booked and still ahead get their review action now.
insert into public.inquiry_follow_ups (inquiry_id, kind, action, owner, due_on, created_by)
select i.id, 'pack_review', 'Review and approve the pre-meeting pack', public.pack_review_owner(i.owners), public.pack_review_due(i.meeting_start_at), 'system'
from public.project_inquiries as i
where i.deleted_at is null and i.booking_status = 'booked' and i.meeting_start_at > now()
  and not exists (select 1 from public.inquiry_follow_ups as f where f.inquiry_id = i.id and f.kind = 'pack_review' and f.done_at is null);

-- ============================================================
-- 5. Prospect priority and quick creation
-- ============================================================

-- Sets only the priority (the six-field quick form saves the rest through
-- crm_save_prospect and crm_set_prospect_follow_up).
create or replace function public.crm_set_prospect_priority(p_id uuid, p_priority text, p_actor text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.crm_prospects set priority = nullif(p_priority, ''), updated_at = now() where id = p_id;
  if not found then
    return false;
  end if;
  perform public.crm_log(p_actor, 'prospect', p_id, null, 'priority_changed', jsonb_build_object('to', nullif(p_priority, '')));
  return true;
end;
$$;

-- ============================================================
-- 6. Access: service_role only
-- ============================================================

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.crm_setting(text)', 'public.crm_get_settings()', 'public.crm_set_setting(text, text, text)',
    'public.crm_save_lead(uuid, jsonb, text)',
    'public.pack_save_artifact(uuid, text, jsonb, text, text)', 'public.pack_save_all(uuid, jsonb, text, text)',
    'public.pack_save_generated(uuid, text, jsonb, text, text)', 'public.pack_progress_get(uuid)', 'public.pack_progress_set(uuid, jsonb)', 'public.pack_finish(uuid, text)', 'public.record_pack_payload(uuid, jsonb)',
    'public.pack_review_due(timestamptz)', 'public.pack_review_owner(text[])',
    'public.pack_on_booking_change()', 'public.pack_on_owners_change()',
    'public.crm_assign_follow_up(uuid, uuid, text, text)', 'public.crm_set_prospect_priority(uuid, text, text)',
    'public.queue_inquiry_preparation()', 'public.dashboard_retry_preparation(uuid)', 'public.dashboard_mark_manual(uuid)',
    'public.dashboard_save_draft(uuid, jsonb, text, text)', 'public.dashboard_review(uuid, integer, text, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

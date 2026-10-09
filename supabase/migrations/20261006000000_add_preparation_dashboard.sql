-- Forward-only, additive. The private team dashboard for inquiry preparation.
--
-- Every read and write the dashboard makes goes through the functions below
-- (service_role only), so the deployed app and the local demo run exactly the
-- same SQL. Access control is enforced by the application before any of these
-- is called (signed team session); nothing here is reachable by anon or
-- authenticated database roles.
--
-- Nothing existing is altered except: one column on project_inquiries
-- (owners, empty by default), and the draft review states widened with
-- 'superseded'.

-- ============================================================
-- 1. Ownership and follow-ups (sales side, not meeting side)
--    An inquiry may be owned by one or more team members (by member id,
--    e.g. 'omar', 'adam'; never by email). Every follow-up has exactly one
--    responsible member and a due date.
-- ============================================================

alter table public.project_inquiries add column if not exists owners text[] not null default '{}';
alter table public.project_inquiries drop constraint if exists owners_shape;
alter table public.project_inquiries add constraint owners_shape
  check (cardinality(owners) <= 5 and array_to_string(owners, ',') ~ '^([a-z][a-z0-9-]{0,31}(,|$))*$');

create table if not exists public.inquiry_follow_ups (
  id          uuid primary key default gen_random_uuid(),
  inquiry_id  uuid not null references public.project_inquiries (id),
  action      text not null,
  owner       text not null,
  due_on      date not null,
  created_by  text not null,
  created_at  timestamptz not null default now(),
  done_at     timestamptz,
  done_by     text,
  constraint inquiry_follow_ups_action_length check (char_length(btrim(action)) between 1 and 500),
  constraint inquiry_follow_ups_owner_shape check (owner ~ '^[a-z][a-z0-9-]{0,31}$'),
  constraint inquiry_follow_ups_people_length check (char_length(created_by) between 1 and 320 and (done_by is null or char_length(done_by) between 1 and 320)),
  constraint inquiry_follow_ups_done_together check ((done_at is null) = (done_by is null))
);
create index if not exists inquiry_follow_ups_open_idx on public.inquiry_follow_ups (inquiry_id, due_on) where done_at is null;
alter table public.inquiry_follow_ups enable row level security;
revoke all privileges on table public.inquiry_follow_ups from anon, authenticated, service_role;
grant select, insert, update on table public.inquiry_follow_ups to service_role;

-- ============================================================
-- 2. Draft review: draft -> in_review -> approved; approving a version
--    supersedes any earlier approved version. Drafts are never edited in
--    place: an edit or a pasted manual draft is a new version.
-- ============================================================

alter table public.preparation_drafts add column if not exists reviewed_by text;
alter table public.preparation_drafts add column if not exists reviewed_at timestamptz;
alter table public.preparation_drafts drop constraint if exists preparation_drafts_review_values;
alter table public.preparation_drafts add constraint preparation_drafts_review_values
  check (review_status = any (array['draft', 'in_review', 'approved', 'superseded']));
alter table public.preparation_drafts drop constraint if exists preparation_drafts_reviewed_by_length;
alter table public.preparation_drafts add constraint preparation_drafts_reviewed_by_length check (reviewed_by is null or char_length(reviewed_by) <= 320);
alter table public.preparation_drafts drop constraint if exists preparation_drafts_source_values;
alter table public.preparation_drafts add constraint preparation_drafts_source_values check (source = any (array['mock', 'codecraft', 'manual', 'edited']));

-- ============================================================
-- 3. Team notes (append-only history)
-- ============================================================

create table if not exists public.inquiry_notes (
  id          uuid primary key default gen_random_uuid(),
  inquiry_id  uuid not null references public.project_inquiries (id),
  author      text not null,
  body        text not null,
  created_at  timestamptz not null default now(),
  constraint inquiry_notes_author_length check (char_length(author) between 1 and 320),
  constraint inquiry_notes_body_length check (char_length(btrim(body)) between 1 and 4000)
);
create index if not exists inquiry_notes_inquiry_idx on public.inquiry_notes (inquiry_id, created_at);

alter table public.inquiry_notes enable row level security;
revoke all privileges on table public.inquiry_notes from anon, authenticated, service_role;
grant select, insert on table public.inquiry_notes to service_role;

-- ============================================================
-- 4. Reads
-- ============================================================

-- What a generator (or a team member's manual brief) may see: the brief and
-- the client's structured answers only. No contact or tracking fields.
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

create or replace function public.dashboard_inquiries()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(row_data order by created_at desc), '[]'::jsonb)
  from (
    select i.created_at,
      jsonb_build_object(
        'id', i.id,
        'created_at', i.created_at,
        'client_name', i.full_name,
        'company_name', i.company_name,
        'language', i.preferred_language,
        'project_type', i.project_type,
        'summary', left(i.project_description, 140),
        'booking_status', i.booking_status,
        'meeting_start_at', i.meeting_start_at,
        'lead_status', i.lead_status,
        'owners', to_jsonb(i.owners),
        'next_follow_up', (
          select jsonb_build_object('action', f.action, 'owner', f.owner, 'due_on', f.due_on)
          from public.inquiry_follow_ups as f
          where f.inquiry_id = i.id and f.done_at is null
          order by f.due_on, f.created_at limit 1),
        'open_follow_ups', (select count(*) from public.inquiry_follow_ups as f where f.inquiry_id = i.id and f.done_at is null),
        'preparation_status', p.status,
        'preparation_error', p.last_error,
        'latest_draft', (
          select jsonb_build_object('version', d.version, 'review_status', d.review_status, 'source', d.source)
          from public.preparation_drafts as d where d.inquiry_id = i.id order by d.version desc limit 1),
        'approved_version', (
          select d.version from public.preparation_drafts as d where d.inquiry_id = i.id and d.review_status = 'approved' order by d.version desc limit 1)
      ) as row_data
    from public.project_inquiries as i
    left join public.inquiry_preparations as p on p.inquiry_id = i.id
    where i.deleted_at is null
  ) as rows;
$$;

create or replace function public.dashboard_inquiry(p_inquiry_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'inquiry', jsonb_build_object(
      'id', i.id, 'created_at', i.created_at,
      'client_name', i.full_name, 'email', i.email, 'phone', i.phone,
      'company_name', i.company_name, 'company_url', i.company_url,
      'language', i.preferred_language, 'project_type', i.project_type,
      'project_description', i.project_description, 'budget_range', i.budget_range,
      'timeline', i.timeline, 'country', i.country,
      'lead_status', i.lead_status, 'owners', to_jsonb(i.owners)),
    'meeting', jsonb_build_object(
      'booking_status', i.booking_status, 'meeting_start_at', i.meeting_start_at,
      'meeting_timezone', i.meeting_timezone, 'cal_booking_id', i.cal_booking_id),
    'preparation', (select to_jsonb(p) - 'inquiry_id' from public.inquiry_preparations as p where p.inquiry_id = i.id),
    'automation', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from public.automation_control as c where c.paused),
    'drafts', (select coalesce(jsonb_agg(to_jsonb(d) - 'inquiry_id' order by d.version desc), '[]'::jsonb) from public.preparation_drafts as d where d.inquiry_id = i.id),
    'notes', (select coalesce(jsonb_agg(to_jsonb(n) - 'inquiry_id' order by n.created_at desc), '[]'::jsonb) from public.inquiry_notes as n where n.inquiry_id = i.id),
    'follow_ups', (select coalesce(jsonb_agg(to_jsonb(f) - 'inquiry_id' order by f.done_at is not null, f.due_on, f.created_at), '[]'::jsonb) from public.inquiry_follow_ups as f where f.inquiry_id = i.id))
  from public.project_inquiries as i
  where i.id = p_inquiry_id and i.deleted_at is null;
$$;

-- ============================================================
-- 5. Writes (each returns true when it changed something)
-- ============================================================

-- Owners as a JSON array of member ids (empty = unassigned). Duplicates are
-- dropped; the shape is enforced by owners_shape.
create or replace function public.dashboard_set_owners(p_inquiry_id uuid, p_owners jsonb)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if jsonb_typeof(p_owners) <> 'array' then
    raise exception 'owners_must_be_array';
  end if;
  update public.project_inquiries
  set owners = array(select distinct value from jsonb_array_elements_text(p_owners) as value order by value), updated_at = now()
  where id = p_inquiry_id and deleted_at is null;
  return found;
end;
$$;

create or replace function public.dashboard_add_follow_up(p_inquiry_id uuid, p_action text, p_owner text, p_due_on date, p_created_by text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.project_inquiries where id = p_inquiry_id and deleted_at is null) then
    return false;
  end if;
  insert into public.inquiry_follow_ups (inquiry_id, action, owner, due_on, created_by)
  values (p_inquiry_id, btrim(p_action), p_owner, p_due_on, p_created_by);
  return true;
end;
$$;

-- Marks an open follow-up done; the inquiry id must match (no cross-inquiry edits).
create or replace function public.dashboard_complete_follow_up(p_inquiry_id uuid, p_follow_up_id uuid, p_done_by text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.inquiry_follow_ups
  set done_at = now(), done_by = p_done_by
  where id = p_follow_up_id and inquiry_id = p_inquiry_id and done_at is null;
  return found;
end;
$$;

create or replace function public.dashboard_add_note(p_inquiry_id uuid, p_author text, p_body text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.project_inquiries where id = p_inquiry_id and deleted_at is null) then
    return false;
  end if;
  insert into public.inquiry_notes (inquiry_id, author, body) values (p_inquiry_id, p_author, btrim(p_body));
  return true;
end;
$$;

-- A team member's draft (pasted from their own tools, or an edit of an
-- earlier version) becomes the next version, as a draft. If automation had
-- not produced anything usable, the job is handed over to manual preparation
-- so automation does not later compete with it.
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

-- Review transitions: draft -> in_review (ready for review), in_review ->
-- approved, in_review -> draft (sent back), approved -> draft (withdrawn).
-- Approving supersedes any other approved version of the same inquiry.
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

-- Hand an inquiry back to automation (after a failure, a pause or a manual
-- hand-over). It runs once automation for the provider is not paused.
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

-- "Prepare this inquiry now": claim one specific inquiry's job if it is
-- waiting (queued or scheduled for a retry), regardless of its retry time,
-- unless automation for the provider is paused.
create or replace function public.claim_preparation_job_for(p_provider text, p_inquiry_id uuid, p_lease_seconds integer)
returns table (inquiry_id uuid, attempts integer)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (select 1 from public.automation_control as ctl where ctl.provider = p_provider and ctl.paused) then
    return;
  end if;
  return query
  update public.inquiry_preparations as prep
  set status = 'running',
      attempts = prep.attempts + 1,
      lease_expires_at = now() + make_interval(secs => greatest(p_lease_seconds, 30)),
      started_at = now(),
      generator = p_provider,
      updated_at = now()
  where prep.inquiry_id = p_inquiry_id
    and prep.status in ('queued', 'retry_scheduled')
    and prep.attempts < prep.max_attempts
    and exists (select 1 from public.project_inquiries as i where i.id = p_inquiry_id and i.deleted_at is null)
  returning prep.inquiry_id, prep.attempts;
end;
$$;

-- ============================================================
-- 6. Privileges: service_role only
-- ============================================================

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.preparation_input(uuid)',
    'public.dashboard_inquiries()',
    'public.dashboard_inquiry(uuid)',
    'public.dashboard_set_owners(uuid, jsonb)',
    'public.dashboard_add_follow_up(uuid, text, text, date, text)',
    'public.dashboard_complete_follow_up(uuid, uuid, text)',
    'public.dashboard_add_note(uuid, text, text)',
    'public.dashboard_save_draft(uuid, jsonb, text, text)',
    'public.dashboard_review(uuid, integer, text, text)',
    'public.dashboard_retry_preparation(uuid)',
    'public.dashboard_mark_manual(uuid)',
    'public.claim_preparation_job_for(text, uuid, integer)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

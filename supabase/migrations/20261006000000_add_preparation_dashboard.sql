-- Forward-only, additive. The private team dashboard for inquiry preparation.
--
-- Every read and write the dashboard makes goes through the functions below
-- (service_role only), so the deployed app and the local demo run exactly the
-- same SQL. Access control is enforced by the application before any of these
-- is called (signed team session); nothing here is reachable by anon or
-- authenticated database roles.
--
-- Nothing existing is altered except: two nullable columns on
-- project_inquiries, and the draft review states widened with 'superseded'.

-- ============================================================
-- 1. Owner and next action on the inquiry (sales side, not meeting side)
-- ============================================================

alter table public.project_inquiries add column if not exists assigned_to text;
alter table public.project_inquiries add column if not exists next_action text;
alter table public.project_inquiries drop constraint if exists assigned_to_length;
alter table public.project_inquiries add constraint assigned_to_length check (assigned_to is null or char_length(assigned_to) <= 320);
alter table public.project_inquiries drop constraint if exists next_action_length;
alter table public.project_inquiries add constraint next_action_length check (next_action is null or char_length(next_action) <= 500);

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
-- 3. Team notes (append-only history) and login throttling
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

-- Keyed by an opaque hash computed by the application (never an email or IP).
create table if not exists public.team_login_attempts (
  key           text primary key,
  failures      integer not null default 0,
  window_start  timestamptz not null default now(),
  locked_until  timestamptz,
  constraint team_login_attempts_key_shape check (key ~ '^[0-9a-f]{64}$')
);

alter table public.inquiry_notes enable row level security;
alter table public.team_login_attempts enable row level security;
revoke all privileges on table public.inquiry_notes, public.team_login_attempts from anon, authenticated, service_role;
grant select, insert on table public.inquiry_notes to service_role;
grant select, insert, update, delete on table public.team_login_attempts to service_role;

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
        'assigned_to', i.assigned_to,
        'next_action', i.next_action,
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
      'lead_status', i.lead_status, 'assigned_to', i.assigned_to, 'next_action', i.next_action),
    'meeting', jsonb_build_object(
      'booking_status', i.booking_status, 'meeting_start_at', i.meeting_start_at,
      'meeting_timezone', i.meeting_timezone, 'cal_booking_id', i.cal_booking_id),
    'preparation', (select to_jsonb(p) - 'inquiry_id' from public.inquiry_preparations as p where p.inquiry_id = i.id),
    'automation', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from public.automation_control as c where c.paused),
    'drafts', (select coalesce(jsonb_agg(to_jsonb(d) - 'inquiry_id' order by d.version desc), '[]'::jsonb) from public.preparation_drafts as d where d.inquiry_id = i.id),
    'notes', (select coalesce(jsonb_agg(to_jsonb(n) - 'inquiry_id' order by n.created_at desc), '[]'::jsonb) from public.inquiry_notes as n where n.inquiry_id = i.id))
  from public.project_inquiries as i
  where i.id = p_inquiry_id and i.deleted_at is null;
$$;

-- ============================================================
-- 5. Writes (each returns true when it changed something)
-- ============================================================

create or replace function public.dashboard_assign(p_inquiry_id uuid, p_owner text, p_next_action text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.project_inquiries
  set assigned_to = nullif(btrim(p_owner), ''), next_action = nullif(btrim(p_next_action), ''), updated_at = now()
  where id = p_inquiry_id and deleted_at is null;
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
-- 6. Login throttling: at most 8 failures per key in 15 minutes, then a
--    15-minute lock. A success clears the key.
-- ============================================================

create or replace function public.team_login_locked(p_key text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((select locked_until > now() from public.team_login_attempts where key = p_key), false);
$$;

create or replace function public.team_login_record(p_key text, p_success boolean)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.team_login_attempts%rowtype;
begin
  if p_success then
    delete from public.team_login_attempts where key = p_key;
    return false;
  end if;
  insert into public.team_login_attempts (key) values (p_key) on conflict (key) do nothing;
  select * into v_row from public.team_login_attempts where key = p_key for update;
  if v_row.window_start < now() - interval '15 minutes' then
    v_row.failures := 0;
    v_row.window_start := now();
  end if;
  v_row.failures := v_row.failures + 1;
  update public.team_login_attempts
  set failures = v_row.failures,
      window_start = v_row.window_start,
      locked_until = case when v_row.failures >= 8 then now() + interval '15 minutes' else locked_until end
  where key = p_key;
  return v_row.failures >= 8;
end;
$$;

-- ============================================================
-- 7. Privileges: service_role only
-- ============================================================

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.preparation_input(uuid)',
    'public.dashboard_inquiries()',
    'public.dashboard_inquiry(uuid)',
    'public.dashboard_assign(uuid, text, text)',
    'public.dashboard_add_note(uuid, text, text)',
    'public.dashboard_save_draft(uuid, jsonb, text, text)',
    'public.dashboard_review(uuid, integer, text, text)',
    'public.dashboard_retry_preparation(uuid)',
    'public.dashboard_mark_manual(uuid)',
    'public.claim_preparation_job_for(text, uuid, integer)',
    'public.team_login_locked(text)',
    'public.team_login_record(text, boolean)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

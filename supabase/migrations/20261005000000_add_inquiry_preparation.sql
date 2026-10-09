-- Forward-only, additive. Internal meeting preparation for each inquiry.
--
-- Every inquiry gets exactly one preparation job, created by a trigger in the
-- same transaction as the inquiry row: a saved inquiry can never be left
-- without its job, whatever happens to the request's background work.
-- Preparation is keyed to the inquiry, never to a booking, so a cancelled or
-- rescheduled meeting does not touch it. Drafts are private, versioned and
-- editable; nothing here is sent or shown to clients.
--
-- Statuses, kept separate from the inquiry's booking_status (meeting) and
-- lead_status (sales):
--   queued           waiting for the worker
--   running          claimed by a worker (lease_expires_at bounds a crash)
--   retry_scheduled  a retryable failure; tried again at next_attempt_at
--   succeeded        a draft was saved
--   failed           gave up (attempts exhausted or a non-retryable error); visible
--   paused           automation paused (quota, budget, configuration); resumed manually
--   manual           the team prepares by hand; the worker never picks it up
--
-- Recovery: nothing existing is altered except an added trigger. Existing
-- inquiries are backfilled as 'manual' so no historical client data is ever
-- sent to automation by this migration.

-- ============================================================
-- 1. Jobs
-- ============================================================

create table if not exists public.inquiry_preparations (
  inquiry_id        uuid primary key references public.project_inquiries (id),
  status            text not null default 'queued',
  attempts          integer not null default 0,
  max_attempts      integer not null default 3,
  next_attempt_at   timestamptz not null default now(),
  lease_expires_at  timestamptz,
  last_error        text,
  generator         text,
  model             text,
  queued_at         timestamptz not null default now(),
  started_at        timestamptz,
  finished_at       timestamptz,
  updated_at        timestamptz not null default now(),
  constraint inquiry_preparations_status_values check (status = any (array['queued', 'running', 'retry_scheduled', 'succeeded', 'failed', 'paused', 'manual'])),
  constraint inquiry_preparations_attempts_range check (attempts >= 0 and max_attempts between 1 and 10 and attempts <= max_attempts),
  constraint inquiry_preparations_error_length check (last_error is null or char_length(last_error) <= 64),
  constraint inquiry_preparations_generator_values check (generator is null or generator = any (array['mock', 'codecraft', 'manual'])),
  constraint inquiry_preparations_model_length check (model is null or char_length(model) <= 120),
  constraint inquiry_preparations_lease_when_running check ((status = 'running') = (lease_expires_at is not null))
);

create index if not exists inquiry_preparations_due_idx on public.inquiry_preparations (next_attempt_at) where (status in ('queued', 'retry_scheduled', 'running'));

-- ============================================================
-- 2. Drafts: versioned, private, editable. Content shape is validated by the
--    application before saving (client facts with evidence, assumptions,
--    questions, suggestions kept apart).
-- ============================================================

create table if not exists public.preparation_drafts (
  id             uuid primary key default gen_random_uuid(),
  inquiry_id     uuid not null references public.project_inquiries (id),
  version        integer not null,
  content        jsonb not null,
  source         text not null,
  model          text,
  review_status  text not null default 'draft',
  created_by     text not null default 'automation',
  created_at     timestamptz not null default now(),
  constraint preparation_drafts_version_key unique (inquiry_id, version),
  constraint preparation_drafts_version_positive check (version >= 1),
  constraint preparation_drafts_content_object check (jsonb_typeof(content) = 'object'),
  constraint preparation_drafts_source_values check (source = any (array['mock', 'codecraft', 'manual'])),
  constraint preparation_drafts_review_values check (review_status = any (array['draft', 'in_review', 'approved'])),
  constraint preparation_drafts_created_by_length check (char_length(created_by) between 1 and 120)
);

-- ============================================================
-- 3. Usage and automation control
-- ============================================================

create table if not exists public.generation_usage (
  id                 uuid primary key default gen_random_uuid(),
  inquiry_id         uuid references public.project_inquiries (id),
  provider           text not null,
  model              text,
  prompt_tokens      integer not null default 0,
  completion_tokens  integer not null default 0,
  total_tokens       integer not null default 0,
  outcome            text not null,
  created_at         timestamptz not null default now(),
  constraint generation_usage_tokens_nonnegative check (prompt_tokens >= 0 and completion_tokens >= 0 and total_tokens >= 0),
  constraint generation_usage_outcome_length check (char_length(outcome) <= 64)
);

create index if not exists generation_usage_provider_month_idx on public.generation_usage (provider, created_at);

create table if not exists public.automation_control (
  provider       text primary key,
  paused         boolean not null default false,
  paused_reason  text,
  paused_at      timestamptz,
  updated_at     timestamptz not null default now(),
  constraint automation_control_reason_length check (paused_reason is null or char_length(paused_reason) <= 64)
);

-- ============================================================
-- 4. A job for every inquiry, atomically
-- ============================================================

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

drop trigger if exists project_inquiries_queue_preparation on public.project_inquiries;
create trigger project_inquiries_queue_preparation
  after insert on public.project_inquiries
  for each row execute function public.queue_inquiry_preparation();

insert into public.inquiry_preparations (inquiry_id, status, generator)
select inquiry.id, 'manual', 'manual' from public.project_inquiries as inquiry
on conflict (inquiry_id) do nothing;

-- ============================================================
-- 5. Worker operations
-- ============================================================

-- Claim due jobs for one provider, skipping rows other workers hold. Jobs whose
-- lease expired are retried while attempts remain, otherwise marked failed.
create or replace function public.claim_preparation_jobs(p_provider text, p_limit integer, p_lease_seconds integer)
returns table (inquiry_id uuid, attempts integer)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.inquiry_preparations as prep
  set status = 'failed', last_error = 'lease_expired', lease_expires_at = null, finished_at = now(), updated_at = now()
  where prep.status = 'running' and prep.lease_expires_at < now() and prep.attempts >= prep.max_attempts;

  if exists (select 1 from public.automation_control as ctl where ctl.provider = p_provider and ctl.paused) then
    return;
  end if;

  return query
  with due as (
    select prep.inquiry_id
    from public.inquiry_preparations as prep
    join public.project_inquiries as inquiry on inquiry.id = prep.inquiry_id
    where inquiry.deleted_at is null
      and prep.attempts < prep.max_attempts
      and (
        (prep.status in ('queued', 'retry_scheduled') and prep.next_attempt_at <= now())
        or (prep.status = 'running' and prep.lease_expires_at < now())
      )
    order by prep.next_attempt_at, prep.inquiry_id
    limit greatest(p_limit, 0)
    for update of prep skip locked
  )
  update public.inquiry_preparations as prep
  set status = 'running',
      attempts = prep.attempts + 1,
      lease_expires_at = now() + make_interval(secs => greatest(p_lease_seconds, 30)),
      started_at = now(),
      generator = p_provider,
      updated_at = now()
  from due
  where prep.inquiry_id = due.inquiry_id
  returning prep.inquiry_id, prep.attempts;
end;
$$;

-- Save a draft version and finish the job. Only a job this worker still holds
-- (running) can be completed.
create or replace function public.complete_preparation(p_inquiry_id uuid, p_content jsonb, p_source text, p_model text)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_version integer;
begin
  perform 1 from public.inquiry_preparations as prep where prep.inquiry_id = p_inquiry_id and prep.status = 'running' for update;
  if not found then
    return null;
  end if;

  select coalesce(max(draft.version), 0) + 1 into v_version from public.preparation_drafts as draft where draft.inquiry_id = p_inquiry_id;
  insert into public.preparation_drafts (inquiry_id, version, content, source, model) values (p_inquiry_id, v_version, p_content, p_source, p_model);

  update public.inquiry_preparations
  set status = 'succeeded', last_error = null, lease_expires_at = null, finished_at = now(), model = p_model, updated_at = now()
  where inquiry_id = p_inquiry_id;
  return v_version;
end;
$$;

-- Record a failed attempt. Retryable failures back off exponentially (at
-- least p_retry_after_seconds) while attempts remain; otherwise the job is
-- failed and stays visible.
create or replace function public.fail_preparation(p_inquiry_id uuid, p_error text, p_retryable boolean, p_retry_after_seconds integer)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_prep public.inquiry_preparations%rowtype;
  v_delay integer;
  v_status text;
begin
  select * into v_prep from public.inquiry_preparations as prep where prep.inquiry_id = p_inquiry_id and prep.status = 'running' for update;
  if not found then
    return null;
  end if;

  if p_retryable and v_prep.attempts < v_prep.max_attempts then
    v_delay := greatest(coalesce(p_retry_after_seconds, 0), 60 * power(2, v_prep.attempts - 1)::integer);
    v_status := 'retry_scheduled';
    update public.inquiry_preparations
    set status = v_status, last_error = p_error, lease_expires_at = null, next_attempt_at = now() + make_interval(secs => v_delay), updated_at = now()
    where inquiry_id = p_inquiry_id;
  else
    v_status := 'failed';
    update public.inquiry_preparations
    set status = v_status, last_error = p_error, lease_expires_at = null, finished_at = now(), updated_at = now()
    where inquiry_id = p_inquiry_id;
  end if;
  return v_status;
end;
$$;

-- Stop automation for a provider (quota or budget exhausted, bad
-- configuration). The current job is paused without spending its attempt.
create or replace function public.pause_preparation_automation(p_provider text, p_reason text, p_inquiry_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.automation_control (provider, paused, paused_reason, paused_at, updated_at)
  values (p_provider, true, p_reason, now(), now())
  on conflict (provider) do update set paused = true, paused_reason = excluded.paused_reason, paused_at = now(), updated_at = now();

  if p_inquiry_id is not null then
    update public.inquiry_preparations
    set status = 'paused', last_error = p_reason, attempts = greatest(attempts - 1, 0), lease_expires_at = null, updated_at = now()
    where inquiry_id = p_inquiry_id and status = 'running';
  end if;
end;
$$;

-- Deliberate, human action: resume a provider and requeue the jobs it paused.
create or replace function public.resume_preparation_automation(p_provider text)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.automation_control set paused = false, paused_reason = null, paused_at = null, updated_at = now() where provider = p_provider;
  update public.inquiry_preparations
  set status = 'queued', next_attempt_at = now(), updated_at = now()
  where status = 'paused' and generator = p_provider;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.record_generation_usage(
  p_inquiry_id uuid, p_provider text, p_model text, p_prompt_tokens integer, p_completion_tokens integer, p_total_tokens integer, p_outcome text
)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.generation_usage (inquiry_id, provider, model, prompt_tokens, completion_tokens, total_tokens, outcome)
  values (p_inquiry_id, p_provider, p_model, greatest(p_prompt_tokens, 0), greatest(p_completion_tokens, 0), greatest(p_total_tokens, 0), p_outcome);
$$;

-- Tokens used by a provider in the current calendar month (UTC).
create or replace function public.monthly_generation_tokens(p_provider text)
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(usage.total_tokens), 0)::bigint
  from public.generation_usage as usage
  where usage.provider = p_provider
    and usage.created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc';
$$;

-- ============================================================
-- 6. Access: server only (service_role), like project_inquiries
-- ============================================================

alter table public.inquiry_preparations enable row level security;
alter table public.preparation_drafts enable row level security;
alter table public.generation_usage enable row level security;
alter table public.automation_control enable row level security;

revoke all privileges on table public.inquiry_preparations, public.preparation_drafts, public.generation_usage, public.automation_control from anon, authenticated, service_role;
grant select, insert, update on table public.inquiry_preparations to service_role;
grant select, insert, update on table public.preparation_drafts to service_role;
grant select, insert on table public.generation_usage to service_role;
grant select, insert, update on table public.automation_control to service_role;

revoke execute on function public.queue_inquiry_preparation() from public, anon, authenticated;
revoke execute on function public.claim_preparation_jobs(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.complete_preparation(uuid, jsonb, text, text) from public, anon, authenticated;
revoke execute on function public.fail_preparation(uuid, text, boolean, integer) from public, anon, authenticated;
revoke execute on function public.pause_preparation_automation(text, text, uuid) from public, anon, authenticated;
revoke execute on function public.resume_preparation_automation(text) from public, anon, authenticated;
revoke execute on function public.record_generation_usage(uuid, text, text, integer, integer, integer, text) from public, anon, authenticated;
revoke execute on function public.monthly_generation_tokens(text) from public, anon, authenticated;

grant execute on function public.claim_preparation_jobs(text, integer, integer) to service_role;
grant execute on function public.complete_preparation(uuid, jsonb, text, text) to service_role;
grant execute on function public.fail_preparation(uuid, text, boolean, integer) to service_role;
grant execute on function public.pause_preparation_automation(text, text, uuid) to service_role;
grant execute on function public.resume_preparation_automation(text) to service_role;
grant execute on function public.record_generation_usage(uuid, text, text, integer, integer, integer, text) to service_role;
grant execute on function public.monthly_generation_tokens(text) to service_role;

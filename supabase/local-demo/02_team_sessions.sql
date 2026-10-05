-- LOCAL SYNTHETIC DEMO ONLY. Never apply to a remote database.
-- Server-side sessions for the local demo's custom team login.

-- Forward-only, additive. Server-side team sessions and fairer login throttling.
--
-- Until now a team session was only a signed cookie: signing out cleared the
-- cookie in that browser, but a copied cookie stayed valid until it expired.
-- Each session now also exists here, so it can be revoked (sign-out, "sign
-- out everywhere") and expires after inactivity. Only a SHA-256 hash of the
-- random session id is stored, never the id itself.
--
-- Login throttling gains a configurable limit, so the application can lock
-- an account-and-client pair quickly while keeping a much higher account-wide
-- ceiling: someone guessing passwords can no longer lock a teammate out with
-- a handful of attempts.

create table if not exists public.team_sessions (
  sid_hash      text primary key,
  email         text not null,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  expires_at    timestamptz not null,
  revoked_at    timestamptz,
  constraint team_sessions_sid_hash_shape check (sid_hash ~ '^[0-9a-f]{64}$'),
  constraint team_sessions_email_length check (char_length(email) between 3 and 320),
  constraint team_sessions_expiry check (expires_at > created_at)
);
create index if not exists team_sessions_email_idx on public.team_sessions (email);

alter table public.team_sessions enable row level security;
revoke all privileges on table public.team_sessions from anon, authenticated, service_role;
grant select, insert, update, delete on table public.team_sessions to service_role;

create or replace function public.team_session_create(p_sid_hash text, p_email text, p_expires_at timestamptz)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Housekeeping: forget sessions that ended more than a week ago.
  delete from public.team_sessions where coalesce(revoked_at, expires_at) < now() - interval '7 days';
  insert into public.team_sessions (sid_hash, email, expires_at) values (p_sid_hash, p_email, p_expires_at);
end;
$$;

-- True when the session exists for this email, is not revoked, has not
-- expired, and was used within p_idle_seconds; refreshes its last use.
create or replace function public.team_session_touch(p_sid_hash text, p_email text, p_idle_seconds integer)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.team_sessions
  set last_seen_at = now()
  where sid_hash = p_sid_hash
    and email = p_email
    and revoked_at is null
    and expires_at > now()
    and last_seen_at > now() - make_interval(secs => greatest(p_idle_seconds, 60));
  return found;
end;
$$;

create or replace function public.team_session_revoke(p_sid_hash text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.team_sessions set revoked_at = now() where sid_hash = p_sid_hash and revoked_at is null;
  return found;
end;
$$;

-- "Sign out everywhere" for one person, e.g. after a lost laptop.
create or replace function public.team_sessions_revoke_all(p_email text)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.team_sessions set revoked_at = now() where email = p_email and revoked_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Like team_login_record, with the failure limit chosen by the caller.
create or replace function public.team_login_record_limited(p_key text, p_success boolean, p_limit integer)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.team_login_attempts%rowtype;
  v_limit integer := least(greatest(p_limit, 3), 100);
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
      locked_until = case when v_row.failures >= v_limit then now() + interval '15 minutes' else locked_until end
  where key = p_key;
  return v_row.failures >= v_limit;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.team_session_create(text, text, timestamptz)',
    'public.team_session_touch(text, text, integer)',
    'public.team_session_revoke(text)',
    'public.team_sessions_revoke_all(text)',
    'public.team_login_record_limited(text, boolean, integer)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

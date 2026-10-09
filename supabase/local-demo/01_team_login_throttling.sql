-- LOCAL SYNTHETIC DEMO ONLY. Never apply to a remote database.
--
-- Login throttling for the local demo's custom team login
-- (src/lib/team-auth). Deployed admin sign-in uses Supabase Auth instead, so
-- these objects are deliberately outside supabase/migrations/ and are applied
-- only by scripts/dashboard-demo.mjs and the database tests.
--
-- At most N failures per key in 15 minutes, then a 15-minute lock. A success
-- clears the key.

-- Keyed by an opaque hash computed by the application (never an email or IP).
create table if not exists public.team_login_attempts (
  key           text primary key,
  failures      integer not null default 0,
  window_start  timestamptz not null default now(),
  locked_until  timestamptz,
  constraint team_login_attempts_key_shape check (key ~ '^[0-9a-f]{64}$')
);

alter table public.team_login_attempts enable row level security;
revoke all privileges on table public.team_login_attempts from anon, authenticated, service_role;
grant select, insert, update, delete on table public.team_login_attempts to service_role;

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

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.team_login_locked(text)',
    'public.team_login_record(text, boolean)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

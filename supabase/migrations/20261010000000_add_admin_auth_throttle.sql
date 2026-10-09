-- Sign-in throttling for the private admin application.
--
-- Supabase Auth owns identity, passwords and MFA. This adds an application
-- level brake in front of the password step: at most 8 failures per key in 15
-- minutes, then a 15-minute lock; a success clears the key. The key is an opaque
-- hash computed by the application (never an email address or an IP address).
-- Additive and idempotent. Only service_role can touch it.

create table if not exists public.admin_auth_throttle (
  key           text primary key,
  failures      integer not null default 0,
  window_start  timestamptz not null default now(),
  locked_until  timestamptz,
  constraint admin_auth_throttle_key_shape check (key ~ '^[0-9a-f]{64}$')
);

alter table public.admin_auth_throttle enable row level security;
revoke all privileges on table public.admin_auth_throttle from anon, authenticated, service_role;
grant select, insert, update, delete on table public.admin_auth_throttle to service_role;

create or replace function public.admin_auth_locked(p_key text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((select locked_until > now() from public.admin_auth_throttle where key = p_key), false);
$$;

-- Returns true when this failure locks the key. p_limit is the failure count
-- (per 15 minutes) that triggers the lock; the application uses a low limit for
-- one account from one client and a higher ceiling for the account overall. p_limit is the failure count
-- (per 15 minutes) that triggers the lock; the application uses a low limit for
-- one account from one client and a higher ceiling for the account overall.
create or replace function public.admin_auth_record(p_key text, p_success boolean, p_limit integer default 8)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.admin_auth_throttle%rowtype;
begin
  if p_success then
    delete from public.admin_auth_throttle where key = p_key;
    return false;
  end if;
  insert into public.admin_auth_throttle (key) values (p_key) on conflict (key) do nothing;
  select * into v_row from public.admin_auth_throttle where key = p_key for update;
  if v_row.window_start < now() - interval '15 minutes' then
    v_row.failures := 0;
    v_row.window_start := now();
  end if;
  v_row.failures := v_row.failures + 1;
  update public.admin_auth_throttle
  set failures = v_row.failures,
      window_start = v_row.window_start,
      locked_until = case when v_row.failures >= greatest(p_limit, 1) then now() + interval '15 minutes' else locked_until end
  where key = p_key;
  return v_row.failures >= greatest(p_limit, 1);
end;
$$;

-- Housekeeping: forget keys that are neither locked nor recent.
create or replace function public.admin_auth_prune()
returns integer
language sql
security invoker
set search_path = ''
as $$
  with gone as (
    delete from public.admin_auth_throttle
    where window_start < now() - interval '1 day' and (locked_until is null or locked_until < now())
    returning 1
  )
  select count(*)::integer from gone;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.admin_auth_locked(text)',
    'public.admin_auth_record(text, boolean, integer)',
    'public.admin_auth_prune()'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

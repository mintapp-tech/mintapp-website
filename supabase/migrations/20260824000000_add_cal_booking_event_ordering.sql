-- Forward-only. Adds cal_booking_event_at for authoritative ordering of
-- out-of-order/duplicate Cal.com webhook deliveries, a partial unique index
-- so two inquiry rows can never claim the same Cal.com booking, and three
-- narrowly-scoped RPC functions that are the only way application code is
-- allowed to write these booking columns from a webhook. No existing index
-- references cal_booking_id, so nothing is dropped here.
--
-- Recovery notes (see docs/supabase-database-permissions.md for the fuller
-- three-tier policy this follows):
--   - Code rollback (bug in the webhook route): use Vercel Instant
--     Rollback. Leave this migration in place — older code simply never
--     reads cal_booking_event_at or calls these functions.
--   - Pre-production reversal ONLY (this migration applied, but zero real
--     Cal.com webhook events have been processed yet): the column/index
--     removal SQL at the bottom of this file is safe to run.
--   - Post-production recovery (real booking events already recorded):
--     never drop the column or the unique index — that destroys ordering
--     history needed to reason about what already happened. Disable
--     webhook processing or roll back the code instead, keep the data,
--     investigate, and write a new reviewed forward-only corrective
--     migration if a schema change turns out to be genuinely necessary.

-- ============================================================
-- 1. New column: authoritative event-ordering timestamp.
-- ============================================================

alter table public.project_inquiries
  add column if not exists cal_booking_event_at timestamptz;

comment on column public.project_inquiries.cal_booking_event_at is
  'createdAt (from the HMAC-verified Cal.com webhook envelope) of the most recently applied booking-status-changing event for this row. Every webhook-driven update is gated on incoming createdAt being strictly greater than this value (null counts as no prior event), so out-of-order or duplicate deliveries can never regress the row to a stale state. Written only by the apply_booking_* functions below.';

-- ============================================================
-- 2. Partial unique index: one inquiry per Cal.com booking.
--
-- Preflight (read-only, run manually IMMEDIATELY BEFORE applying — not
-- days or weeks earlier, and not substituted with this comment's own
-- claims. This migration does not run the preflight automatically and
-- does not delete or merge any row; it is purely informational):
--
--   select cal_booking_id, count(*) as row_count
--   from public.project_inquiries
--   where cal_booking_id is not null
--   group by cal_booking_id
--   having count(*) > 1;
--
-- Expected result: 0 rows. As of when this migration was written, this
-- table has no cal_booking_id-based booking tracking yet at all (this is
-- the migration that introduces it), so 0 rows is the reasonably expected
-- outcome — but repository history cannot guarantee the LIVE database's
-- state at whatever moment this migration is actually applied. Run the
-- preflight yourself, at apply-time, rather than trusting this comment.
--
-- If duplicates ARE found: do not apply this migration yet. The
-- `create unique index` statement below would fail outright (a unique
-- index cannot be created over existing duplicate values — Postgres
-- refuses the whole statement, it does not silently drop or merge
-- rows), so there is no silent-corruption risk either way. Investigate
-- which row is authoritative for each duplicated cal_booking_id first,
-- resolve it with a separate, reviewed, targeted statement, then retry.
-- ============================================================

create unique index if not exists project_inquiries_cal_booking_id_key
  on public.project_inquiries (cal_booking_id)
  where (cal_booking_id is not null);

-- ============================================================
-- 3. RPC functions. Each is the only sanctioned way to write
--    booking_status/cal_booking_id/meeting_start_at/meeting_timezone/
--    cal_booking_event_at — application code never issues a raw UPDATE
--    against these columns. SECURITY INVOKER (not DEFINER): the function
--    runs with the CALLER's own privileges, so it grants nothing beyond
--    what service_role already has (UPDATE on this table, from the
--    20260823000000 migration) — it packages an exact, reviewable
--    conditional-update shape rather than elevating anyone's access.
--    search_path is pinned to '' and every reference is schema-qualified
--    so the function can't be tricked by a search_path manipulation into
--    resolving an object from somewhere unexpected. Every WHERE/RETURNING
--    column is qualified with the "inquiry" alias for the same reason —
--    unambiguous even if a future revision joins another table in. (The
--    SET clause's target-list columns cannot be alias-qualified — that is
--    a Postgres UPDATE syntax restriction, not an oversight here.)
-- ============================================================

create or replace function public.apply_booking_created(
  p_inquiry_id uuid,
  p_uid text,
  p_start_time timestamptz,
  p_timezone text,
  p_event_at timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  update public.project_inquiries as inquiry
  set booking_status = 'booked',
      cal_booking_id = p_uid,
      meeting_start_at = p_start_time,
      meeting_timezone = p_timezone,
      cal_booking_event_at = p_event_at
  where inquiry.id = p_inquiry_id
    and (inquiry.cal_booking_event_at is null or inquiry.cal_booking_event_at < p_event_at)
    and (inquiry.cal_booking_id is null or inquiry.cal_booking_id = p_uid)
  returning inquiry.id into v_id;

  return v_id; -- null if the guard blocked the write (no row matched)
end;
$$;

comment on function public.apply_booking_created(uuid, text, timestamptz, text, timestamptz) is
  'apply_booking_created(p_inquiry_id uuid, p_uid text, p_start_time timestamptz, p_timezone text, p_event_at timestamptz) returns uuid. Applies a BOOKING_CREATED event. p_inquiry_id must already be resolved from a verified signed booking context — this function does no correlation of its own. Returns the row id if applied, null if the ordering/UID guard blocked it (stale event, or the row already holds a different cal_booking_id).';

create or replace function public.apply_booking_cancelled(
  p_inquiry_id uuid,   -- null when correlating by cal_booking_id fallback (no signed context on this event)
  p_uid text,
  p_start_time timestamptz,
  p_timezone text,
  p_event_at timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  update public.project_inquiries as inquiry
  set booking_status = 'cancelled',
      cal_booking_id = p_uid,
      meeting_start_at = p_start_time,
      meeting_timezone = p_timezone,
      cal_booking_event_at = p_event_at
  where (
      (p_inquiry_id is not null and inquiry.id = p_inquiry_id and (inquiry.cal_booking_id is null or inquiry.cal_booking_id = p_uid))
      or
      (p_inquiry_id is null and inquiry.cal_booking_id = p_uid)
    )
    and (inquiry.cal_booking_event_at is null or inquiry.cal_booking_event_at < p_event_at)
  returning inquiry.id into v_id;

  return v_id;
end;
$$;

comment on function public.apply_booking_cancelled(uuid, text, timestamptz, text, timestamptz) is
  'apply_booking_cancelled(p_inquiry_id uuid, p_uid text, p_start_time timestamptz, p_timezone text, p_event_at timestamptz) returns uuid. Applies a BOOKING_CANCELLED event. p_inquiry_id is the id resolved from a verified signed booking context if the event carried one, or null to correlate solely by cal_booking_id = p_uid (an already-linked row only — a null p_inquiry_id can never match a row with a null cal_booking_id, so a no-context cancellation can never be mistaken for a cancellation-first delivery). Returns the row id if applied, null otherwise.';

create or replace function public.apply_booking_rescheduled(
  p_inquiry_id uuid,   -- null when correlating by cal_booking_id fallback (no signed context on this event)
  p_reschedule_uid text,
  p_new_uid text,
  p_start_time timestamptz,
  p_timezone text,
  p_event_at timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  update public.project_inquiries as inquiry
  set cal_booking_id = p_new_uid,
      meeting_start_at = p_start_time,
      meeting_timezone = p_timezone,
      booking_status = 'booked',
      cal_booking_event_at = p_event_at
  where (
      (p_inquiry_id is not null and inquiry.id = p_inquiry_id and (inquiry.cal_booking_id is null or inquiry.cal_booking_id = p_reschedule_uid))
      or
      (p_inquiry_id is null and inquiry.cal_booking_id = p_reschedule_uid)
    )
    and (inquiry.cal_booking_event_at is null or inquiry.cal_booking_event_at < p_event_at)
  returning inquiry.id into v_id;

  return v_id;
end;
$$;

comment on function public.apply_booking_rescheduled(uuid, text, text, timestamptz, text, timestamptz) is
  'apply_booking_rescheduled(p_inquiry_id uuid, p_reschedule_uid text, p_new_uid text, p_start_time timestamptz, p_timezone text, p_event_at timestamptz) returns uuid. Correlates by the OLD uid (payload.rescheduleUid), same context-or-fallback rule as apply_booking_cancelled. Writes the NEW uid (payload.uid). Returns the row id if applied, null otherwise.';

-- ============================================================
-- 4. Privilege lockdown. Postgres functions are executable by PUBLIC by
--    default — each function is explicitly revoked from public/anon/
--    authenticated and granted only to service_role, matching this
--    table's existing grant policy.
-- ============================================================

revoke execute on function public.apply_booking_created(uuid, text, timestamptz, text, timestamptz) from public;
revoke execute on function public.apply_booking_created(uuid, text, timestamptz, text, timestamptz) from anon;
revoke execute on function public.apply_booking_created(uuid, text, timestamptz, text, timestamptz) from authenticated;
grant execute on function public.apply_booking_created(uuid, text, timestamptz, text, timestamptz) to service_role;

revoke execute on function public.apply_booking_cancelled(uuid, text, timestamptz, text, timestamptz) from public;
revoke execute on function public.apply_booking_cancelled(uuid, text, timestamptz, text, timestamptz) from anon;
revoke execute on function public.apply_booking_cancelled(uuid, text, timestamptz, text, timestamptz) from authenticated;
grant execute on function public.apply_booking_cancelled(uuid, text, timestamptz, text, timestamptz) to service_role;

revoke execute on function public.apply_booking_rescheduled(uuid, text, text, timestamptz, text, timestamptz) from public;
revoke execute on function public.apply_booking_rescheduled(uuid, text, text, timestamptz, text, timestamptz) from anon;
revoke execute on function public.apply_booking_rescheduled(uuid, text, text, timestamptz, text, timestamptz) from authenticated;
grant execute on function public.apply_booking_rescheduled(uuid, text, text, timestamptz, text, timestamptz) to service_role;

-- ============================================================
-- 5. Privilege verification (run manually after applying, not part of
--    any automated suite — this checks real Postgres/PostgREST role
--    enforcement, which a mocked test client cannot exercise). Expect
--    the anon/authenticated calls to fail with a permission-denied
--    error, and the service_role call to succeed (or fail only on the
--    ordering/correlation guard, never on privilege).
--
--   -- as service_role (using the real secret key):
--   select public.apply_booking_created(
--     '00000000-0000-0000-0000-000000000000'::uuid, 'test-uid',
--     now(), 'UTC', now());
--   -- expect: NULL (no row with that id) — not a permission error.
--
--   -- as anon or authenticated (using the publishable key):
--   select public.apply_booking_created(
--     '00000000-0000-0000-0000-000000000000'::uuid, 'test-uid',
--     now(), 'UTC', now());
--   -- expect: permission denied for function apply_booking_created
-- ============================================================

-- ============================================================
-- Pre-production reversal ONLY — see the recovery notes at the top of
-- this file. Do not run this once real webhook events have been
-- processed; see the post-production recovery policy instead.
--
--   drop function if exists public.apply_booking_created(uuid, text, timestamptz, text, timestamptz);
--   drop function if exists public.apply_booking_cancelled(uuid, text, timestamptz, text, timestamptz);
--   drop function if exists public.apply_booking_rescheduled(uuid, text, text, timestamptz, text, timestamptz);
--   drop index if exists public.project_inquiries_cal_booking_id_key;
--   alter table public.project_inquiries drop column if exists cal_booking_event_at;
-- ============================================================

-- A client who cancelled their discovery call can book again, and the new
-- booking is linked to the same inquiry.
--
-- Why this is needed: apply_booking_cancelled keeps the cancelled booking's
-- cal_booking_id on the row, and apply_booking_created only accepts a booking
-- whose id is the stored one (or when none is stored). So after a cancellation a
-- new booking, which has a new id, was silently refused and stayed detached from
-- its inquiry, even when it was made from the link in our own email.
--
-- The only change is one extra condition: a row whose status is 'cancelled' also
-- accepts a new booking id. Everything else is unchanged:
--   - a row that holds an ACTIVE booking still refuses any other booking id, so a
--     second booking (two tabs, a double click, a retry) can never replace the
--     first, and the update is a single atomic statement, so two events arriving
--     at the same moment cannot both win;
--   - completed and no_show rows still refuse a new booking;
--   - the event-time ordering guard is untouched, so a late replay of an older
--     event (including the cancelled booking's own creation) is still ignored.
--
-- create or replace keeps the function's existing privileges (service_role only).
-- Not applied to any database by this commit. Apply it before deploying the
-- email recovery link.

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
    and (inquiry.cal_booking_id is null or inquiry.cal_booking_id = p_uid or inquiry.booking_status = 'cancelled')
  returning inquiry.id into v_id;

  return v_id; -- null if the guard blocked the write (no row matched)
end;
$$;

comment on function public.apply_booking_created(uuid, text, timestamptz, text, timestamptz) is
  'apply_booking_created(p_inquiry_id uuid, p_uid text, p_start_time timestamptz, p_timezone text, p_event_at timestamptz) returns uuid. Applies a BOOKING_CREATED event. p_inquiry_id must already be resolved from a verified signed booking context; this function does no correlation of its own. Returns the row id if applied, null if the ordering/UID guard blocked it (a stale event, or the row already holds a different, active cal_booking_id). A row whose booking was cancelled accepts a new booking id.';

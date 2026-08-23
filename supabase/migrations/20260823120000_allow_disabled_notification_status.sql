-- Forward-only: widens notification_status_values to add 'disabled',
-- alongside the existing 'pending' | 'sent' | 'failed'. An intentionally
-- disabled real-email send (see src/lib/email-sending-mode.ts) is not
-- 'pending' — 'pending' means "not yet attempted and still expected to be,"
-- which is false here and could cause an operator to wrongly retry it later.
-- Does not touch the 20260822000000 migration that first created this
-- constraint; this replaces it going forward via the same
-- drop-if-exists/add pattern already used throughout this table's history.
alter table public.project_inquiries drop constraint if exists notification_status_values;
alter table public.project_inquiries add constraint notification_status_values
  check (notification_status = any (array['pending', 'sent', 'failed', 'disabled']));

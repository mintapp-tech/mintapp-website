-- Mintapp — revoke unnecessary public-role privileges on project_inquiries
--
-- RLS (enabled, zero policies) already blocks anon/authenticated from
-- reading or writing rows — but RLS only governs SELECT/INSERT/UPDATE/DELETE.
-- It does not govern TRUNCATE, and the live grants (confirmed via direct SQL
-- inspection) show anon and authenticated both hold REFERENCES, TRIGGER and
-- TRUNCATE on this table, and service_role holds those same three in
-- addition to its needed SELECT/INSERT/UPDATE — none of the six roles have
-- any legitimate use for REFERENCES/TRIGGER/TRUNCATE, since the browser
-- never talks to Supabase directly in this architecture (Data API access is
-- server-only, via service_role, and the server never issues DDL or a
-- TRUNCATE at runtime).
--
-- Corrected from an earlier draft of this migration: a plain
-- `GRANT SELECT, INSERT, UPDATE TO service_role` does not revoke anything —
-- it only adds those three on top of whatever service_role already held, so
-- the earlier draft would have silently left REFERENCES/TRIGGER/TRUNCATE in
-- place on service_role while claiming they were gone. Fixed here by
-- revoking everything from all three roles first, then re-granting only the
-- three actually needed.
--
-- This does not touch RLS, does not add any policy, does not touch any
-- other table, and does not affect the `postgres` role or Supabase
-- dashboard/administrative access (neither of which is `anon`,
-- `authenticated`, or `service_role`).
--
-- REVOKE on a privilege a role doesn't currently hold, and GRANT of a
-- privilege a role already holds, are both safe no-ops in Postgres (no
-- error) — this migration is safe to re-run.

revoke all privileges on table public.project_inquiries from anon;
revoke all privileges on table public.project_inquiries from authenticated;
revoke all privileges on table public.project_inquiries from service_role;

grant select, insert, update
on table public.project_inquiries
to service_role;

-- No sequence privileges are relevant here: the primary key uses
-- gen_random_uuid() (a function call), not a serial/bigserial column, so
-- this table has no associated sequence for any role to need USAGE on.

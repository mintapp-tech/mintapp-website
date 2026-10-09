-- RECOVERY ONLY. Never apply as a migration; never run unless the runbook says so.
--
-- Keeps every table and every row. Stops new inquiries from creating a
-- preparation job, which restores the exact behaviour of the public inquiry
-- insert from before Operations/CRM v1. The dashboard shows an inquiry with no
-- job as "No preparation job" and offers manual preparation, so nothing is
-- lost; run the second script only if the whole feature must be removed.
--
-- To turn job creation back on, run the trigger part of
-- supabase/migrations/20261005000000_add_inquiry_preparation.sql again
-- (section 4); it drops and recreates the trigger.

drop trigger if exists project_inquiries_queue_preparation on public.project_inquiries;

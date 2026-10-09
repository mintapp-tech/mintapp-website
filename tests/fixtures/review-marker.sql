-- SYNTHETIC REVIEW DATABASE ONLY. Never apply to the live (production) database.
--
-- Marks a Supabase project as the isolated synthetic review environment. A
-- Preview of the admin application shows data only when this function exists
-- and answers 'synthetic-review' (src/lib/admin/review-guard.ts), so a Preview
-- pointed at the wrong database by mistake shows nothing.

create or replace function public.review_environment()
returns text
language sql
immutable
security invoker
set search_path = ''
as $$ select 'synthetic-review'::text $$;

revoke execute on function public.review_environment() from public, anon, authenticated;
grant execute on function public.review_environment() to service_role;

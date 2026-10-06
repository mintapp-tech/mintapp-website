-- Additive: let project_type hold "not_sure", the fourth choice on the Start
-- Project form's new project-type question (website, web_app, mobile_app,
-- not_sure).
--
-- Every value that was allowed before stays allowed (including the legacy
-- website_and_mobile and other), so no existing row and no older code is
-- affected, and the column stays nullable: null means "not provided".
-- Apply this BEFORE deploying the form; code deployed first still stores the
-- inquiry, but without a "not_sure" answer (see insert-inquiry.ts).

alter table public.project_inquiries drop constraint if exists project_type_values;
alter table public.project_inquiries add constraint project_type_values
  check (project_type is null or project_type = any (array['website', 'web_app', 'mobile_app', 'website_and_mobile', 'other', 'not_sure']));

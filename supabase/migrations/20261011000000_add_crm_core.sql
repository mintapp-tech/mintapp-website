-- Forward-only, additive. CRM Release 1, part 1 of 4: companies, contacts,
-- the sales pipeline, source attribution and the activity trail.
--
-- Everything is reached through the functions below (service_role only); the
-- application checks the signed-in team member before calling any of them.
-- Nothing here is readable by the anon or authenticated database roles.
--
-- What it touches on existing data, and nothing else:
--   * project_inquiries gets one nullable column (utm_content) for the campaign
--     content identifier captured by the public form;
--   * project_inquiries.lead_status widens from the six early values to the
--     thirteen pipeline stages. The three early values that have a direct
--     successor are carried over (converted -> won, not_a_fit -> lost,
--     archived -> paused). Every inquiry that is still 'new' (all of them,
--     today) is untouched.
--   * triggers append to the activity trail when follow-ups, notes and drafts
--     change; they never alter those rows.
--
-- Sales stage (lead_status) stays separate from the meeting (booking_status),
-- from preparation (inquiry_preparations) and from review (draft review
-- status). Booking, rescheduling and cancelling never change the sales stage.

-- ============================================================
-- 1. Public form tracking and the pipeline stages
-- ============================================================

alter table public.project_inquiries add column if not exists utm_content text;
alter table public.project_inquiries drop constraint if exists utm_content_length;
alter table public.project_inquiries add constraint utm_content_length check (char_length(utm_content) <= 200);

alter table public.project_inquiries drop constraint if exists lead_status_values;
update public.project_inquiries
set lead_status = case lead_status when 'converted' then 'won' when 'not_a_fit' then 'lost' when 'archived' then 'paused' end
where lead_status in ('converted', 'not_a_fit', 'archived');
alter table public.project_inquiries add constraint lead_status_values
  check (lead_status = any (array[
    'new', 'reviewing', 'meeting_booked', 'preparing', 'meeting_ready', 'meeting_completed', 'qualified',
    'proposal_prep', 'proposal_sent', 'negotiation', 'won', 'lost', 'paused']));
comment on column public.project_inquiries.lead_status is
  'Sales pipeline stage only (13 stages). Does NOT track the meeting (booking_status), preparation (inquiry_preparations) or review: never change it because a booking was made, moved or cancelled.';

-- ============================================================
-- 2. Normalising helpers (used for duplicate detection)
-- ============================================================

create or replace function public.crm_host(p_url text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(regexp_replace(regexp_replace(lower(btrim(coalesce(p_url, ''))), '^[a-z][a-z0-9+.-]*://', ''), '^www\.|[/?#:].*$', '', 'g'), '');
$$;

create or replace function public.crm_name_key(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(regexp_replace(lower(btrim(coalesce(p_name, ''))), '[\s\-_.,()''"&/\\]+', '', 'g'), '');
$$;

create or replace function public.crm_phone_key(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when char_length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 7 then regexp_replace(p_phone, '\D', '', 'g') end;
$$;

create or replace function public.crm_email_key(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(lower(btrim(coalesce(p_email, ''))), '');
$$;

-- A lead score is seven categories, each 0 to 2 (campaign playbook, section 11).
create or replace function public.crm_score_valid(p_score jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_score is null or (
    jsonb_typeof(p_score) = 'object'
    and not exists (
      select 1 from jsonb_each(p_score) as e
      where e.key <> all (array['trigger', 'problem', 'access', 'proof', 'timing', 'commercial', 'geo'])
         or jsonb_typeof(e.value) <> 'number'
         or e.value::text !~ '^[012]$'));
$$;

create or replace function public.crm_score_total(p_score jsonb)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select case when p_score is null or not public.crm_score_valid(p_score) then null
              else (select coalesce(sum((e.value)::text::integer), 0)::smallint from jsonb_each(p_score) as e) end;
$$;

-- ============================================================
-- 3. Activity trail (append-only, attributable, no personal data in detail)
-- ============================================================

create table if not exists public.crm_activity (
  id           uuid primary key default gen_random_uuid(),
  at           timestamptz not null default now(),
  actor        text not null,
  entity_type  text not null,
  entity_id    uuid,
  inquiry_id   uuid references public.project_inquiries (id),
  action       text not null,
  detail       jsonb not null default '{}'::jsonb,
  constraint crm_activity_actor_length check (char_length(actor) between 1 and 320),
  constraint crm_activity_entity_type_values check (entity_type = any (array['inquiry', 'company', 'contact', 'proposal', 'project', 'prospect', 'export', 'preparation'])),
  constraint crm_activity_action_shape check (action ~ '^[a-z_]{1,64}$'),
  constraint crm_activity_detail_object check (jsonb_typeof(detail) = 'object' and char_length(detail::text) <= 2000)
);
create index if not exists crm_activity_at_idx on public.crm_activity (at desc);
create index if not exists crm_activity_inquiry_idx on public.crm_activity (inquiry_id, at desc) where inquiry_id is not null;
alter table public.crm_activity enable row level security;
revoke all privileges on table public.crm_activity from anon, authenticated, service_role;
grant select, insert on table public.crm_activity to service_role;

create or replace function public.crm_log(p_actor text, p_entity_type text, p_entity_id uuid, p_inquiry_id uuid, p_action text, p_detail jsonb default '{}'::jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.crm_activity (actor, entity_type, entity_id, inquiry_id, action, detail)
  values (coalesce(nullif(btrim(p_actor), ''), 'system'), p_entity_type, p_entity_id, p_inquiry_id, p_action, coalesce(p_detail, '{}'::jsonb));
$$;

-- The existing team writes (follow-ups, notes, drafts) are recorded by
-- triggers, so the trail is complete whichever function made the change.
create or replace function public.crm_trail_follow_up()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.crm_log(new.created_by, 'inquiry', new.inquiry_id, new.inquiry_id, 'follow_up_added', jsonb_build_object('owner', new.owner, 'due_on', new.due_on));
  elsif old.done_at is null and new.done_at is not null then
    perform public.crm_log(new.done_by, 'inquiry', new.inquiry_id, new.inquiry_id, 'follow_up_done', jsonb_build_object('owner', new.owner));
  end if;
  return new;
end;
$$;
drop trigger if exists inquiry_follow_ups_trail on public.inquiry_follow_ups;
create trigger inquiry_follow_ups_trail after insert or update on public.inquiry_follow_ups
  for each row execute function public.crm_trail_follow_up();

create or replace function public.crm_trail_note()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.crm_log(new.author, 'inquiry', new.inquiry_id, new.inquiry_id, 'note_added', '{}'::jsonb);
  return new;
end;
$$;
drop trigger if exists inquiry_notes_trail on public.inquiry_notes;
create trigger inquiry_notes_trail after insert on public.inquiry_notes
  for each row execute function public.crm_trail_note();

create or replace function public.crm_trail_draft()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.crm_log(new.created_by, 'preparation', new.id, new.inquiry_id, 'draft_saved', jsonb_build_object('version', new.version, 'source', new.source));
  elsif old.review_status is distinct from new.review_status then
    perform public.crm_log(coalesce(new.reviewed_by, 'system'), 'preparation', new.id, new.inquiry_id, 'draft_review', jsonb_build_object('version', new.version, 'to', new.review_status));
  end if;
  return new;
end;
$$;
drop trigger if exists preparation_drafts_trail on public.preparation_drafts;
create trigger preparation_drafts_trail after insert or update on public.preparation_drafts
  for each row execute function public.crm_trail_draft();

-- ============================================================
-- 4. Companies and contacts
-- ============================================================

create table if not exists public.crm_companies (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  name_key      text not null,
  website       text,
  website_host  text,
  country       text,
  sector        text,
  language      text,
  created_by    text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  archived_at   timestamptz,
  constraint crm_companies_name_length check (char_length(btrim(name)) between 1 and 160),
  constraint crm_companies_website_length check (website is null or char_length(website) <= 300),
  constraint crm_companies_country_length check (country is null or char_length(country) <= 80),
  constraint crm_companies_sector_length check (sector is null or char_length(sector) <= 120),
  constraint crm_companies_language_values check (language is null or language = any (array['en', 'ar'])),
  constraint crm_companies_created_by_length check (char_length(created_by) between 1 and 320)
);
create index if not exists crm_companies_name_key_idx on public.crm_companies (name_key);
create index if not exists crm_companies_host_idx on public.crm_companies (website_host) where website_host is not null;

create table if not exists public.crm_contacts (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid references public.crm_companies (id),
  full_name           text not null,
  role_title          text,
  email               text,
  email_key           text,
  phone               text,
  phone_key           text,
  preferred_language  text,
  consent_status      text not null default 'not_recorded',
  consent_at          timestamptz,
  do_not_contact      boolean not null default false,
  created_by          text not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  archived_at         timestamptz,
  constraint crm_contacts_name_length check (char_length(btrim(full_name)) between 1 and 160),
  constraint crm_contacts_role_length check (role_title is null or char_length(role_title) <= 120),
  constraint crm_contacts_email_length check (email is null or char_length(email) <= 320),
  constraint crm_contacts_phone_length check (phone is null or char_length(phone) <= 60),
  constraint crm_contacts_language_values check (preferred_language is null or preferred_language = any (array['en', 'ar'])),
  constraint crm_contacts_consent_values check (consent_status = any (array['form_consent', 'given_other', 'not_recorded', 'withdrawn'])),
  constraint crm_contacts_withdrawn_blocks_contact check (consent_status <> 'withdrawn' or do_not_contact),
  constraint crm_contacts_created_by_length check (char_length(created_by) between 1 and 320)
);
create index if not exists crm_contacts_company_idx on public.crm_contacts (company_id) where company_id is not null;
create index if not exists crm_contacts_email_key_idx on public.crm_contacts (email_key) where email_key is not null;
create index if not exists crm_contacts_phone_key_idx on public.crm_contacts (phone_key) where phone_key is not null;

-- One row per inquiry that the CRM has something to say about. An inquiry
-- needs neither a company nor a contact. Created on first use.
create table if not exists public.inquiry_crm (
  inquiry_id        uuid primary key references public.project_inquiries (id),
  company_id        uuid references public.crm_companies (id),
  contact_id        uuid references public.crm_contacts (id),
  lead_origin       text,
  referral_partner  text,
  campaign          text,
  content_id        text,
  fit_tier          text,
  score             jsonb,
  lead_score        smallint,
  trigger_note      text,
  research_note     text,
  loss_reason       text,
  loss_note         text,
  paused_until      date,
  stage_changed_at  timestamptz not null default now(),
  won_at            timestamptz,
  lost_at           timestamptz,
  updated_by        text,
  updated_at        timestamptz not null default now(),
  constraint inquiry_crm_origin_values check (lead_origin is null or lead_origin = any (array['inbound', 'warm', 'outbound', 'referral', 'partner'])),
  constraint inquiry_crm_partner_length check (referral_partner is null or char_length(referral_partner) <= 120),
  constraint inquiry_crm_campaign_length check (campaign is null or char_length(campaign) <= 120),
  constraint inquiry_crm_content_length check (content_id is null or char_length(content_id) <= 120),
  constraint inquiry_crm_fit_values check (fit_tier is null or fit_tier = any (array['tier_1', 'tier_2', 'tier_3', 'partner', 'poor_fit'])),
  constraint inquiry_crm_score_valid check (public.crm_score_valid(score)),
  constraint inquiry_crm_lead_score_range check (lead_score is null or lead_score between 0 and 14),
  constraint inquiry_crm_trigger_length check (trigger_note is null or char_length(trigger_note) <= 500),
  constraint inquiry_crm_research_length check (research_note is null or char_length(research_note) <= 2000),
  constraint inquiry_crm_loss_reason_values check (loss_reason is null or loss_reason = any (array['no_budget', 'no_response', 'not_a_fit', 'chose_other', 'timing', 'scope', 'client_withdrew', 'other'])),
  constraint inquiry_crm_loss_note_length check (loss_note is null or char_length(loss_note) <= 500),
  constraint inquiry_crm_updated_by_length check (updated_by is null or char_length(updated_by) <= 320)
);
create index if not exists inquiry_crm_company_idx on public.inquiry_crm (company_id) where company_id is not null;
create index if not exists inquiry_crm_contact_idx on public.inquiry_crm (contact_id) where contact_id is not null;

-- Every change of sales stage, who made it and why. Append-only.
create table if not exists public.crm_stage_history (
  id          uuid primary key default gen_random_uuid(),
  inquiry_id  uuid not null references public.project_inquiries (id),
  from_stage  text,
  to_stage    text not null,
  actor       text not null,
  reason      text,
  created_at  timestamptz not null default now(),
  constraint crm_stage_history_actor_length check (char_length(actor) between 1 and 320),
  constraint crm_stage_history_reason_length check (reason is null or char_length(reason) <= 64)
);
create index if not exists crm_stage_history_inquiry_idx on public.crm_stage_history (inquiry_id, created_at);
create index if not exists crm_stage_history_stage_idx on public.crm_stage_history (to_stage, created_at);

do $$
declare
  t text;
begin
  foreach t in array array['crm_companies', 'crm_contacts', 'inquiry_crm', 'crm_stage_history'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all privileges on table public.%I from anon, authenticated, service_role', t);
  end loop;
end;
$$;
grant select, insert, update on table public.crm_companies, public.crm_contacts, public.inquiry_crm to service_role;
grant select, insert on table public.crm_stage_history to service_role;

-- ============================================================
-- 5. Writes
-- ============================================================

create or replace function public.crm_ensure(p_inquiry_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.project_inquiries where id = p_inquiry_id and deleted_at is null) then
    return false;
  end if;
  insert into public.inquiry_crm (inquiry_id) values (p_inquiry_id) on conflict (inquiry_id) do nothing;
  return true;
end;
$$;

-- Create (p_id null) or edit a company. Only the keys present in p_fields change.
create or replace function public.crm_save_company(p_id uuid, p_fields jsonb, p_actor text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_name text;
begin
  if jsonb_typeof(p_fields) <> 'object' then
    raise exception 'fields_must_be_object';
  end if;
  if p_id is null then
    v_name := nullif(btrim(p_fields ->> 'name'), '');
    if v_name is null then
      raise exception 'name_required';
    end if;
    insert into public.crm_companies (name, name_key, website, website_host, country, sector, language, created_by)
    values (v_name, coalesce(public.crm_name_key(v_name), v_name), nullif(btrim(p_fields ->> 'website'), ''), public.crm_host(p_fields ->> 'website'),
            nullif(btrim(p_fields ->> 'country'), ''), nullif(btrim(p_fields ->> 'sector'), ''), nullif(p_fields ->> 'language', ''), p_actor)
    returning id into v_id;
    perform public.crm_log(p_actor, 'company', v_id, null, 'company_created', '{}'::jsonb);
    return v_id;
  end if;
  update public.crm_companies c
  set name = coalesce(nullif(btrim(p_fields ->> 'name'), ''), c.name),
      name_key = coalesce(public.crm_name_key(p_fields ->> 'name'), c.name_key),
      website = case when p_fields ? 'website' then nullif(btrim(p_fields ->> 'website'), '') else c.website end,
      website_host = case when p_fields ? 'website' then public.crm_host(p_fields ->> 'website') else c.website_host end,
      country = case when p_fields ? 'country' then nullif(btrim(p_fields ->> 'country'), '') else c.country end,
      sector = case when p_fields ? 'sector' then nullif(btrim(p_fields ->> 'sector'), '') else c.sector end,
      language = case when p_fields ? 'language' then nullif(p_fields ->> 'language', '') else c.language end,
      updated_at = now()
  where c.id = p_id and c.archived_at is null
  returning c.id into v_id;
  if v_id is not null then
    perform public.crm_log(p_actor, 'company', v_id, null, 'company_updated', '{}'::jsonb);
  end if;
  return v_id;
end;
$$;

-- Create (p_id null) or edit a contact. A contact may have no company.
create or replace function public.crm_save_contact(p_id uuid, p_company_id uuid, p_fields jsonb, p_actor text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_name text;
  v_status text;
begin
  if jsonb_typeof(p_fields) <> 'object' then
    raise exception 'fields_must_be_object';
  end if;
  if p_company_id is not null and not exists (select 1 from public.crm_companies where id = p_company_id and archived_at is null) then
    raise exception 'company_not_found';
  end if;
  v_status := nullif(p_fields ->> 'consent_status', '');
  if p_id is null then
    v_name := nullif(btrim(p_fields ->> 'full_name'), '');
    if v_name is null then
      raise exception 'name_required';
    end if;
    insert into public.crm_contacts (company_id, full_name, role_title, email, email_key, phone, phone_key, preferred_language, consent_status, consent_at, do_not_contact, created_by)
    values (p_company_id, v_name, nullif(btrim(p_fields ->> 'role_title'), ''), nullif(btrim(p_fields ->> 'email'), ''), public.crm_email_key(p_fields ->> 'email'),
            nullif(btrim(p_fields ->> 'phone'), ''), public.crm_phone_key(p_fields ->> 'phone'), nullif(p_fields ->> 'preferred_language', ''),
            coalesce(v_status, 'not_recorded'), case when v_status in ('form_consent', 'given_other') then coalesce((p_fields ->> 'consent_at')::timestamptz, now()) end,
            coalesce((p_fields ->> 'do_not_contact')::boolean, false) or coalesce(v_status = 'withdrawn', false), p_actor)
    returning id into v_id;
    perform public.crm_log(p_actor, 'contact', v_id, null, 'contact_created', '{}'::jsonb);
    return v_id;
  end if;
  update public.crm_contacts c
  set company_id = case when p_fields ? 'company_id' then p_company_id else c.company_id end,
      full_name = coalesce(nullif(btrim(p_fields ->> 'full_name'), ''), c.full_name),
      role_title = case when p_fields ? 'role_title' then nullif(btrim(p_fields ->> 'role_title'), '') else c.role_title end,
      email = case when p_fields ? 'email' then nullif(btrim(p_fields ->> 'email'), '') else c.email end,
      email_key = case when p_fields ? 'email' then public.crm_email_key(p_fields ->> 'email') else c.email_key end,
      phone = case when p_fields ? 'phone' then nullif(btrim(p_fields ->> 'phone'), '') else c.phone end,
      phone_key = case when p_fields ? 'phone' then public.crm_phone_key(p_fields ->> 'phone') else c.phone_key end,
      preferred_language = case when p_fields ? 'preferred_language' then nullif(p_fields ->> 'preferred_language', '') else c.preferred_language end,
      consent_status = coalesce(v_status, c.consent_status),
      consent_at = case when v_status in ('form_consent', 'given_other') and v_status is distinct from c.consent_status then now() when v_status is not null and v_status not in ('form_consent', 'given_other') then null else c.consent_at end,
      do_not_contact = case when v_status = 'withdrawn' then true when p_fields ? 'do_not_contact' then (p_fields ->> 'do_not_contact')::boolean else c.do_not_contact end,
      updated_at = now()
  where c.id = p_id and c.archived_at is null
  returning c.id into v_id;
  if v_id is not null then
    perform public.crm_log(p_actor, 'contact', v_id, null, 'contact_updated', case when v_status is null then '{}'::jsonb else jsonb_build_object('consent_status', v_status) end);
  end if;
  return v_id;
end;
$$;

-- Points an inquiry at an existing company and/or contact (either may be null).
create or replace function public.crm_link_inquiry(p_inquiry_id uuid, p_company_id uuid, p_contact_id uuid, p_actor text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.crm_ensure(p_inquiry_id) then
    return false;
  end if;
  if p_company_id is not null and not exists (select 1 from public.crm_companies where id = p_company_id and archived_at is null) then
    raise exception 'company_not_found';
  end if;
  if p_contact_id is not null and not exists (
    select 1 from public.crm_contacts where id = p_contact_id and archived_at is null and (company_id is null or p_company_id is null or company_id = p_company_id)) then
    raise exception 'contact_not_found';
  end if;
  update public.inquiry_crm set company_id = p_company_id, contact_id = p_contact_id, updated_by = p_actor, updated_at = now() where inquiry_id = p_inquiry_id;
  perform public.crm_log(p_actor, 'inquiry', p_inquiry_id, p_inquiry_id, 'inquiry_linked', jsonb_build_object('company', p_company_id is not null, 'contact', p_contact_id is not null));
  return true;
end;
$$;

-- Builds the contact (and optionally the company) from what the client typed
-- in the form. An existing contact with the same email is reused, never
-- duplicated or merged. p_company_mode: 'none', 'existing' (p_company_id) or
-- 'new' (from the company name the client gave).
create or replace function public.crm_create_from_inquiry(p_inquiry_id uuid, p_company_mode text, p_company_id uuid, p_actor text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  i public.project_inquiries%rowtype;
  v_company uuid;
  v_contact uuid;
  v_reused boolean := false;
begin
  select * into i from public.project_inquiries where id = p_inquiry_id and deleted_at is null;
  if not found then
    return null;
  end if;
  if p_company_mode not in ('none', 'existing', 'new') then
    raise exception 'invalid_company_mode';
  end if;
  if p_company_mode = 'existing' then
    if p_company_id is null or not exists (select 1 from public.crm_companies where id = p_company_id and archived_at is null) then
      raise exception 'company_not_found';
    end if;
    v_company := p_company_id;
  elsif p_company_mode = 'new' then
    if nullif(btrim(i.company_name), '') is null then
      raise exception 'no_company_name';
    end if;
    v_company := public.crm_save_company(null, jsonb_build_object('name', i.company_name, 'website', i.company_url, 'country', i.country, 'language', i.preferred_language), p_actor);
  end if;

  select c.id into v_contact from public.crm_contacts as c
  where c.email_key = public.crm_email_key(i.email) and c.archived_at is null order by c.created_at limit 1;
  if v_contact is null then
    v_contact := public.crm_save_contact(null, v_company,
      jsonb_build_object('full_name', i.full_name, 'email', i.email, 'phone', i.phone, 'preferred_language', i.preferred_language,
                         'consent_status', case when i.consent_given then 'form_consent' else 'not_recorded' end, 'consent_at', i.consent_at),
      p_actor);
  else
    v_reused := true;
    if v_company is not null then
      update public.crm_contacts set company_id = coalesce(company_id, v_company), updated_at = now() where id = v_contact;
    end if;
  end if;
  perform public.crm_link_inquiry(p_inquiry_id, coalesce(v_company, (select company_id from public.crm_contacts where id = v_contact)), v_contact, p_actor);
  return jsonb_build_object('company_id', (select company_id from public.inquiry_crm where inquiry_id = p_inquiry_id), 'contact_id', v_contact, 'contact_reused', v_reused);
end;
$$;

-- Source, qualification and research for an inquiry. Only the keys present change.
create or replace function public.crm_save_inquiry_details(p_inquiry_id uuid, p_fields jsonb, p_actor text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_score jsonb;
begin
  if jsonb_typeof(p_fields) <> 'object' then
    raise exception 'fields_must_be_object';
  end if;
  if not public.crm_ensure(p_inquiry_id) then
    return false;
  end if;
  v_score := case when p_fields ? 'score' then nullif(p_fields -> 'score', 'null'::jsonb) else (select score from public.inquiry_crm where inquiry_id = p_inquiry_id) end;
  update public.inquiry_crm d
  set lead_origin = case when p_fields ? 'lead_origin' then nullif(p_fields ->> 'lead_origin', '') else d.lead_origin end,
      referral_partner = case when p_fields ? 'referral_partner' then nullif(btrim(p_fields ->> 'referral_partner'), '') else d.referral_partner end,
      campaign = case when p_fields ? 'campaign' then nullif(btrim(p_fields ->> 'campaign'), '') else d.campaign end,
      content_id = case when p_fields ? 'content_id' then nullif(btrim(p_fields ->> 'content_id'), '') else d.content_id end,
      fit_tier = case when p_fields ? 'fit_tier' then nullif(p_fields ->> 'fit_tier', '') else d.fit_tier end,
      score = v_score,
      lead_score = public.crm_score_total(v_score),
      trigger_note = case when p_fields ? 'trigger_note' then nullif(btrim(p_fields ->> 'trigger_note'), '') else d.trigger_note end,
      research_note = case when p_fields ? 'research_note' then nullif(btrim(p_fields ->> 'research_note'), '') else d.research_note end,
      updated_by = p_actor,
      updated_at = now()
  where d.inquiry_id = p_inquiry_id;
  perform public.crm_log(p_actor, 'inquiry', p_inquiry_id, p_inquiry_id, 'details_updated', '{}'::jsonb);
  return true;
end;
$$;

-- Moves an inquiry to a sales stage. Never called by anything that handles
-- bookings: the team decides. Losing needs a reason from the fixed list.
create or replace function public.crm_set_stage(p_inquiry_id uuid, p_to text, p_actor text, p_reason text default null, p_note text default null, p_paused_until date default null)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_from text;
begin
  if p_to is null or p_to <> all (array['new', 'reviewing', 'meeting_booked', 'preparing', 'meeting_ready', 'meeting_completed', 'qualified', 'proposal_prep', 'proposal_sent', 'negotiation', 'won', 'lost', 'paused']) then
    raise exception 'invalid_stage';
  end if;
  select lead_status into v_from from public.project_inquiries where id = p_inquiry_id and deleted_at is null for update;
  if not found then
    return null;
  end if;
  if v_from = p_to then
    return jsonb_build_object('changed', false, 'from', v_from, 'to', p_to);
  end if;
  if p_to = 'lost' and (p_reason is null or p_reason <> all (array['no_budget', 'no_response', 'not_a_fit', 'chose_other', 'timing', 'scope', 'client_withdrew', 'other'])) then
    raise exception 'loss_reason_required';
  end if;
  update public.project_inquiries set lead_status = p_to where id = p_inquiry_id;
  perform public.crm_ensure(p_inquiry_id);
  update public.inquiry_crm
  set stage_changed_at = now(),
      won_at = case when p_to = 'won' then now() else null end,
      lost_at = case when p_to = 'lost' then now() else null end,
      loss_reason = case when p_to = 'lost' then p_reason else null end,
      loss_note = case when p_to = 'lost' then nullif(btrim(p_note), '') else null end,
      paused_until = case when p_to = 'paused' then p_paused_until else null end,
      updated_by = p_actor,
      updated_at = now()
  where inquiry_id = p_inquiry_id;
  insert into public.crm_stage_history (inquiry_id, from_stage, to_stage, actor, reason) values (p_inquiry_id, v_from, p_to, p_actor, p_reason);
  perform public.crm_log(p_actor, 'inquiry', p_inquiry_id, p_inquiry_id, 'stage_changed', jsonb_build_object('from', v_from, 'to', p_to));
  return jsonb_build_object('changed', true, 'from', v_from, 'to', p_to);
end;
$$;

-- Same as dashboard_set_owners, with the person who changed it on the trail.
create or replace function public.crm_set_owners(p_inquiry_id uuid, p_owners jsonb, p_actor text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_before text[];
  v_after text[];
begin
  if jsonb_typeof(p_owners) <> 'array' then
    raise exception 'owners_must_be_array';
  end if;
  select owners into v_before from public.project_inquiries where id = p_inquiry_id and deleted_at is null;
  if not found then
    return false;
  end if;
  v_after := array(select distinct value from jsonb_array_elements_text(p_owners) as value order by value);
  update public.project_inquiries set owners = v_after, updated_at = now() where id = p_inquiry_id;
  if v_before is distinct from v_after then
    perform public.crm_log(p_actor, 'inquiry', p_inquiry_id, p_inquiry_id, 'owners_changed', jsonb_build_object('from', to_jsonb(v_before), 'to', to_jsonb(v_after)));
  end if;
  return true;
end;
$$;

-- ============================================================
-- 6. Duplicate detection (read-only: nothing is ever merged or deleted)
-- ============================================================

-- Other records that look like the same client as this inquiry. Ids and
-- company/person names only; contact details are never returned.
create or replace function public.crm_inquiry_duplicates(p_inquiry_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'contacts', (
      select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.full_name, 'company', co.name) order by c.created_at), '[]'::jsonb)
      from public.crm_contacts as c left join public.crm_companies as co on co.id = c.company_id
      where c.archived_at is null and ((c.email_key is not null and c.email_key = public.crm_email_key(i.email)) or (c.phone_key is not null and c.phone_key = public.crm_phone_key(i.phone)))),
    'companies', (
      select coalesce(jsonb_agg(jsonb_build_object('id', co.id, 'name', co.name) order by co.created_at), '[]'::jsonb)
      from public.crm_companies as co
      where co.archived_at is null and ((public.crm_name_key(i.company_name) is not null and co.name_key = public.crm_name_key(i.company_name))
        or (public.crm_host(i.company_url) is not null and co.website_host = public.crm_host(i.company_url)))),
    'inquiries', (
      select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'created_at', o.created_at, 'client_name', o.full_name) order by o.created_at), '[]'::jsonb)
      from public.project_inquiries as o
      where o.id <> i.id and o.deleted_at is null and (public.crm_email_key(o.email) = public.crm_email_key(i.email)
        or (public.crm_phone_key(o.phone) is not null and public.crm_phone_key(o.phone) = public.crm_phone_key(i.phone)))))
  from public.project_inquiries as i
  where i.id = p_inquiry_id and i.deleted_at is null;
$$;

-- ============================================================
-- 7. Access: service_role only
-- ============================================================

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.crm_host(text)', 'public.crm_name_key(text)', 'public.crm_phone_key(text)', 'public.crm_email_key(text)',
    'public.crm_score_valid(jsonb)', 'public.crm_score_total(jsonb)',
    'public.crm_log(text, text, uuid, uuid, text, jsonb)',
    'public.crm_trail_follow_up()', 'public.crm_trail_note()', 'public.crm_trail_draft()',
    'public.crm_ensure(uuid)', 'public.crm_save_company(uuid, jsonb, text)', 'public.crm_save_contact(uuid, uuid, jsonb, text)',
    'public.crm_link_inquiry(uuid, uuid, uuid, text)', 'public.crm_create_from_inquiry(uuid, text, uuid, text)',
    'public.crm_save_inquiry_details(uuid, jsonb, text)', 'public.crm_set_stage(uuid, text, text, text, text, date)',
    'public.crm_set_owners(uuid, jsonb, text)', 'public.crm_inquiry_duplicates(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

-- Forward-only, additive. CRM Release 1, part 3 of 4: the outreach workflow
-- from the go-to-market campaign (research, score, four touches, follow-up,
-- hand-over to an inquiry).
--
-- This records what the team does; it sends nothing. There is no message
-- sending anywhere in the CRM, and nothing here can contact a prospect.
-- A prospect marked "do not contact" cannot have an outbound touch logged.

create table if not exists public.crm_prospects (
  id                 uuid primary key default gen_random_uuid(),
  company_name       text not null,
  website            text,
  country            text,
  sector             text,
  pool               text,
  lead_origin        text not null default 'outbound',
  contact_name       text,
  contact_role       text,
  contact_channel    text,
  contact_handle     text,
  language           text,
  fit_tier           text,
  score              jsonb,
  lead_score         smallint,
  trigger_note       text,
  observation        text,
  proof_case         text,
  fit_reason         text,
  owner              text not null,
  stage              text not null default 'identified',
  follow_up_action   text,
  follow_up_owner    text,
  follow_up_due_on   date,
  closed_reason      text,
  do_not_contact     boolean not null default false,
  company_id         uuid references public.crm_companies (id),
  inquiry_id         uuid references public.project_inquiries (id),
  created_by         text not null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint crm_prospects_company_length check (char_length(btrim(company_name)) between 1 and 160),
  constraint crm_prospects_website_length check (website is null or char_length(website) <= 300),
  constraint crm_prospects_country_length check (country is null or char_length(country) <= 80),
  constraint crm_prospects_sector_length check (sector is null or char_length(sector) <= 120),
  constraint crm_prospects_pool_values check (pool is null or pool = any (array['warm', 'trigger_startup', 'operational_sme', 'referral_partner'])),
  constraint crm_prospects_origin_values check (lead_origin = any (array['warm', 'outbound', 'referral', 'partner'])),
  constraint crm_prospects_contact_length check ((contact_name is null or char_length(contact_name) <= 120) and (contact_role is null or char_length(contact_role) <= 120) and (contact_handle is null or char_length(contact_handle) <= 200)),
  constraint crm_prospects_channel_values check (contact_channel is null or contact_channel = any (array['linkedin', 'email', 'whatsapp', 'phone', 'introduction', 'other'])),
  constraint crm_prospects_language_values check (language is null or language = any (array['en', 'ar'])),
  constraint crm_prospects_fit_values check (fit_tier is null or fit_tier = any (array['tier_1', 'tier_2', 'tier_3', 'partner', 'poor_fit'])),
  constraint crm_prospects_score_valid check (public.crm_score_valid(score)),
  constraint crm_prospects_lead_score_range check (lead_score is null or lead_score between 0 and 14),
  constraint crm_prospects_notes_length check ((trigger_note is null or char_length(trigger_note) <= 500) and (observation is null or char_length(observation) <= 1000)
    and (proof_case is null or char_length(proof_case) <= 300) and (fit_reason is null or char_length(fit_reason) <= 1000)),
  constraint crm_prospects_owner_shape check (owner ~ '^[a-z][a-z0-9-]{0,31}$'),
  constraint crm_prospects_stage_values check (stage = any (array['identified', 'researched', 'contacted', 'replied', 'qualified', 'inquiry_submitted', 'not_now', 'disqualified'])),
  constraint crm_prospects_follow_up_shape check (follow_up_owner is null or follow_up_owner ~ '^[a-z][a-z0-9-]{0,31}$'),
  constraint crm_prospects_follow_up_length check (follow_up_action is null or char_length(btrim(follow_up_action)) between 1 and 500),
  -- A follow-up has an action, exactly one responsible person and a due date, or none of the three.
  constraint crm_prospects_follow_up_whole check ((follow_up_action is null) = (follow_up_owner is null) and (follow_up_owner is null) = (follow_up_due_on is null)),
  -- Every open prospect (still being worked) has a next action with an owner and a date.
  constraint crm_prospects_open_has_follow_up check (stage not in ('contacted', 'replied', 'qualified') or follow_up_due_on is not null),
  constraint crm_prospects_closed_reason check (closed_reason is null or char_length(closed_reason) <= 300),
  constraint crm_prospects_created_by_length check (char_length(created_by) between 1 and 320)
);
create index if not exists crm_prospects_stage_idx on public.crm_prospects (stage);
create index if not exists crm_prospects_follow_up_idx on public.crm_prospects (follow_up_due_on) where follow_up_due_on is not null;

-- One row per outreach touch the team made or received. A touch records what
-- happened in a sentence; it never stores the message itself.
create table if not exists public.crm_outreach_touches (
  id           uuid primary key default gen_random_uuid(),
  prospect_id  uuid not null references public.crm_prospects (id),
  kind         text not null,
  touch_no     smallint,
  channel      text,
  occurred_on  date not null,
  summary      text not null,
  created_by   text not null,
  created_at   timestamptz not null default now(),
  constraint crm_outreach_touches_kind_values check (kind = any (array['outbound', 'reply', 'meeting', 'note'])),
  constraint crm_outreach_touches_no_range check (touch_no is null or touch_no between 1 and 4),
  constraint crm_outreach_touches_outbound_no check (kind <> 'outbound' or touch_no is not null),
  constraint crm_outreach_touches_channel_values check (channel is null or channel = any (array['linkedin', 'email', 'whatsapp', 'phone', 'introduction', 'other'])),
  constraint crm_outreach_touches_summary_length check (char_length(btrim(summary)) between 1 and 500),
  constraint crm_outreach_touches_created_by_length check (char_length(created_by) between 1 and 320)
);
create index if not exists crm_outreach_touches_prospect_idx on public.crm_outreach_touches (prospect_id, occurred_on, created_at);

do $$
declare
  t text;
begin
  foreach t in array array['crm_prospects', 'crm_outreach_touches'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all privileges on table public.%I from anon, authenticated, service_role', t);
  end loop;
end;
$$;
grant select, insert, update on table public.crm_prospects to service_role;
grant select, insert on table public.crm_outreach_touches to service_role;

-- Create (p_id null) or edit a prospect. Only the keys present in p_fields change.
create or replace function public.crm_save_prospect(p_id uuid, p_fields jsonb, p_actor text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_name text;
  v_score jsonb;
begin
  if jsonb_typeof(p_fields) <> 'object' then
    raise exception 'fields_must_be_object';
  end if;
  if p_id is null then
    v_name := nullif(btrim(p_fields ->> 'company_name'), '');
    if v_name is null then
      raise exception 'name_required';
    end if;
    v_score := nullif(p_fields -> 'score', 'null'::jsonb);
    insert into public.crm_prospects (company_name, website, country, sector, pool, lead_origin, contact_name, contact_role, contact_channel, contact_handle, language,
                                      fit_tier, score, lead_score, trigger_note, observation, proof_case, fit_reason, owner, created_by)
    values (v_name, nullif(btrim(p_fields ->> 'website'), ''), nullif(btrim(p_fields ->> 'country'), ''), nullif(btrim(p_fields ->> 'sector'), ''), nullif(p_fields ->> 'pool', ''),
            coalesce(nullif(p_fields ->> 'lead_origin', ''), 'outbound'), nullif(btrim(p_fields ->> 'contact_name'), ''), nullif(btrim(p_fields ->> 'contact_role'), ''),
            nullif(p_fields ->> 'contact_channel', ''), nullif(btrim(p_fields ->> 'contact_handle'), ''), nullif(p_fields ->> 'language', ''),
            nullif(p_fields ->> 'fit_tier', ''), v_score, public.crm_score_total(v_score), nullif(btrim(p_fields ->> 'trigger_note'), ''), nullif(btrim(p_fields ->> 'observation'), ''),
            nullif(btrim(p_fields ->> 'proof_case'), ''), nullif(btrim(p_fields ->> 'fit_reason'), ''), coalesce(nullif(p_fields ->> 'owner', ''), p_actor), p_actor)
    returning id into v_id;
    perform public.crm_log(p_actor, 'prospect', v_id, null, 'prospect_created', '{}'::jsonb);
    return v_id;
  end if;
  v_score := case when p_fields ? 'score' then nullif(p_fields -> 'score', 'null'::jsonb) else (select score from public.crm_prospects where id = p_id) end;
  update public.crm_prospects p
  set company_name = coalesce(nullif(btrim(p_fields ->> 'company_name'), ''), p.company_name),
      website = case when p_fields ? 'website' then nullif(btrim(p_fields ->> 'website'), '') else p.website end,
      country = case when p_fields ? 'country' then nullif(btrim(p_fields ->> 'country'), '') else p.country end,
      sector = case when p_fields ? 'sector' then nullif(btrim(p_fields ->> 'sector'), '') else p.sector end,
      pool = case when p_fields ? 'pool' then nullif(p_fields ->> 'pool', '') else p.pool end,
      lead_origin = coalesce(nullif(p_fields ->> 'lead_origin', ''), p.lead_origin),
      contact_name = case when p_fields ? 'contact_name' then nullif(btrim(p_fields ->> 'contact_name'), '') else p.contact_name end,
      contact_role = case when p_fields ? 'contact_role' then nullif(btrim(p_fields ->> 'contact_role'), '') else p.contact_role end,
      contact_channel = case when p_fields ? 'contact_channel' then nullif(p_fields ->> 'contact_channel', '') else p.contact_channel end,
      contact_handle = case when p_fields ? 'contact_handle' then nullif(btrim(p_fields ->> 'contact_handle'), '') else p.contact_handle end,
      language = case when p_fields ? 'language' then nullif(p_fields ->> 'language', '') else p.language end,
      fit_tier = case when p_fields ? 'fit_tier' then nullif(p_fields ->> 'fit_tier', '') else p.fit_tier end,
      score = v_score,
      lead_score = public.crm_score_total(v_score),
      trigger_note = case when p_fields ? 'trigger_note' then nullif(btrim(p_fields ->> 'trigger_note'), '') else p.trigger_note end,
      observation = case when p_fields ? 'observation' then nullif(btrim(p_fields ->> 'observation'), '') else p.observation end,
      proof_case = case when p_fields ? 'proof_case' then nullif(btrim(p_fields ->> 'proof_case'), '') else p.proof_case end,
      fit_reason = case when p_fields ? 'fit_reason' then nullif(btrim(p_fields ->> 'fit_reason'), '') else p.fit_reason end,
      owner = coalesce(nullif(p_fields ->> 'owner', ''), p.owner),
      do_not_contact = case when p_fields ? 'do_not_contact' then (p_fields ->> 'do_not_contact')::boolean else p.do_not_contact end,
      updated_at = now()
  where p.id = p_id
  returning p.id into v_id;
  if v_id is not null then
    perform public.crm_log(p_actor, 'prospect', v_id, null, 'prospect_updated', '{}'::jsonb);
  end if;
  return v_id;
end;
$$;

-- Moves a prospect along the outreach stages. Moving into an active stage
-- needs the next action, its one responsible person and a date; closing
-- (not now / disqualified) clears the follow-up and needs a reason.
create or replace function public.crm_set_prospect_stage(
  p_id uuid, p_to text, p_actor text,
  p_follow_up_action text default null, p_follow_up_owner text default null, p_follow_up_due_on date default null, p_reason text default null)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_from text;
begin
  if p_to is null or p_to <> all (array['identified', 'researched', 'contacted', 'replied', 'qualified', 'inquiry_submitted', 'not_now', 'disqualified']) then
    raise exception 'invalid_stage';
  end if;
  select stage into v_from from public.crm_prospects where id = p_id for update;
  if not found then
    return false;
  end if;
  if p_to in ('contacted', 'replied', 'qualified') and (p_follow_up_due_on is null or nullif(btrim(p_follow_up_action), '') is null or p_follow_up_owner is null) then
    raise exception 'follow_up_required';
  end if;
  if p_to in ('not_now', 'disqualified') and nullif(btrim(p_reason), '') is null then
    raise exception 'reason_required';
  end if;
  update public.crm_prospects
  set stage = p_to,
      follow_up_action = case when p_to in ('not_now', 'disqualified', 'inquiry_submitted') then null else nullif(btrim(p_follow_up_action), '') end,
      follow_up_owner = case when p_to in ('not_now', 'disqualified', 'inquiry_submitted') then null else p_follow_up_owner end,
      follow_up_due_on = case when p_to in ('not_now', 'disqualified', 'inquiry_submitted') then null else p_follow_up_due_on end,
      closed_reason = case when p_to in ('not_now', 'disqualified') then btrim(p_reason) else null end,
      updated_at = now()
  where id = p_id;
  perform public.crm_log(p_actor, 'prospect', p_id, null, 'prospect_stage', jsonb_build_object('from', v_from, 'to', p_to));
  return true;
end;
$$;

-- Replaces the open next action (one at a time, one responsible person, a date).
create or replace function public.crm_set_prospect_follow_up(p_id uuid, p_action text, p_owner text, p_due_on date, p_actor text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if nullif(btrim(p_action), '') is null or p_owner is null or p_due_on is null then
    raise exception 'follow_up_required';
  end if;
  update public.crm_prospects set follow_up_action = btrim(p_action), follow_up_owner = p_owner, follow_up_due_on = p_due_on, updated_at = now()
  where id = p_id and stage not in ('not_now', 'disqualified', 'inquiry_submitted');
  if not found then
    return false;
  end if;
  perform public.crm_log(p_actor, 'prospect', p_id, null, 'prospect_follow_up', jsonb_build_object('owner', p_owner, 'due_on', p_due_on));
  return true;
end;
$$;

-- Records a touch. An outbound touch is refused for anyone marked do-not-contact.
-- Logging the first outbound touch moves an identified/researched prospect to
-- contacted; a reply moves a contacted prospect to replied. Both need the next
-- action the caller supplies, so nobody is left without a date.
create or replace function public.crm_log_touch(
  p_prospect_id uuid, p_kind text, p_touch_no integer, p_channel text, p_occurred_on date, p_summary text, p_actor text,
  p_next_action text default null, p_next_owner text default null, p_next_due_on date default null)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  p public.crm_prospects%rowtype;
begin
  select * into p from public.crm_prospects where id = p_prospect_id for update;
  if not found then
    return false;
  end if;
  if p_kind = 'outbound' and p.do_not_contact then
    raise exception 'do_not_contact';
  end if;
  if p.stage in ('not_now', 'disqualified', 'inquiry_submitted') and p_kind in ('outbound', 'reply') then
    raise exception 'prospect_closed';
  end if;
  insert into public.crm_outreach_touches (prospect_id, kind, touch_no, channel, occurred_on, summary, created_by)
  values (p_prospect_id, p_kind, case when p_kind = 'outbound' then p_touch_no end, p_channel, p_occurred_on, btrim(p_summary), p_actor);
  if p_kind = 'outbound' and p.stage in ('identified', 'researched') then
    perform public.crm_set_prospect_stage(p_prospect_id, 'contacted', p_actor, p_next_action, p_next_owner, p_next_due_on);
  elsif p_kind = 'reply' and p.stage in ('identified', 'researched', 'contacted') then
    perform public.crm_set_prospect_stage(p_prospect_id, 'replied', p_actor, p_next_action, p_next_owner, p_next_due_on);
  elsif p_next_due_on is not null and nullif(btrim(p_next_action), '') is not null and p_next_owner is not null and p.stage not in ('not_now', 'disqualified', 'inquiry_submitted') then
    perform public.crm_set_prospect_follow_up(p_prospect_id, p_next_action, p_next_owner, p_next_due_on, p_actor);
  end if;
  perform public.crm_log(p_actor, 'prospect', p_prospect_id, null, 'touch_logged', jsonb_build_object('kind', p_kind, 'touch', p_touch_no));
  return true;
end;
$$;

-- Connects a prospect to the inquiry it turned into: the inquiry takes over the
-- origin, tier, score, trigger and research, and the prospect is marked as
-- having submitted. The reverse is not done automatically; nothing is merged.
create or replace function public.crm_link_prospect_inquiry(p_prospect_id uuid, p_inquiry_id uuid, p_actor text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  p public.crm_prospects%rowtype;
begin
  select * into p from public.crm_prospects where id = p_prospect_id for update;
  if not found or not public.crm_ensure(p_inquiry_id) then
    return false;
  end if;
  update public.inquiry_crm d
  set lead_origin = coalesce(p.lead_origin, d.lead_origin),
      fit_tier = coalesce(p.fit_tier, d.fit_tier),
      score = coalesce(p.score, d.score),
      lead_score = coalesce(p.lead_score, d.lead_score),
      trigger_note = coalesce(p.trigger_note, d.trigger_note),
      research_note = coalesce(left(concat_ws(E'\n', p.observation, p.fit_reason), 2000), d.research_note),
      company_id = coalesce(d.company_id, p.company_id),
      updated_by = p_actor,
      updated_at = now()
  where d.inquiry_id = p_inquiry_id;
  update public.crm_prospects
  set inquiry_id = p_inquiry_id, stage = 'inquiry_submitted', follow_up_action = null, follow_up_owner = null, follow_up_due_on = null, updated_at = now()
  where id = p_prospect_id;
  perform public.crm_log(p_actor, 'prospect', p_prospect_id, p_inquiry_id, 'prospect_linked', '{}'::jsonb);
  return true;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.crm_save_prospect(uuid, jsonb, text)', 'public.crm_set_prospect_stage(uuid, text, text, text, text, date, text)',
    'public.crm_set_prospect_follow_up(uuid, text, text, date, text)',
    'public.crm_log_touch(uuid, text, integer, text, date, text, text, text, text, date)',
    'public.crm_link_prospect_inquiry(uuid, uuid, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

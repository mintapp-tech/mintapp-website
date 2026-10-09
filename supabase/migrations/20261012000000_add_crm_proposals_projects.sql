-- Forward-only, additive. CRM Release 1, part 2 of 4: proposal / scope records
-- and the minimal project record created when an opportunity is won.
--
-- A proposal is only a record. Nothing here sends anything to anyone: "sent"
-- is a status a team member sets after they sent it themselves, and it can only
-- be set on a version a teammate has approved. Proposals never change the
-- sales stage by themselves.

-- ============================================================
-- 1. Proposal / scope records (versioned; never edited after review starts)
-- ============================================================

create table if not exists public.crm_proposals (
  id                 uuid primary key default gen_random_uuid(),
  inquiry_id         uuid not null references public.project_inquiries (id),
  version            integer not null,
  status             text not null default 'draft',
  summary            text,
  recommended_scope  text,
  deliverables       text,
  exclusions         text,
  assumptions        text,
  timeline_weeks_min integer,
  timeline_weeks_max integer,
  price_min          numeric(12, 2),
  price_max          numeric(12, 2),
  currency           text,
  price_notes        text,
  created_by         text not null,
  created_at         timestamptz not null default now(),
  updated_by         text not null,
  updated_at         timestamptz not null default now(),
  submitted_by       text,
  submitted_at       timestamptz,
  approved_by        text,
  approved_at        timestamptz,
  sent_by            text,
  sent_at            timestamptz,
  decided_by         text,
  decided_at         timestamptz,
  decision_note      text,
  constraint crm_proposals_version_key unique (inquiry_id, version),
  constraint crm_proposals_version_positive check (version >= 1),
  constraint crm_proposals_status_values check (status = any (array['draft', 'internal_review', 'approved', 'sent', 'accepted', 'rejected', 'withdrawn', 'superseded'])),
  constraint crm_proposals_summary_length check (summary is null or char_length(summary) <= 2000),
  constraint crm_proposals_scope_length check (recommended_scope is null or char_length(recommended_scope) <= 6000),
  constraint crm_proposals_deliverables_length check (deliverables is null or char_length(deliverables) <= 4000),
  constraint crm_proposals_exclusions_length check (exclusions is null or char_length(exclusions) <= 4000),
  constraint crm_proposals_assumptions_length check (assumptions is null or char_length(assumptions) <= 4000),
  constraint crm_proposals_timeline_range check (
    (timeline_weeks_min is null or timeline_weeks_min between 1 and 520) and (timeline_weeks_max is null or timeline_weeks_max between 1 and 520)
    and (timeline_weeks_min is null or timeline_weeks_max is null or timeline_weeks_min <= timeline_weeks_max)),
  constraint crm_proposals_price_range check (
    (price_min is null or price_min >= 0) and (price_max is null or price_max >= 0) and (price_min is null or price_max is null or price_min <= price_max)),
  constraint crm_proposals_currency_values check (currency is null or currency = any (array['EGP', 'USD', 'EUR', 'GBP', 'SAR', 'AED'])),
  constraint crm_proposals_price_needs_currency check ((price_min is null and price_max is null) or currency is not null),
  constraint crm_proposals_price_notes_length check (price_notes is null or char_length(price_notes) <= 1000),
  constraint crm_proposals_decision_note_length check (decision_note is null or char_length(decision_note) <= 1000),
  constraint crm_proposals_people_length check (char_length(created_by) between 1 and 320 and char_length(updated_by) between 1 and 320),
  -- Approval is by a teammate: neither the author nor the last editor.
  constraint crm_proposals_teammate_approval check (approved_by is null or (approved_by <> created_by and approved_by <> updated_by) or status in ('superseded', 'withdrawn'))
);
create index if not exists crm_proposals_inquiry_idx on public.crm_proposals (inquiry_id, version desc);
create index if not exists crm_proposals_status_idx on public.crm_proposals (status) where status in ('draft', 'internal_review', 'approved', 'sent');

-- ============================================================
-- 2. Minimal project record (full project management is deferred)
-- ============================================================

create table if not exists public.crm_projects (
  id                   uuid primary key default gen_random_uuid(),
  inquiry_id           uuid not null unique references public.project_inquiries (id),
  company_id           uuid references public.crm_companies (id),
  contact_id           uuid references public.crm_contacts (id),
  name                 text not null,
  status               text not null default 'planned',
  owners               text[] not null default '{}',
  source               jsonb not null default '{}'::jsonb,
  scope                jsonb,
  decisions            jsonb not null default '[]'::jsonb,
  preparation_version  integer,
  meeting_start_at     timestamptz,
  created_by           text not null,
  created_at           timestamptz not null default now(),
  constraint crm_projects_name_length check (char_length(btrim(name)) between 1 and 160),
  constraint crm_projects_status_values check (status = any (array['planned', 'active', 'on_hold', 'completed'])),
  constraint crm_projects_owners_shape check (cardinality(owners) <= 5 and array_to_string(owners, ',') ~ '^([a-z][a-z0-9-]{0,31}(,|$))*$'),
  constraint crm_projects_created_by_length check (char_length(created_by) between 1 and 320)
);

do $$
declare
  t text;
begin
  foreach t in array array['crm_proposals', 'crm_projects'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all privileges on table public.%I from anon, authenticated, service_role', t);
  end loop;
end;
$$;
grant select, insert, update on table public.crm_proposals, public.crm_projects to service_role;

-- ============================================================
-- 3. Proposal operations
-- ============================================================

-- Starts a new version from the given fields (the inquiry's first proposal, or
-- a revision). A version still being worked on, or already approved or sent, is
-- superseded by the new one, which starts again as a draft needing review.
create or replace function public.crm_create_proposal(p_inquiry_id uuid, p_fields jsonb, p_actor text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_version integer;
  v_id uuid;
begin
  if jsonb_typeof(p_fields) <> 'object' then
    raise exception 'fields_must_be_object';
  end if;
  perform 1 from public.project_inquiries where id = p_inquiry_id and deleted_at is null for update;
  if not found then
    return null;
  end if;
  select coalesce(max(version), 0) + 1 into v_version from public.crm_proposals where inquiry_id = p_inquiry_id;
  update public.crm_proposals set status = 'superseded', updated_at = now() where inquiry_id = p_inquiry_id and status in ('draft', 'internal_review', 'approved', 'sent');
  insert into public.crm_proposals (inquiry_id, version, summary, recommended_scope, deliverables, exclusions, assumptions, timeline_weeks_min, timeline_weeks_max,
                                    price_min, price_max, currency, price_notes, created_by, updated_by)
  values (p_inquiry_id, v_version, nullif(btrim(p_fields ->> 'summary'), ''), nullif(btrim(p_fields ->> 'recommended_scope'), ''), nullif(btrim(p_fields ->> 'deliverables'), ''),
          nullif(btrim(p_fields ->> 'exclusions'), ''), nullif(btrim(p_fields ->> 'assumptions'), ''), nullif(p_fields ->> 'timeline_weeks_min', '')::integer,
          nullif(p_fields ->> 'timeline_weeks_max', '')::integer, nullif(p_fields ->> 'price_min', '')::numeric, nullif(p_fields ->> 'price_max', '')::numeric,
          nullif(p_fields ->> 'currency', ''), nullif(btrim(p_fields ->> 'price_notes'), ''), p_actor, p_actor)
  returning id into v_id;
  perform public.crm_log(p_actor, 'proposal', v_id, p_inquiry_id, 'proposal_created', jsonb_build_object('version', v_version));
  return v_id;
end;
$$;

-- Edits a draft in place. Anything past draft is revised by creating a new version.
create or replace function public.crm_update_proposal(p_id uuid, p_fields jsonb, p_actor text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_inquiry uuid;
begin
  if jsonb_typeof(p_fields) <> 'object' then
    raise exception 'fields_must_be_object';
  end if;
  update public.crm_proposals p
  set summary = case when p_fields ? 'summary' then nullif(btrim(p_fields ->> 'summary'), '') else p.summary end,
      recommended_scope = case when p_fields ? 'recommended_scope' then nullif(btrim(p_fields ->> 'recommended_scope'), '') else p.recommended_scope end,
      deliverables = case when p_fields ? 'deliverables' then nullif(btrim(p_fields ->> 'deliverables'), '') else p.deliverables end,
      exclusions = case when p_fields ? 'exclusions' then nullif(btrim(p_fields ->> 'exclusions'), '') else p.exclusions end,
      assumptions = case when p_fields ? 'assumptions' then nullif(btrim(p_fields ->> 'assumptions'), '') else p.assumptions end,
      timeline_weeks_min = case when p_fields ? 'timeline_weeks_min' then nullif(p_fields ->> 'timeline_weeks_min', '')::integer else p.timeline_weeks_min end,
      timeline_weeks_max = case when p_fields ? 'timeline_weeks_max' then nullif(p_fields ->> 'timeline_weeks_max', '')::integer else p.timeline_weeks_max end,
      price_min = case when p_fields ? 'price_min' then nullif(p_fields ->> 'price_min', '')::numeric else p.price_min end,
      price_max = case when p_fields ? 'price_max' then nullif(p_fields ->> 'price_max', '')::numeric else p.price_max end,
      currency = case when p_fields ? 'currency' then nullif(p_fields ->> 'currency', '') else p.currency end,
      price_notes = case when p_fields ? 'price_notes' then nullif(btrim(p_fields ->> 'price_notes'), '') else p.price_notes end,
      updated_by = p_actor,
      updated_at = now()
  where p.id = p_id and p.status = 'draft'
  returning p.inquiry_id into v_inquiry;
  if v_inquiry is null then
    return false;
  end if;
  perform public.crm_log(p_actor, 'proposal', p_id, v_inquiry, 'proposal_edited', '{}'::jsonb);
  return true;
end;
$$;

-- Status changes. Allowed moves:
--   draft -> internal_review          (anyone: ready for a teammate)
--   internal_review -> draft          (send back)
--   internal_review -> approved       (a teammate who neither wrote nor last edited it)
--   approved -> sent                  (recorded after the team sent it themselves)
--   sent -> accepted | rejected       (the client's answer)
--   draft | internal_review | approved | sent -> withdrawn
create or replace function public.crm_proposal_transition(p_id uuid, p_to text, p_actor text, p_note text default null)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  p public.crm_proposals%rowtype;
begin
  select * into p from public.crm_proposals where id = p_id for update;
  if not found then
    return false;
  end if;
  if not (
    (p.status = 'draft' and p_to in ('internal_review', 'withdrawn'))
    or (p.status = 'internal_review' and p_to in ('draft', 'approved', 'withdrawn'))
    or (p.status = 'approved' and p_to in ('sent', 'withdrawn'))
    or (p.status = 'sent' and p_to in ('accepted', 'rejected', 'withdrawn'))) then
    raise exception 'transition_not_allowed';
  end if;
  if p_to = 'approved' and (p_actor = p.created_by or p_actor = p.updated_by) then
    raise exception 'teammate_approval_required';
  end if;
  update public.crm_proposals
  set status = p_to,
      submitted_by = case when p_to = 'internal_review' then p_actor else submitted_by end,
      submitted_at = case when p_to = 'internal_review' then now() else submitted_at end,
      approved_by = case when p_to = 'approved' then p_actor when p_to in ('draft', 'internal_review') then null else approved_by end,
      approved_at = case when p_to = 'approved' then now() when p_to in ('draft', 'internal_review') then null else approved_at end,
      sent_by = case when p_to = 'sent' then p_actor else sent_by end,
      sent_at = case when p_to = 'sent' then now() else sent_at end,
      decided_by = case when p_to in ('accepted', 'rejected', 'withdrawn') then p_actor else decided_by end,
      decided_at = case when p_to in ('accepted', 'rejected', 'withdrawn') then now() else decided_at end,
      decision_note = case when p_to in ('accepted', 'rejected', 'withdrawn') then nullif(btrim(p_note), '') else decision_note end,
      updated_at = now()
  where id = p_id;
  perform public.crm_log(p_actor, 'proposal', p_id, p.inquiry_id, 'proposal_' || p_to, jsonb_build_object('version', p.version));
  return true;
end;
$$;

-- ============================================================
-- 4. Won -> project
-- ============================================================

-- Creates the minimal project record for a won inquiry, once. The inquiry,
-- its preparation, the meeting history, notes and follow-ups stay where they
-- are and are reached through project.inquiry_id; this keeps a snapshot of
-- the scope that was agreed (the accepted proposal, otherwise the latest
-- approved or sent one), the owners, the source and the decisions taken.
-- Safe to call again: it returns the project that already exists.
create or replace function public.crm_convert_to_project(p_inquiry_id uuid, p_name text, p_actor text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  i public.project_inquiries%rowtype;
  d public.inquiry_crm%rowtype;
  pr public.crm_proposals%rowtype;
  v_id uuid;
  v_name text;
begin
  select * into i from public.project_inquiries where id = p_inquiry_id and deleted_at is null for update;
  if not found then
    return null;
  end if;
  select id into v_id from public.crm_projects where inquiry_id = p_inquiry_id;
  if v_id is not null then
    return v_id;
  end if;
  if i.lead_status <> 'won' then
    raise exception 'inquiry_not_won';
  end if;
  select * into d from public.inquiry_crm where inquiry_id = p_inquiry_id;
  select * into pr from public.crm_proposals
  where inquiry_id = p_inquiry_id and status in ('accepted', 'sent', 'approved')
  order by (status = 'accepted') desc, version desc limit 1;
  v_name := coalesce(nullif(btrim(p_name), ''), nullif(btrim(i.company_name), ''), i.full_name);
  insert into public.crm_projects (inquiry_id, company_id, contact_id, name, owners, source, scope, decisions, preparation_version, meeting_start_at, created_by)
  values (
    p_inquiry_id, d.company_id, d.contact_id, left(v_name, 160), i.owners,
    jsonb_strip_nulls(jsonb_build_object('lead_origin', coalesce(d.lead_origin, 'inbound'), 'referral_partner', d.referral_partner,
      'utm_source', i.utm_source, 'utm_medium', i.utm_medium, 'utm_campaign', coalesce(d.campaign, i.utm_campaign), 'utm_content', coalesce(d.content_id, i.utm_content),
      'referral_source', i.referral_source, 'source_page', i.source_page)),
    case when pr.id is null then null else jsonb_strip_nulls(jsonb_build_object('proposal_id', pr.id, 'version', pr.version, 'status', pr.status, 'summary', pr.summary,
      'recommended_scope', pr.recommended_scope, 'deliverables', pr.deliverables, 'exclusions', pr.exclusions, 'assumptions', pr.assumptions,
      'timeline_weeks_min', pr.timeline_weeks_min, 'timeline_weeks_max', pr.timeline_weeks_max, 'price_min', pr.price_min, 'price_max', pr.price_max,
      'currency', pr.currency, 'price_notes', pr.price_notes)) end,
    coalesce((
      select jsonb_agg(x order by x ->> 'at') from (
        select jsonb_build_object('at', h.created_at, 'by', h.actor, 'what', 'stage: ' || coalesce(h.from_stage, 'none') || ' to ' || h.to_stage) as x
        from public.crm_stage_history as h where h.inquiry_id = p_inquiry_id
        union all
        select jsonb_build_object('at', q.approved_at, 'by', q.approved_by, 'what', 'proposal v' || q.version || ' approved') from public.crm_proposals as q where q.inquiry_id = p_inquiry_id and q.approved_at is not null
        union all
        select jsonb_build_object('at', q.decided_at, 'by', q.decided_by, 'what', 'proposal v' || q.version || ' ' || q.status) from public.crm_proposals as q where q.inquiry_id = p_inquiry_id and q.decided_at is not null and q.status in ('accepted', 'rejected')
      ) as e), '[]'::jsonb),
    (select max(dr.version) from public.preparation_drafts as dr where dr.inquiry_id = p_inquiry_id and dr.review_status = 'approved'),
    i.meeting_start_at, p_actor)
  returning id into v_id;
  perform public.crm_log(p_actor, 'project', v_id, p_inquiry_id, 'project_created', '{}'::jsonb);
  return v_id;
end;
$$;

create or replace function public.crm_set_project_status(p_id uuid, p_status text, p_actor text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_inquiry uuid;
begin
  if p_status is null or p_status <> all (array['planned', 'active', 'on_hold', 'completed']) then
    raise exception 'invalid_status';
  end if;
  update public.crm_projects set status = p_status where id = p_id returning inquiry_id into v_inquiry;
  if v_inquiry is null then
    return false;
  end if;
  perform public.crm_log(p_actor, 'project', p_id, v_inquiry, 'project_status', jsonb_build_object('to', p_status));
  return true;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.crm_create_proposal(uuid, jsonb, text)', 'public.crm_update_proposal(uuid, jsonb, text)', 'public.crm_proposal_transition(uuid, text, text, text)',
    'public.crm_convert_to_project(uuid, text, text)', 'public.crm_set_project_status(uuid, text, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

-- Forward-only, additive. CRM Release 1, part 4 of 4: the reads behind the
-- dashboard overview, lists, search, metrics and export.
--
-- Every function here is read-only except crm_export, which records that an
-- export happened. Lists and search return names and ids only: email addresses,
-- phone numbers and contact handles are returned only by the detail functions,
-- and by the explicit contacts export. All are service_role only.

-- Escapes LIKE wildcards so a search term is always plain text.
create or replace function public.crm_like(p_q text)
returns text
language sql
immutable
set search_path = ''
as $$
  select '%' || replace(replace(replace(btrim(coalesce(p_q, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%';
$$;

-- ============================================================
-- 1. Inquiry list with filters
-- ============================================================

create or replace function public.crm_inquiry_list(p_filters jsonb default '{}'::jsonb)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(row_data order by created_at desc), '[]'::jsonb)
  from (
    select i.created_at,
      jsonb_build_object(
        'id', i.id,
        'created_at', i.created_at,
        'client_name', i.full_name,
        'company_name', i.company_name,
        'crm_company', case when co.id is null then null else jsonb_build_object('id', co.id, 'name', co.name) end,
        'language', i.preferred_language,
        'project_type', i.project_type,
        'summary', left(i.project_description, 140),
        'booking_status', i.booking_status,
        'meeting_start_at', i.meeting_start_at,
        'lead_status', i.lead_status,
        'stage_changed_at', coalesce(d.stage_changed_at, i.created_at),
        'owners', to_jsonb(i.owners),
        'next_follow_up', (
          select jsonb_build_object('action', f.action, 'owner', f.owner, 'due_on', f.due_on)
          from public.inquiry_follow_ups as f where f.inquiry_id = i.id and f.done_at is null order by f.due_on, f.created_at limit 1),
        'open_follow_ups', (select count(*) from public.inquiry_follow_ups as f where f.inquiry_id = i.id and f.done_at is null),
        'preparation_status', p.status,
        'preparation_error', p.last_error,
        'latest_draft', (
          select jsonb_build_object('version', dr.version, 'review_status', dr.review_status, 'source', dr.source)
          from public.preparation_drafts as dr where dr.inquiry_id = i.id order by dr.version desc limit 1),
        'approved_version', (select dr.version from public.preparation_drafts as dr where dr.inquiry_id = i.id and dr.review_status = 'approved' order by dr.version desc limit 1),
        'lead_origin', coalesce(d.lead_origin, 'inbound'),
        'source', i.utm_source,
        'campaign', coalesce(d.campaign, i.utm_campaign),
        'fit_tier', d.fit_tier,
        'lead_score', d.lead_score,
        'proposal_status', (select q.status from public.crm_proposals as q where q.inquiry_id = i.id and q.status <> 'superseded' order by q.version desc limit 1)
      ) as row_data
    from public.project_inquiries as i
    left join public.inquiry_preparations as p on p.inquiry_id = i.id
    left join public.inquiry_crm as d on d.inquiry_id = i.id
    left join public.crm_companies as co on co.id = d.company_id
    left join public.crm_contacts as ct on ct.id = d.contact_id
    where i.deleted_at is null
      and (nullif(p_filters ->> 'q', '') is null or i.full_name ilike public.crm_like(p_filters ->> 'q') or i.company_name ilike public.crm_like(p_filters ->> 'q')
           or i.email ilike public.crm_like(p_filters ->> 'q') or i.project_description ilike public.crm_like(p_filters ->> 'q')
           or co.name ilike public.crm_like(p_filters ->> 'q') or ct.full_name ilike public.crm_like(p_filters ->> 'q'))
      and (nullif(p_filters ->> 'owner', '') is null or case when p_filters ->> 'owner' = 'unassigned' then cardinality(i.owners) = 0 else (p_filters ->> 'owner') = any (i.owners) end)
      and (nullif(p_filters ->> 'stage', '') is null or i.lead_status = p_filters ->> 'stage')
      and (nullif(p_filters ->> 'meeting', '') is null or i.booking_status = p_filters ->> 'meeting')
      and (nullif(p_filters ->> 'preparation', '') is null or case when p_filters ->> 'preparation' = 'none' then p.status is null else p.status = p_filters ->> 'preparation' end)
      and (nullif(p_filters ->> 'origin', '') is null or coalesce(d.lead_origin, 'inbound') = p_filters ->> 'origin')
      and (nullif(p_filters ->> 'campaign', '') is null or coalesce(d.campaign, i.utm_campaign) = p_filters ->> 'campaign')
  ) as rows;
$$;

-- Everything the CRM adds to one inquiry's detail page.
create or replace function public.crm_inquiry_extra(p_inquiry_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'stage', i.lead_status,
    'stage_changed_at', coalesce(d.stage_changed_at, i.created_at),
    'source', jsonb_build_object(
      'lead_origin', coalesce(d.lead_origin, 'inbound'), 'referral_partner', d.referral_partner, 'referral_source', i.referral_source,
      'utm_source', i.utm_source, 'utm_medium', i.utm_medium, 'utm_campaign', i.utm_campaign, 'utm_content', i.utm_content,
      'campaign', d.campaign, 'content_id', d.content_id, 'source_page', i.source_page),
    'qualification', jsonb_build_object(
      'fit_tier', d.fit_tier, 'score', d.score, 'lead_score', d.lead_score, 'trigger_note', d.trigger_note, 'research_note', d.research_note,
      'loss_reason', d.loss_reason, 'loss_note', d.loss_note, 'paused_until', d.paused_until, 'won_at', d.won_at, 'lost_at', d.lost_at),
    'company', (select jsonb_build_object('id', co.id, 'name', co.name) from public.crm_companies as co where co.id = d.company_id),
    'contact', (select jsonb_build_object('id', c.id, 'name', c.full_name, 'role', c.role_title, 'consent_status', c.consent_status, 'do_not_contact', c.do_not_contact)
                from public.crm_contacts as c where c.id = d.contact_id),
    'duplicates', public.crm_inquiry_duplicates(i.id),
    'stage_history', (select coalesce(jsonb_agg(jsonb_build_object('at', h.created_at, 'from', h.from_stage, 'to', h.to_stage, 'by', h.actor, 'reason', h.reason) order by h.created_at desc), '[]'::jsonb)
                      from public.crm_stage_history as h where h.inquiry_id = i.id),
    'proposals', (select coalesce(jsonb_agg(to_jsonb(q) - 'inquiry_id' order by q.version desc), '[]'::jsonb) from public.crm_proposals as q where q.inquiry_id = i.id),
    'project', (select jsonb_build_object('id', pr.id, 'name', pr.name, 'status', pr.status) from public.crm_projects as pr where pr.inquiry_id = i.id),
    'prospect', (select jsonb_build_object('id', pp.id, 'company_name', pp.company_name, 'stage', pp.stage) from public.crm_prospects as pp where pp.inquiry_id = i.id limit 1),
    'activity', (select coalesce(jsonb_agg(jsonb_build_object('at', a.at, 'actor', a.actor, 'action', a.action, 'entity', a.entity_type, 'detail', a.detail) order by a.at desc), '[]'::jsonb)
                 from (select * from public.crm_activity as x where x.inquiry_id = i.id order by x.at desc limit 40) as a))
  from public.project_inquiries as i
  left join public.inquiry_crm as d on d.inquiry_id = i.id
  where i.id = p_inquiry_id and i.deleted_at is null;
$$;

-- ============================================================
-- 2. Dashboard overview
-- ============================================================

-- p_today is the team's calendar date (Cairo), supplied by the application.
create or replace function public.crm_overview(p_today date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with open_inquiries as (
    select i.* from public.project_inquiries as i where i.deleted_at is null and i.lead_status not in ('won', 'lost', 'paused')
  ),
  overdue_inquiry as (
    select f.id, f.inquiry_id, f.action, f.owner, f.due_on, i.full_name as name
    from public.inquiry_follow_ups as f join public.project_inquiries as i on i.id = f.inquiry_id
    where f.done_at is null and f.due_on < p_today and i.deleted_at is null
  ),
  overdue_prospect as (
    select p.id, p.company_name as name, p.follow_up_action as action, p.follow_up_owner as owner, p.follow_up_due_on as due_on
    from public.crm_prospects as p where p.follow_up_due_on < p_today and p.stage not in ('not_now', 'disqualified', 'inquiry_submitted')
  ),
  failed as (
    select i.id, i.full_name as name, pr.status, pr.last_error
    from public.project_inquiries as i join public.inquiry_preparations as pr on pr.inquiry_id = i.id
    where i.deleted_at is null and pr.status in ('failed', 'paused')
  ),
  awaiting_review as (
    select i.id, i.full_name as name, d.version, d.created_by
    from public.project_inquiries as i
    join lateral (select * from public.preparation_drafts as x where x.inquiry_id = i.id order by x.version desc limit 1) as d on d.review_status = 'in_review'
    where i.deleted_at is null
  ),
  needs_prep as (
    select i.id, i.full_name as name, i.meeting_start_at
    from public.project_inquiries as i
    where i.deleted_at is null and i.booking_status = 'booked' and i.meeting_start_at >= now()
      and not exists (select 1 from public.preparation_drafts as d where d.inquiry_id = i.id and d.review_status = 'approved')
  ),
  members as (
    select distinct m from (
      select unnest(owners) as m from open_inquiries
      union select owner from public.inquiry_follow_ups where done_at is null
      union select owner from public.crm_prospects where stage not in ('not_now', 'disqualified', 'inquiry_submitted')
    ) as u where m is not null
  )
  select jsonb_build_object(
    'counts', jsonb_build_object(
      'new_inquiries', (select count(*) from open_inquiries where lead_status = 'new'),
      'open_inquiries', (select count(*) from open_inquiries),
      'upcoming_meetings', (select count(*) from public.project_inquiries as i where i.deleted_at is null and i.booking_status = 'booked' and i.meeting_start_at >= now()),
      'meetings_to_prepare', (select count(*) from needs_prep),
      'overdue_follow_ups', (select count(*) from overdue_inquiry) + (select count(*) from overdue_prospect),
      'prep_failures', (select count(*) from failed),
      'drafts_awaiting_review', (select count(*) from awaiting_review),
      'proposals_awaiting', (select count(*) from public.crm_proposals where status in ('draft', 'internal_review', 'approved', 'sent')),
      'unowned_open', (select count(*) from open_inquiries where cardinality(owners) = 0),
      'no_next_action', (select count(*) from open_inquiries as o where not exists (select 1 from public.inquiry_follow_ups as f where f.inquiry_id = o.id and f.done_at is null))),
    'new_inquiries', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.full_name, 'at', x.created_at, 'owners', to_jsonb(x.owners)) order by x.created_at desc), '[]'::jsonb)
                      from (select * from open_inquiries where lead_status = 'new' order by created_at desc limit 8) as x),
    'meetings_to_prepare', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'at', x.meeting_start_at) order by x.meeting_start_at), '[]'::jsonb) from (select * from needs_prep order by meeting_start_at limit 8) as x),
    'upcoming_meetings', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.full_name, 'at', x.meeting_start_at,
        'ready', exists (select 1 from public.preparation_drafts as d where d.inquiry_id = x.id and d.review_status = 'approved')) order by x.meeting_start_at), '[]'::jsonb)
      from (select * from public.project_inquiries as i where i.deleted_at is null and i.booking_status = 'booked' and i.meeting_start_at >= now() order by i.meeting_start_at limit 8) as x),
    'overdue_follow_ups', (select coalesce(jsonb_agg(r order by r ->> 'due_on'), '[]'::jsonb) from (
        select jsonb_build_object('kind', 'inquiry', 'id', inquiry_id, 'name', name, 'action', action, 'owner', owner, 'due_on', due_on) as r from overdue_inquiry
        union all select jsonb_build_object('kind', 'prospect', 'id', id, 'name', name, 'action', action, 'owner', owner, 'due_on', due_on) from overdue_prospect
      ) as u),
    'prep_failures', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'status', status, 'error', last_error)), '[]'::jsonb) from failed),
    'drafts_awaiting_review', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'version', version, 'author', created_by)), '[]'::jsonb) from awaiting_review),
    'proposals_awaiting', (select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'inquiry_id', q.inquiry_id, 'name', i.full_name, 'version', q.version, 'status', q.status) order by q.updated_at desc), '[]'::jsonb)
      from public.crm_proposals as q join public.project_inquiries as i on i.id = q.inquiry_id where q.status in ('draft', 'internal_review', 'approved', 'sent') and i.deleted_at is null),
    'attention', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'name', o.full_name, 'reasons', to_jsonb(array_remove(array[
          case when cardinality(o.owners) = 0 then 'no_owner' end,
          case when not exists (select 1 from public.inquiry_follow_ups as f where f.inquiry_id = o.id and f.done_at is null) then 'no_next_action' end], null))) order by o.created_at), '[]'::jsonb)
      from (select * from open_inquiries as x
            where cardinality(x.owners) = 0 or not exists (select 1 from public.inquiry_follow_ups as f where f.inquiry_id = x.id and f.done_at is null)
            order by x.created_at limit 10) as o),
    'owner_workload', (select coalesce(jsonb_agg(jsonb_build_object(
        'owner', m.m,
        'open_inquiries', (select count(*) from open_inquiries as o where m.m = any (o.owners)),
        'open_follow_ups', (select count(*) from public.inquiry_follow_ups as f where f.owner = m.m and f.done_at is null)
                          + (select count(*) from public.crm_prospects as p where p.follow_up_owner = m.m and p.stage not in ('not_now', 'disqualified', 'inquiry_submitted')),
        'overdue_follow_ups', (select count(*) from overdue_inquiry as o where o.owner = m.m) + (select count(*) from overdue_prospect as o where o.owner = m.m),
        'prospects', (select count(*) from public.crm_prospects as p where p.owner = m.m and p.stage not in ('not_now', 'disqualified', 'inquiry_submitted'))) order by m.m), '[]'::jsonb)
      from members as m),
    'recent_activity', (select coalesce(jsonb_agg(jsonb_build_object('at', a.at, 'actor', a.actor, 'action', a.action, 'entity', a.entity_type, 'inquiry_id', a.inquiry_id, 'entity_id', a.entity_id,
          'name', (select i.full_name from public.project_inquiries as i where i.id = a.inquiry_id)) order by a.at desc), '[]'::jsonb)
      from (select * from public.crm_activity as x order by x.at desc limit 15) as a)
  );
$$;

-- ============================================================
-- 3. Companies, contacts, search, duplicates
-- ============================================================

create or replace function public.crm_company_list(p_q text default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'name', c.name, 'country', c.country, 'sector', c.sector, 'language', c.language, 'website_host', c.website_host, 'created_at', c.created_at,
      'contacts', (select count(*) from public.crm_contacts as k where k.company_id = c.id and k.archived_at is null),
      'open_inquiries', (select count(*) from public.inquiry_crm as d join public.project_inquiries as i on i.id = d.inquiry_id
                         where d.company_id = c.id and i.deleted_at is null and i.lead_status not in ('won', 'lost', 'paused')),
      'inquiries', (select count(*) from public.inquiry_crm as d join public.project_inquiries as i on i.id = d.inquiry_id where d.company_id = c.id and i.deleted_at is null),
      'possible_duplicate', exists (select 1 from public.crm_companies as o where o.id <> c.id and o.archived_at is null and (o.name_key = c.name_key or (o.website_host is not null and o.website_host = c.website_host)))
    ) order by c.name), '[]'::jsonb)
  from public.crm_companies as c
  where c.archived_at is null and (nullif(btrim(p_q), '') is null or c.name ilike public.crm_like(p_q) or c.website_host ilike public.crm_like(p_q) or c.country ilike public.crm_like(p_q));
$$;

create or replace function public.crm_company_get(p_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'company', jsonb_build_object('id', c.id, 'name', c.name, 'website', c.website, 'website_host', c.website_host, 'country', c.country, 'sector', c.sector, 'language', c.language, 'created_at', c.created_at, 'created_by', c.created_by),
    'contacts', (select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'name', k.full_name, 'role', k.role_title, 'email', k.email, 'phone', k.phone, 'language', k.preferred_language,
        'consent_status', k.consent_status, 'consent_at', k.consent_at, 'do_not_contact', k.do_not_contact) order by k.created_at), '[]'::jsonb)
      from public.crm_contacts as k where k.company_id = c.id and k.archived_at is null),
    'inquiries', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'client_name', i.full_name, 'created_at', i.created_at, 'stage', i.lead_status, 'project_type', i.project_type) order by i.created_at desc), '[]'::jsonb)
      from public.inquiry_crm as d join public.project_inquiries as i on i.id = d.inquiry_id where d.company_id = c.id and i.deleted_at is null),
    'projects', (select coalesce(jsonb_agg(jsonb_build_object('id', pr.id, 'name', pr.name, 'status', pr.status)), '[]'::jsonb) from public.crm_projects as pr where pr.company_id = c.id),
    'duplicates', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'website_host', o.website_host)), '[]'::jsonb)
      from public.crm_companies as o where o.id <> c.id and o.archived_at is null and (o.name_key = c.name_key or (o.website_host is not null and o.website_host = c.website_host))))
  from public.crm_companies as c where c.id = p_id and c.archived_at is null;
$$;

create or replace function public.crm_contact_get(p_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'contact', jsonb_build_object('id', k.id, 'company_id', k.company_id, 'name', k.full_name, 'role', k.role_title, 'email', k.email, 'phone', k.phone, 'language', k.preferred_language,
      'consent_status', k.consent_status, 'consent_at', k.consent_at, 'do_not_contact', k.do_not_contact, 'created_at', k.created_at, 'created_by', k.created_by),
    'company', (select jsonb_build_object('id', c.id, 'name', c.name) from public.crm_companies as c where c.id = k.company_id),
    'inquiries', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'client_name', i.full_name, 'created_at', i.created_at, 'stage', i.lead_status) order by i.created_at desc), '[]'::jsonb)
      from public.inquiry_crm as d join public.project_inquiries as i on i.id = d.inquiry_id where d.contact_id = k.id and i.deleted_at is null),
    'duplicates', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'name', o.full_name, 'company', (select c.name from public.crm_companies as c where c.id = o.company_id))), '[]'::jsonb)
      from public.crm_contacts as o where o.id <> k.id and o.archived_at is null
        and ((o.email_key is not null and o.email_key = k.email_key) or (o.phone_key is not null and o.phone_key = k.phone_key))))
  from public.crm_contacts as k where k.id = p_id and k.archived_at is null;
$$;

-- Names and ids only. Matches on email and phone too, but never returns them.
create or replace function public.crm_search(p_q text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select case when char_length(btrim(coalesce(p_q, ''))) < 2 then jsonb_build_object('inquiries', '[]'::jsonb, 'companies', '[]'::jsonb, 'contacts', '[]'::jsonb, 'prospects', '[]'::jsonb)
  else jsonb_build_object(
    'inquiries', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.full_name, 'company', x.company_name, 'stage', x.lead_status, 'at', x.created_at) order by x.created_at desc), '[]'::jsonb)
      from (select i.* from public.project_inquiries as i
            where i.deleted_at is null and (i.full_name ilike public.crm_like(p_q) or i.company_name ilike public.crm_like(p_q) or i.email ilike public.crm_like(p_q)
              or i.project_description ilike public.crm_like(p_q) or public.crm_phone_key(i.phone) = public.crm_phone_key(p_q))
            order by i.created_at desc limit 15) as x),
    'companies', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'country', x.country) order by x.name), '[]'::jsonb)
      from (select c.* from public.crm_companies as c where c.archived_at is null and (c.name ilike public.crm_like(p_q) or c.website_host ilike public.crm_like(p_q)) order by c.name limit 15) as x),
    'contacts', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.full_name, 'role', x.role_title, 'company', (select c.name from public.crm_companies as c where c.id = x.company_id)) order by x.full_name), '[]'::jsonb)
      from (select k.* from public.crm_contacts as k
            where k.archived_at is null and (k.full_name ilike public.crm_like(p_q) or k.email ilike public.crm_like(p_q) or (public.crm_phone_key(p_q) is not null and k.phone_key = public.crm_phone_key(p_q)))
            order by k.full_name limit 15) as x),
    'prospects', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'company', x.company_name, 'contact', x.contact_name, 'stage', x.stage) order by x.company_name), '[]'::jsonb)
      from (select p.* from public.crm_prospects as p where p.company_name ilike public.crm_like(p_q) or p.contact_name ilike public.crm_like(p_q) order by p.company_name limit 15) as x))
  end;
$$;

-- Groups that look like the same company, contact or client. Ids and names only.
-- Nothing is merged: the team links records or leaves them alone.
create or replace function public.crm_duplicates_report()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'companies', (select coalesce(jsonb_agg(g), '[]'::jsonb) from (
        select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'website_host', c.website_host) order by c.created_at) as g
        from public.crm_companies as c where c.archived_at is null group by c.name_key having count(*) > 1) as t),
    'contacts', (select coalesce(jsonb_agg(g), '[]'::jsonb) from (
        select jsonb_agg(jsonb_build_object('id', k.id, 'name', k.full_name, 'company', (select c.name from public.crm_companies as c where c.id = k.company_id)) order by k.created_at) as g
        from public.crm_contacts as k where k.archived_at is null and k.email_key is not null group by k.email_key having count(*) > 1) as t),
    'inquiries', (select coalesce(jsonb_agg(g), '[]'::jsonb) from (
        select jsonb_agg(jsonb_build_object('id', i.id, 'name', i.full_name, 'created_at', i.created_at) order by i.created_at) as g
        from public.project_inquiries as i where i.deleted_at is null group by public.crm_email_key(i.email) having count(*) > 1) as t));
$$;

-- ============================================================
-- 4. Outreach, proposals, projects
-- ============================================================

create or replace function public.crm_prospect_list()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'company_name', p.company_name, 'country', p.country, 'sector', p.sector, 'pool', p.pool, 'lead_origin', p.lead_origin,
      'contact_name', p.contact_name, 'contact_role', p.contact_role, 'language', p.language, 'fit_tier', p.fit_tier, 'lead_score', p.lead_score,
      'trigger_note', p.trigger_note, 'owner', p.owner, 'stage', p.stage,
      'follow_up', case when p.follow_up_due_on is null then null else jsonb_build_object('action', p.follow_up_action, 'owner', p.follow_up_owner, 'due_on', p.follow_up_due_on) end,
      'touches', (select count(*) from public.crm_outreach_touches as t where t.prospect_id = p.id and t.kind = 'outbound'),
      'last_touch_on', (select max(t.occurred_on) from public.crm_outreach_touches as t where t.prospect_id = p.id),
      'do_not_contact', p.do_not_contact, 'inquiry_id', p.inquiry_id, 'created_at', p.created_at
    ) order by p.lead_score desc nulls last, p.created_at), '[]'::jsonb)
  from public.crm_prospects as p;
$$;

create or replace function public.crm_prospect_get(p_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'prospect', to_jsonb(p),
    'touches', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'kind', t.kind, 'touch_no', t.touch_no, 'channel', t.channel, 'occurred_on', t.occurred_on, 'summary', t.summary, 'by', t.created_by, 'at', t.created_at)
        order by t.occurred_on desc, t.created_at desc), '[]'::jsonb) from public.crm_outreach_touches as t where t.prospect_id = p.id),
    'inquiry', (select jsonb_build_object('id', i.id, 'client_name', i.full_name, 'stage', i.lead_status) from public.project_inquiries as i where i.id = p.inquiry_id and i.deleted_at is null),
    'activity', (select coalesce(jsonb_agg(jsonb_build_object('at', a.at, 'actor', a.actor, 'action', a.action, 'detail', a.detail) order by a.at desc), '[]'::jsonb)
      from (select * from public.crm_activity as x where x.entity_type = 'prospect' and x.entity_id = p.id order by x.at desc limit 30) as a))
  from public.crm_prospects as p where p.id = p_id;
$$;

create or replace function public.crm_proposal_list(p_statuses jsonb default '["draft","internal_review","approved","sent"]'::jsonb)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', q.id, 'inquiry_id', q.inquiry_id, 'client_name', i.full_name, 'company_name', i.company_name, 'version', q.version, 'status', q.status, 'summary', left(q.summary, 140),
      'created_by', q.created_by, 'updated_by', q.updated_by, 'updated_at', q.updated_at, 'sent_at', q.sent_at, 'owners', to_jsonb(i.owners)
    ) order by q.updated_at desc), '[]'::jsonb)
  from public.crm_proposals as q join public.project_inquiries as i on i.id = q.inquiry_id
  where i.deleted_at is null and q.status in (select jsonb_array_elements_text(p_statuses));
$$;

create or replace function public.crm_project_list()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', pr.id, 'name', pr.name, 'status', pr.status, 'owners', to_jsonb(pr.owners), 'created_at', pr.created_at, 'inquiry_id', pr.inquiry_id,
      'company', (select c.name from public.crm_companies as c where c.id = pr.company_id)) order by pr.created_at desc), '[]'::jsonb)
  from public.crm_projects as pr;
$$;

create or replace function public.crm_project_get(p_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'project', jsonb_build_object('id', pr.id, 'name', pr.name, 'status', pr.status, 'owners', to_jsonb(pr.owners), 'source', pr.source, 'scope', pr.scope, 'decisions', pr.decisions,
      'preparation_version', pr.preparation_version, 'meeting_start_at', pr.meeting_start_at, 'created_at', pr.created_at, 'created_by', pr.created_by, 'inquiry_id', pr.inquiry_id),
    'company', (select jsonb_build_object('id', c.id, 'name', c.name) from public.crm_companies as c where c.id = pr.company_id),
    'contact', (select jsonb_build_object('id', k.id, 'name', k.full_name, 'role', k.role_title) from public.crm_contacts as k where k.id = pr.contact_id),
    'inquiry', (select jsonb_build_object('id', i.id, 'client_name', i.full_name, 'created_at', i.created_at, 'project_type', i.project_type) from public.project_inquiries as i where i.id = pr.inquiry_id))
  from public.crm_projects as pr where pr.id = p_id;
$$;

-- ============================================================
-- 5. Metrics
-- ============================================================

-- Funnel and attribution for inquiries created in [p_from, p_to] (Cairo dates),
-- events in that period, and outreach activity. "Reached" a stage means the
-- inquiry is there now or was there at any time: stages can be skipped, and
-- booking, preparation and review are measured from their own records.
create or replace function public.crm_metrics(p_from date, p_to date, p_today date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with ranks(stage, rnk) as (
    values ('new', 0), ('reviewing', 1), ('meeting_booked', 2), ('preparing', 3), ('meeting_ready', 4), ('meeting_completed', 5),
           ('qualified', 6), ('proposal_prep', 7), ('proposal_sent', 8), ('negotiation', 9), ('won', 10)
  ),
  cohort as (
    select i.id, i.lead_status, i.booking_status, i.meeting_start_at, i.utm_source, i.utm_medium,
           coalesce(d.campaign, i.utm_campaign) as campaign, coalesce(d.content_id, i.utm_content) as content, coalesce(d.lead_origin, 'inbound') as origin,
           greatest(coalesce((select r.rnk from ranks as r where r.stage = i.lead_status), -1),
                    coalesce((select max(r.rnk) from public.crm_stage_history as h join ranks as r on r.stage = h.to_stage where h.inquiry_id = i.id), -1)) as reach,
           (i.meeting_start_at is not null or i.booking_status in ('booked', 'completed', 'no_show')) as booked,
           exists (select 1 from public.preparation_drafts as dr where dr.inquiry_id = i.id and dr.review_status = 'approved') as ready,
           (i.lead_status = 'lost' or exists (select 1 from public.crm_stage_history as h where h.inquiry_id = i.id and h.to_stage = 'lost')) as was_lost,
           exists (select 1 from public.crm_proposals as q where q.inquiry_id = i.id and q.sent_at is not null) as proposal_sent,
           exists (select 1 from public.crm_proposals as q where q.inquiry_id = i.id) as proposal_made,
           d.loss_reason
    from public.project_inquiries as i left join public.inquiry_crm as d on d.inquiry_id = i.id
    where i.deleted_at is null and (i.created_at at time zone 'Africa/Cairo')::date between p_from and p_to
  )
  select jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'cohort', jsonb_build_object(
      'inquiries', (select count(*) from cohort),
      'booked', (select count(*) from cohort where booked),
      'meeting_ready', (select count(*) from cohort where booked and ready),
      'discovery_complete', (select count(*) from cohort where reach >= 5),
      'qualified', (select count(*) from cohort where reach >= 6),
      'proposal_made', (select count(*) from cohort where proposal_made or reach >= 7),
      'proposal_sent', (select count(*) from cohort where proposal_sent or reach >= 8),
      'won', (select count(*) from cohort where reach >= 10),
      'lost', (select count(*) from cohort where was_lost)),
    'events', jsonb_build_object(
      'proposals_sent', (select count(distinct q.inquiry_id) from public.crm_proposals as q where (q.sent_at at time zone 'Africa/Cairo')::date between p_from and p_to),
      'wins', (select count(distinct h.inquiry_id) from public.crm_stage_history as h where h.to_stage = 'won' and (h.created_at at time zone 'Africa/Cairo')::date between p_from and p_to),
      'losses', (select count(distinct h.inquiry_id) from public.crm_stage_history as h where h.to_stage = 'lost' and (h.created_at at time zone 'Africa/Cairo')::date between p_from and p_to),
      'meetings_booked', (select count(*) from public.project_inquiries as i where i.deleted_at is null and i.meeting_start_at is not null and (i.updated_at at time zone 'Africa/Cairo')::date between p_from and p_to and i.booking_status in ('booked', 'completed')),
      'overdue_follow_ups_now', (select count(*) from public.inquiry_follow_ups as f join public.project_inquiries as i on i.id = f.inquiry_id where f.done_at is null and f.due_on < p_today and i.deleted_at is null)
                              + (select count(*) from public.crm_prospects as p where p.follow_up_due_on < p_today and p.stage not in ('not_now', 'disqualified', 'inquiry_submitted'))),
    'sources', (select coalesce(jsonb_agg(s order by (s ->> 'inquiries')::int desc, s ->> 'source'), '[]'::jsonb) from (
        select jsonb_build_object('source', coalesce(utm_source, 'direct'), 'medium', utm_medium, 'campaign', campaign, 'content', content, 'origin', origin,
               'inquiries', count(*), 'booked', count(*) filter (where booked), 'qualified', count(*) filter (where reach >= 6), 'won', count(*) filter (where reach >= 10),
               'lost', count(*) filter (where was_lost)) as s
        from cohort group by utm_source, utm_medium, campaign, content, origin) as g),
    'loss_reasons', (select coalesce(jsonb_agg(jsonb_build_object('reason', loss_reason, 'count', c) order by c desc), '[]'::jsonb) from (
        select loss_reason, count(*) as c from cohort where was_lost and loss_reason is not null group by loss_reason) as l),
    'outreach', jsonb_build_object(
      'prospects', (select count(*) from public.crm_prospects),
      'touches', (select count(*) from public.crm_outreach_touches as t where t.kind = 'outbound' and t.occurred_on between p_from and p_to),
      'replies', (select count(*) from public.crm_outreach_touches as t where t.kind = 'reply' and t.occurred_on between p_from and p_to),
      'contacted', (select count(*) from public.crm_prospects as p where p.stage in ('contacted', 'replied', 'qualified', 'inquiry_submitted', 'not_now', 'disqualified') and exists (select 1 from public.crm_outreach_touches as t where t.prospect_id = p.id and t.kind = 'outbound')),
      'replied', (select count(*) from public.crm_prospects as p where exists (select 1 from public.crm_outreach_touches as t where t.prospect_id = p.id and t.kind = 'reply')),
      'qualified', (select count(*) from public.crm_prospects as p where p.stage in ('qualified', 'inquiry_submitted')),
      'inquiries', (select count(*) from public.crm_prospects as p where p.inquiry_id is not null),
      'median_days_first_touch_to_meeting', (select percentile_cont(0.5) within group (order by (i.meeting_start_at::date - ft.first_touch)) from public.crm_prospects as p
          join public.project_inquiries as i on i.id = p.inquiry_id and i.meeting_start_at is not null
          join lateral (select min(t.occurred_on) as first_touch from public.crm_outreach_touches as t where t.prospect_id = p.id and t.kind = 'outbound') as ft on ft.first_touch is not null),
      'by_stage', (select coalesce(jsonb_object_agg(stage, c), '{}'::jsonb) from (select stage, count(*) as c from public.crm_prospects group by stage) as s)));
$$;

-- ============================================================
-- 6. Export (records that it happened)
-- ============================================================

-- Rows for a CSV export. 'inquiries', 'companies' and 'prospects' carry no
-- email addresses, phone numbers or contact handles; 'contacts' does, and is
-- the one export that leaves the application with them, so each call is
-- written to the activity trail with the person and the row count (never the rows).
create or replace function public.crm_export(p_kind text, p_actor text)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_rows jsonb;
begin
  if p_kind = 'inquiries' then
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id, 'received', i.created_at, 'client', i.full_name, 'company', coalesce(co.name, i.company_name), 'language', i.preferred_language, 'project_type', i.project_type,
        'stage', i.lead_status, 'owners', array_to_string(i.owners, ' & '), 'meeting', i.booking_status, 'meeting_at', i.meeting_start_at,
        'preparation', p.status, 'origin', coalesce(d.lead_origin, 'inbound'), 'source', i.utm_source, 'medium', i.utm_medium, 'campaign', coalesce(d.campaign, i.utm_campaign),
        'content', coalesce(d.content_id, i.utm_content), 'partner', d.referral_partner, 'fit', d.fit_tier, 'score', d.lead_score, 'loss_reason', d.loss_reason,
        'next_action', (select f.action from public.inquiry_follow_ups as f where f.inquiry_id = i.id and f.done_at is null order by f.due_on limit 1),
        'next_action_owner', (select f.owner from public.inquiry_follow_ups as f where f.inquiry_id = i.id and f.done_at is null order by f.due_on limit 1),
        'next_action_due', (select f.due_on from public.inquiry_follow_ups as f where f.inquiry_id = i.id and f.done_at is null order by f.due_on limit 1)
      ) order by i.created_at desc), '[]'::jsonb) into v_rows
    from public.project_inquiries as i
    left join public.inquiry_preparations as p on p.inquiry_id = i.id
    left join public.inquiry_crm as d on d.inquiry_id = i.id
    left join public.crm_companies as co on co.id = d.company_id
    where i.deleted_at is null;
  elsif p_kind = 'companies' then
    select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'website', c.website, 'country', c.country, 'sector', c.sector, 'language', c.language,
        'contacts', (select count(*) from public.crm_contacts as k where k.company_id = c.id and k.archived_at is null), 'created', c.created_at) order by c.name), '[]'::jsonb) into v_rows
    from public.crm_companies as c where c.archived_at is null;
  elsif p_kind = 'contacts' then
    select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'name', k.full_name, 'role', k.role_title, 'company', co.name, 'email', k.email, 'phone', k.phone, 'language', k.preferred_language,
        'consent', k.consent_status, 'consent_at', k.consent_at, 'do_not_contact', k.do_not_contact) order by k.full_name), '[]'::jsonb) into v_rows
    from public.crm_contacts as k left join public.crm_companies as co on co.id = k.company_id where k.archived_at is null;
  elsif p_kind = 'prospects' then
    select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'company', p.company_name, 'country', p.country, 'pool', p.pool, 'origin', p.lead_origin, 'contact', p.contact_name, 'role', p.contact_role,
        'channel', p.contact_channel, 'language', p.language, 'fit', p.fit_tier, 'score', p.lead_score, 'trigger', p.trigger_note, 'owner', p.owner, 'stage', p.stage,
        'next_action', p.follow_up_action, 'next_action_owner', p.follow_up_owner, 'next_action_due', p.follow_up_due_on,
        'outbound_touches', (select count(*) from public.crm_outreach_touches as t where t.prospect_id = p.id and t.kind = 'outbound'),
        'last_touch', (select max(t.occurred_on) from public.crm_outreach_touches as t where t.prospect_id = p.id), 'closed_reason', p.closed_reason) order by p.company_name), '[]'::jsonb) into v_rows
    from public.crm_prospects as p;
  else
    raise exception 'unknown_export';
  end if;
  perform public.crm_log(p_actor, 'export', null, null, 'exported', jsonb_build_object('kind', p_kind, 'rows', jsonb_array_length(v_rows)));
  return v_rows;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.crm_like(text)', 'public.crm_inquiry_list(jsonb)', 'public.crm_inquiry_extra(uuid)', 'public.crm_overview(date)',
    'public.crm_company_list(text)', 'public.crm_company_get(uuid)', 'public.crm_contact_get(uuid)', 'public.crm_search(text)', 'public.crm_duplicates_report()',
    'public.crm_prospect_list()', 'public.crm_prospect_get(uuid)', 'public.crm_proposal_list(jsonb)', 'public.crm_project_list()', 'public.crm_project_get(uuid)',
    'public.crm_metrics(date, date, date)', 'public.crm_export(text, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

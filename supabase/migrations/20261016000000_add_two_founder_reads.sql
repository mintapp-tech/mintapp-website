-- Forward-only, additive. The corrected two-founder workflow, part 2 of 2: the
-- reads behind the simplified interface (command centre, Leads & Clients, lead
-- detail, Growth). Read-only; new functions only, nothing existing is redefined.
-- Lists carry names and ids, never email addresses or phone numbers.

-- The latest version of each pack artifact for one inquiry.
create or replace function public.pack_latest(p_inquiry_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  -- "unsupported": a generated design with no library pattern, to be made by hand.
  select coalesce(jsonb_object_agg(x.artifact, jsonb_build_object('version', x.version, 'review_status', x.review_status, 'source', x.source, 'created_by', x.created_by,
           'unsupported', coalesce(x.content ->> 'format' = 'pack-design' and x.content -> 'blueprint' -> 'pattern' = 'null'::jsonb, false))), '{}'::jsonb)
  from (
    select distinct on (d.artifact) d.artifact, d.version, d.review_status, d.source, d.created_by, d.content
    from public.preparation_drafts as d
    where d.inquiry_id = p_inquiry_id and d.artifact <> 'note'
    order by d.artifact, d.version desc
  ) as x;
$$;

create or replace function public.lead_list(p_filters jsonb default '{}'::jsonb)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(row_data order by sort_key desc), '[]'::jsonb)
  from (
    select i.created_at as sort_key,
      jsonb_build_object(
        'id', i.id,
        'created_at', i.created_at,
        'client_name', i.full_name,
        'company_name', coalesce(co.name, i.company_name),
        'language', i.preferred_language,
        'project_type', i.project_type,
        'summary', left(i.project_description, 140),
        'booking_status', i.booking_status,
        'meeting_start_at', i.meeting_start_at,
        'lead_status', i.lead_status,
        'paused_until', d.paused_until,
        'priority', d.priority,
        'owners', to_jsonb(i.owners),
        'next_action', (
          select jsonb_build_object('id', f.id, 'action', f.action, 'owner', f.owner, 'due_on', f.due_on, 'kind', f.kind)
          from public.inquiry_follow_ups as f where f.inquiry_id = i.id and f.done_at is null order by f.due_on, f.created_at limit 1),
        'pack', jsonb_build_object('job', p.status, 'error', p.last_error, 'artifacts', public.pack_latest(i.id),
          'review_due', (select f.due_on from public.inquiry_follow_ups as f where f.inquiry_id = i.id and f.kind = 'pack_review' and f.done_at is null limit 1)),
        'proposal_status', (select q.status from public.crm_proposals as q where q.inquiry_id = i.id and q.status <> 'superseded' order by q.version desc limit 1),
        'project_id', (select pr.id from public.crm_projects as pr where pr.inquiry_id = i.id)
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
      and (jsonb_typeof(p_filters -> 'stages') is distinct from 'array' or i.lead_status in (select jsonb_array_elements_text(p_filters -> 'stages')))
      and (nullif(p_filters ->> 'priority', '') is null or d.priority = p_filters ->> 'priority')
      and (nullif(p_filters ->> 'paused', '') is null or (p_filters ->> 'paused' = 'yes') = (d.paused_until is not null))
  ) as rows;
$$;

-- What the lead page adds to dashboard_inquiry and crm_inquiry_extra.
create or replace function public.lead_detail(p_inquiry_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'budget_currency', i.budget_currency,
    'priority', d.priority,
    'paused_until', d.paused_until,
    'deal', jsonb_build_object('contract_status', d.contract_status, 'contract_signed_on', d.contract_signed_on, 'contract_reference', d.contract_reference, 'commercial_notes', d.commercial_notes),
    'review_action', (select jsonb_build_object('id', f.id, 'owner', f.owner, 'due_on', f.due_on) from public.inquiry_follow_ups as f where f.inquiry_id = i.id and f.kind = 'pack_review' and f.done_at is null limit 1),
    'pack_latest', public.pack_latest(i.id),
    'last_payload', p.last_payload)
  from public.project_inquiries as i
  left join public.inquiry_crm as d on d.inquiry_id = i.id
  left join public.inquiry_preparations as p on p.inquiry_id = i.id
  where i.id = p_inquiry_id and i.deleted_at is null;
$$;

-- The command centre: everything a founder needs today, in one read. The
-- application decides what to show (empty sections are hidden).
create or replace function public.crm_command_centre(p_today date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with live as (
    select i.* from public.project_inquiries as i where i.deleted_at is null
  ),
  actions as (
    select jsonb_build_object('kind', case when f.kind = 'pack_review' then 'pack_review' else 'lead' end, 'id', f.id, 'inquiry_id', i.id, 'name', coalesce(nullif(i.company_name, ''), i.full_name),
                              'action', f.action, 'owner', f.owner, 'due_on', f.due_on, 'meeting_start_at', i.meeting_start_at) as a, f.due_on
    from public.inquiry_follow_ups as f join live as i on i.id = f.inquiry_id
    where f.done_at is null and f.due_on <= p_today + 7
    union all
    select jsonb_build_object('kind', 'prospect', 'id', p.id, 'inquiry_id', null, 'name', p.company_name, 'action', p.follow_up_action, 'owner', p.follow_up_owner, 'due_on', p.follow_up_due_on, 'meeting_start_at', null), p.follow_up_due_on
    from public.crm_prospects as p
    where p.follow_up_due_on is not null and p.follow_up_due_on <= p_today + 7 and p.stage not in ('not_now', 'disqualified', 'inquiry_submitted')
  ),
  meetings as (
    select i.id, coalesce(nullif(i.company_name, ''), i.full_name) as name, i.meeting_start_at, i.meeting_timezone, i.cal_booking_id, i.owners, public.pack_latest(i.id) as artifacts, p.status as job
    from live as i left join public.inquiry_preparations as p on p.inquiry_id = i.id
    where i.booking_status = 'booked' and i.meeting_start_at >= now() - interval '2 hours' and i.meeting_start_at < now() + interval '21 days'
  )
  select jsonb_build_object(
    'actions', (select coalesce(jsonb_agg(a order by due_on, a ->> 'name'), '[]'::jsonb) from actions),
    'meetings', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'start', meeting_start_at, 'timezone', meeting_timezone, 'booking_uid', cal_booking_id,
                    'owners', to_jsonb(owners), 'artifacts', artifacts, 'job', job) order by meeting_start_at), '[]'::jsonb) from meetings),
    'packs_to_review', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'name', coalesce(nullif(i.company_name, ''), i.full_name), 'meeting_start_at', i.meeting_start_at,
                    'artifacts', public.pack_latest(i.id)) order by i.meeting_start_at nulls last), '[]'::jsonb)
                    from live as i where exists (select 1 from public.preparation_drafts as d where d.inquiry_id = i.id and d.artifact <> 'note' and d.review_status = 'in_review'
                      and d.version = (select max(x.version) from public.preparation_drafts as x where x.inquiry_id = i.id and x.artifact = d.artifact))),
    'awaiting_response', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'name', coalesce(nullif(i.company_name, ''), i.full_name), 'created_at', i.created_at, 'owners', to_jsonb(i.owners)) order by i.created_at), '[]'::jsonb)
                    from live as i left join public.inquiry_crm as d on d.inquiry_id = i.id
                    where i.lead_status = 'new' and i.booking_status = 'not_booked' and d.paused_until is null
                      and not exists (select 1 from public.inquiry_follow_ups as f where f.inquiry_id = i.id and f.done_at is null)),
    'projects', (select coalesce(jsonb_agg(jsonb_build_object('id', pr.id, 'name', pr.name, 'status', pr.status, 'owners', to_jsonb(pr.owners)) order by pr.created_at desc), '[]'::jsonb)
                    from public.crm_projects as pr where pr.status in ('planned', 'active', 'on_hold')),
    'workload', (select coalesce(jsonb_agg(jsonb_build_object('owner', o, 'open', (select count(*) from actions where a ->> 'owner' = o), 'overdue', (select count(*) from actions where a ->> 'owner' = o and due_on < p_today),
                    'leads', (select count(*) from live as i where o = any (i.owners) and i.lead_status not in ('won', 'lost'))) order by o), '[]'::jsonb)
                    from (select distinct o from (select unnest(i.owners) as o from live as i where i.lead_status not in ('won', 'lost')
                          union select owner from public.inquiry_follow_ups where done_at is null and owner is not null
                          union select follow_up_owner from public.crm_prospects where follow_up_owner is not null) as u where o is not null) as m),
    'campaign', jsonb_build_object(
      'active_prospects', (select count(*) from public.crm_prospects where stage not in ('not_now', 'disqualified', 'inquiry_submitted')),
      'touches_7d', (select count(*) from public.crm_outreach_touches where kind = 'outbound' and occurred_on > p_today - 7),
      'replies_7d', (select count(*) from public.crm_outreach_touches where kind = 'reply' and occurred_on > p_today - 7),
      'inquiries_30d', (select count(*) from live where (created_at at time zone 'Africa/Cairo')::date > p_today - 30)),
    'alerts', jsonb_build_object(
      'unowned_actions', (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'inquiry_id', i.id, 'name', coalesce(nullif(i.company_name, ''), i.full_name))), '[]'::jsonb)
                    from public.inquiry_follow_ups as f join live as i on i.id = f.inquiry_id where f.done_at is null and f.owner is null),
      'pack_problems', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'name', coalesce(nullif(i.company_name, ''), i.full_name), 'status', p.status, 'error', p.last_error)), '[]'::jsonb)
                    from live as i join public.inquiry_preparations as p on p.inquiry_id = i.id where p.status in ('failed', 'paused')),
      'automation_paused', (select coalesce(jsonb_agg(jsonb_build_object('provider', c.provider, 'reason', c.paused_reason, 'at', c.paused_at)), '[]'::jsonb) from public.automation_control as c where c.paused),
      'unready_soon', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'start', meeting_start_at)), '[]'::jsonb)
                    from meetings where meeting_start_at < now() + interval '48 hours' and meeting_start_at > now()
                      and not ((artifacts -> 'design' ->> 'review_status') = 'approved' and (artifacts -> 'proposal' ->> 'review_status') = 'approved' and (artifacts -> 'discovery' ->> 'review_status') = 'approved')))
  );
$$;

-- Growth: prospects with their priority (no contact handles in the list).
create or replace function public.growth_prospect_list()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'company_name', p.company_name, 'contact_name', p.contact_name, 'priority', p.priority, 'trigger_note', p.trigger_note,
      'owner', p.owner, 'stage', p.stage, 'pool', p.pool, 'lead_origin', p.lead_origin,
      'follow_up', case when p.follow_up_due_on is null then null else jsonb_build_object('action', p.follow_up_action, 'owner', p.follow_up_owner, 'due_on', p.follow_up_due_on) end,
      'touches', (select count(*) from public.crm_outreach_touches as t where t.prospect_id = p.id and t.kind = 'outbound'),
      'last_touch_on', (select max(t.occurred_on) from public.crm_outreach_touches as t where t.prospect_id = p.id),
      'do_not_contact', p.do_not_contact, 'inquiry_id', p.inquiry_id
    ) order by case p.priority when 'high' then 0 when 'medium' then 1 when 'low' then 2 else 3 end, p.follow_up_due_on nulls last, p.created_at), '[]'::jsonb)
  from public.crm_prospects as p;
$$;

-- Which automation providers are paused (for example the free allowance is used
-- up), so lists can say "Needs manual action" instead of "Preparing".
create or replace function public.automation_paused()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('provider', c.provider, 'paused_reason', c.paused_reason) order by c.provider), '[]'::jsonb)
  from public.automation_control as c where c.paused;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.pack_latest(uuid)', 'public.lead_list(jsonb)', 'public.lead_detail(uuid)', 'public.crm_command_centre(date)', 'public.growth_prospect_list()', 'public.automation_paused()'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

import { SEED_ADAM, SEED_DOMAIN, SEED_LEADS, SEED_OMAR, SEED_PROSPECTS, seedId, type SeedLead } from "./data";

// supabase/review/seed_curated.sql, generated from data.ts (npm run review:seed).
// Everything goes through the database's own functions (bookings, stages, owners,
// Pack versions and reviews, proposals, projects, prospects), so the result is what
// the application itself would have recorded. The file stays ASCII-only: anything
// else is a Postgres Unicode escape, so no code page or clipboard can alter it.

// A SQL string literal; non-ASCII as U&'...' UESCAPE '!' escapes (JSON backslashes stay literal).
export function sqlText(value: string): string {
  let escaped = "";
  let plain = true;
  for (const ch of value) {
    const cp = ch.codePointAt(0)!;
    if (ch === "'") escaped += "''";
    else if (ch === "!") (escaped += "!!"), (plain = false);
    else if (cp > 126 || cp < 32) {
      plain = false;
      escaped += cp > 0xffff ? `!+${cp.toString(16).padStart(6, "0")}` : `!${cp.toString(16).padStart(4, "0")}`;
    } else escaped += ch;
  }
  return plain ? `'${escaped}'` : `U&'${escaped}' UESCAPE '!'`;
}
const json = (value: unknown) => `${sqlText(JSON.stringify(value))}::jsonb`;
const uuid = (n: number) => `'${seedId(n)}'::uuid`;
const actorOf = (owners: string[]) => (owners[0] === "adam" ? SEED_ADAM : SEED_OMAR);
const days = (n: number) => (n >= 0 ? `now() + interval '${n} days'` : `now() - interval '${-n} days'`);

function lead(l: SeedLead): string[] {
  const id = uuid(l.n);
  const actor = actorOf(l.owners);
  const out = [
    `-- ${l.n}. ${l.demonstrates}`,
    `insert into public.project_inquiries (id, full_name, email, company_name, preferred_language, project_type, project_description, budget_range, budget_currency, timeline, country, consent_given, consent_at, source_page, created_at)`,
    `values (${id}, ${sqlText(l.name)}, ${sqlText(l.email)}, ${l.company ? sqlText(l.company) : "null"}, '${l.lang}', '${l.projectType}', ${sqlText(l.description)}, ${l.budget ? sqlText(l.budget.range) : "null"}, ${l.budget ? `'${l.budget.currency}'` : "null"}, ${l.timeline ? sqlText(l.timeline) : "null"}, ${sqlText(l.country)}, true, ${days(-l.daysAgo)}, '/${l.lang}/start', ${days(-l.daysAgo)});`,
  ];
  if (l.owners.length) out.push(`select public.crm_set_owners(${id}, ${json(l.owners)}, '${actor}');`);
  if (l.booking) out.push(`select public.apply_booking_created(${id}, '${l.booking.uid}', ${days(l.booking.inDays)}, 'Africa/Cairo', ${days(Math.min(0, l.booking.inDays) - 3)});`);
  if (l.createCompany) out.push(`select public.crm_create_from_inquiry(${id}, 'new', null, '${actor}');`);
  let version = 0;
  for (const v of l.versions ?? []) {
    version += 1;
    out.push(`select public.pack_save_artifact(${id}, '${v.artifact}', ${json(v.content)}, '${v.source}', '${v.author}');`);
    for (const r of v.reviews) out.push(`select public.dashboard_review(${id}, ${version}, '${r.to}', '${r.by}');`);
  }
  for (const stage of l.stages) {
    if (stage === "lost" && l.loss) out.push(`select public.crm_set_stage(${id}, 'lost', '${actor}', '${l.loss.reason}', ${sqlText(l.loss.note)});`);
    else out.push(`select public.crm_set_stage(${id}, '${stage}', '${actor}');`);
    if (stage === "proposal_prep" && l.proposal) {
      out.push(`select public.crm_create_proposal(${id}, ${json(l.proposal.fields)}, '${actor}');`);
      for (const t of l.proposal.transitions) {
        out.push(`select public.crm_proposal_transition((select p.id from public.crm_proposals as p where p.inquiry_id = ${id} order by p.version desc limit 1), '${t.to}', '${t.by}');`);
      }
    }
  }
  const fields: Record<string, string> = {};
  if (l.priority) fields.priority = l.priority;
  if (l.contract) Object.assign(fields, { contract_status: l.contract.status, contract_reference: l.contract.reference });
  // A signed contract carries its signing date in the same save (the database requires both).
  const signed = l.contract ? ` || jsonb_build_object('contract_signed_on', (current_date - ${l.contract.signedDaysAgo})::text)` : "";
  if (Object.keys(fields).length) out.push(`select public.crm_save_lead(${id}, ${json(fields)}${signed}, '${actor}');`);
  if (l.pausedForDays) out.push(`select public.crm_save_lead(${id}, jsonb_build_object('paused_until', (current_date + ${l.pausedForDays})::text), '${actor}');`);
  if (l.followUp) out.push(`select public.dashboard_add_follow_up(${id}, ${sqlText(l.followUp.action)}, '${l.followUp.owner}', current_date + ${l.followUp.inDays}, '${actor}');`);
  if (l.project) {
    out.push(`select public.crm_convert_to_project(${id}, ${sqlText(l.project.name)}, '${actor}');`);
    out.push(`select public.crm_set_project_status((select pr.id from public.crm_projects as pr where pr.inquiry_id = ${id}), '${l.project.status}', '${actor}');`);
  }
  out.push("");
  return out;
}

function prospect(p: (typeof SEED_PROSPECTS)[number]): string[] {
  const actor = p.owner === "adam" ? SEED_ADAM : SEED_OMAR;
  const fields = { company_name: p.company, country: p.country, sector: p.sector, pool: p.pool, lead_origin: "outbound", contact_name: p.contact, contact_role: p.role, contact_channel: p.channel, language: p.language, trigger_note: p.trigger, owner: p.owner };
  const body = [`  v := public.crm_save_prospect(null, ${json(fields)}, '${actor}');`];
  if (p.stage === "researched") body.push(`  perform public.crm_set_prospect_stage(v, 'researched', '${actor}');`);
  if (p.stage === "contacted" && p.followUp) {
    body.push(`  perform public.crm_set_prospect_stage(v, 'contacted', '${actor}', ${sqlText(p.followUp.action)}, '${p.owner}', current_date + ${p.followUp.inDays});`);
    if (p.touch) body.push(`  perform public.crm_log_touch(v, 'outbound', 1, '${p.channel}', current_date - 2, ${sqlText(p.touch.summary)}, '${actor}', ${sqlText(p.followUp.action)}, '${p.owner}', current_date + ${p.followUp.inDays});`);
  }
  if (p.stage === "inquiry_submitted" && p.linksTo) body.push(`  perform public.crm_link_prospect_inquiry(v, ${uuid(p.linksTo)}, '${actor}');`);
  return [`-- Prospect ${p.n}. ${p.demonstrates}`, "do $$", "declare", "  v uuid;", "begin", ...body, "end;", "$$;", ""];
}

export function seedSql(): string {
  const ids = SEED_LEADS.map((l) => `'${seedId(l.n)}'`).join(", ");
  return [
    "-- SYNTHETIC REVIEW DATABASE ONLY (mintapp-review). Never apply to the live database.",
    "-- Generated from src/lib/review-seed/data.ts by `npm run review:seed`; do not edit by hand.",
    "--",
    "-- The curated review dataset: one readable, fictional example for every workflow",
    "-- position, English and Arabic, with and without a company, inbound and outbound, and",
    "-- one complete successful case (Lotus Dental Care) from booking to an approved Direction",
    "-- Pack, a won deal and a project. Everything is invented; email addresses use the",
    `-- reserved ${SEED_DOMAIN} domain; there are no phone numbers. It sets no default`,
    "-- reviewer: Omar chooses that in Settings.",
    "--",
    "-- Needs supabase/review/review_tools.sql first. Re-running replaces the previous seed",
    "-- and nothing else.",
    "",
    "begin;",
    "",
    "do $$",
    "declare",
    "  v text;",
    "begin",
    "  if to_regprocedure('public.review_environment()') is null then",
    "    raise exception 'Not the synthetic review database (no review_environment()). Nothing was changed.';",
    "  end if;",
    "  execute 'select public.review_environment()' into v;",
    "  if v is distinct from 'synthetic-review' then",
    "    raise exception 'Not the synthetic review database. Nothing was changed.';",
    "  end if;",
    "  if to_regprocedure('public.review_delete(uuid[], uuid[], uuid[], uuid[])') is null then",
    "    raise exception 'Install supabase/review/review_tools.sql first. Nothing was changed.';",
    "  end if;",
    "end;",
    "$$;",
    "",
    "-- The previous seed, and only it.",
    "select count(*) as previous_seed_rows from public.review_delete(",
    `  array(select i.id from public.project_inquiries as i where i.email like '%@${SEED_DOMAIN}' or i.id in (${ids})),`,
    `  array(select p.id from public.crm_prospects as p where p.created_by like '%@${SEED_DOMAIN}'),`,
    `  array(select c.id from public.crm_companies as c where c.created_by like '%@${SEED_DOMAIN}'),`,
    `  array(select k.id from public.crm_contacts as k where k.created_by like '%@${SEED_DOMAIN}'));`,
    "",
    ...SEED_LEADS.flatMap(lead),
    ...SEED_PROSPECTS.flatMap(prospect),
    "commit;",
    "",
  ].join("\n");
}

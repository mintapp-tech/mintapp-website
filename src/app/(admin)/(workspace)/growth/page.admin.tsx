import type { Metadata } from "next";
import Link from "next/link";
import Notice from "@/components/crm/Notice";
import { Empty, PageHead, Panel, linkClass } from "@/components/crm/parts";
import { ScoreFields, SelectField, TextAreaField, TextField, optionsOf } from "@/components/crm/Fields";
import { PriorityChip } from "@/components/crm/LeadParts";
import SubmitButton from "@/components/dashboard/SubmitButton";
import { Chip, button, card, formatDay, primary, todayInCairo } from "@/components/dashboard/ui";
import { teamMembers } from "@/lib/admin/auth/config";
import { requireAdmin } from "@/lib/admin/auth/state";
import { adminText } from "@/lib/admin/locale";
import { people } from "@/lib/admin/people";
import { commandCentre, growthProspects } from "@/lib/crm/data";
import { PRIORITIES } from "@/lib/crm/schemas";
import { CONTACT_CHANNELS, FIT_TIERS, PROSPECT_POOLS } from "@/lib/crm/types";
import { quickProspectAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Growth" };

const summaryClass = "flex cursor-pointer list-none items-center gap-2 text-[14px] font-semibold [&::-webkit-details-marker]:hidden";

// Growth: the prospects worth contacting now, by priority, with owner, reason,
// history, next action and source; the current numbers; and a quick way to add one.
export default async function GrowthPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const { locale, t } = await adminText();
  const g = t.lead.growth;
  const members = teamMembers();
  const who = people(members);
  const today = todayInCairo();
  const [rows, centre] = await Promise.all([growthProspects(), commandCentre(today)]);
  const open = rows.filter((r) => !["not_now", "disqualified"].includes(r.stage));
  const closed = rows.length - open.length;

  return (
    <>
      <PageHead title={g.title}>
        <form action="/export/prospects" method="post">
          <button type="submit" className={button}>
            {t.crm.common.export}
          </button>
        </form>
      </PageHead>
      <p className="mt-[-12px] mb-5 max-w-[72ch] text-[14px] text-ink-soft">{g.intro}</p>
      <Notice n={sp.n} e={sp.e} t={t.crm} />

      <section aria-labelledby="growth-numbers" className="mb-6">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="growth-numbers" className="m-0 text-[15px] font-bold">
            {g.numbers}
          </h2>
          <Link href="/metrics" className={`${linkClass} text-[13.5px]`}>
            {g.detailed}
          </Link>
        </div>
        <dl className="m-0 grid grid-cols-2 gap-3 lg:grid-cols-4" data-growth-numbers>
          {(["active_prospects", "touches_7d", "replies_7d", "inquiries_30d"] as const).map((k) => (
            <div key={k} className={`${card} flex flex-col-reverse px-4 py-3`}>
              <dt className="mt-1 text-[12.5px] font-semibold text-ink-soft">{t.lead.home.numbers[k]}</dt>
              <dd className="m-0 text-[22px] leading-none font-bold">{centre.campaign[k]}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 mb-0 text-[12.5px] text-ink-faint">{g.manualNote}</p>
      </section>

      <section aria-labelledby="growth-list" className="mb-8">
        <h2 id="growth-list" className="m-0 mb-3 text-[15px] font-bold">
          {g.list} <span className="font-normal text-ink-faint">({open.length})</span>
        </h2>
        {open.length === 0 ? (
          <Empty>{g.empty}</Empty>
        ) : (
          <ul aria-label={g.list} className="m-0 flex list-none flex-col gap-3 p-0" data-prospects>
            {open.map((r) => {
              const overdue = r.follow_up && r.follow_up.due_on < today;
              return (
                <li key={r.id} id={`prospect-${r.id}`} className={`${card} relative p-4 sm:p-5`} data-prospect={r.id}>
                  <dl className="m-0 grid grid-cols-1 gap-x-5 gap-y-3 text-[14px] sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1fr)]">
                    <div className="min-w-0">
                      <dt className="sr-only">{g.columns.account}</dt>
                      <dd className="m-0">
                        <Link href={`/outreach/${r.id}`} className="text-[16px] font-bold text-ink after:absolute after:inset-0 after:content-[''] hover:underline">
                          <bdi>{r.company_name}</bdi>
                        </Link>
                        {r.contact_name && (
                          <span className="block text-[13px] text-ink-soft">
                            <bdi>{r.contact_name}</bdi>
                          </span>
                        )}
                        <span className="mt-1.5 flex flex-wrap gap-1.5">
                          <PriorityChip priority={r.priority} t={t} />
                          <Chip>{t.crm.prospectStages[r.stage as keyof typeof t.crm.prospectStages] ?? r.stage}</Chip>
                          {r.do_not_contact && <Chip tone="attention">{t.crm.outreach.doNotContact}</Chip>}
                        </span>
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[12px] font-semibold text-ink-faint">{g.columns.reason}</dt>
                      <dd dir="auto" className="m-0 mt-0.5">
                        {r.trigger_note ?? <span className="text-ink-faint">–</span>}
                      </dd>
                      <dt className="mt-2 text-[12px] font-semibold text-ink-faint">{g.columns.history}</dt>
                      <dd className="m-0 mt-0.5 text-[13px] text-ink-soft">{r.touches || r.last_touch_on ? g.touches(r.touches, r.last_touch_on ? formatDay(r.last_touch_on, locale) : null) : g.noTouches}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[12px] font-semibold text-ink-faint">{g.columns.next}</dt>
                      <dd className="m-0 mt-0.5" data-next-action>
                        {r.follow_up ? (
                          <>
                            <span dir="auto" className="block font-medium">
                              {r.follow_up.action}
                            </span>
                            <span className={`text-[12.5px] ${overdue ? "font-semibold text-red-700" : "text-ink-soft"}`}>
                              {who.ofId(r.follow_up.owner)} · {overdue ? `${t.lead.common.overdue} · ` : ""}
                              {formatDay(r.follow_up.due_on, locale)}
                            </span>
                          </>
                        ) : (
                          <span className="text-ink-faint">{t.lead.common.noNextAction}</span>
                        )}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[12px] font-semibold text-ink-faint">{g.columns.owner}</dt>
                      <dd className="m-0 mt-0.5">{r.owner ? who.ofId(r.owner) : <span className="text-ink-faint">{t.lead.common.unassigned}</span>}</dd>
                      <dt className="mt-2 text-[12px] font-semibold text-ink-faint">{g.columns.attribution}</dt>
                      <dd className="m-0 mt-0.5 text-[13px] text-ink-soft">
                        {[r.lead_origin ? t.crm.origins[r.lead_origin as keyof typeof t.crm.origins] : null, r.pool ? t.crm.pools[r.pool as keyof typeof t.crm.pools] : null].filter(Boolean).join(" · ") || "–"}
                      </dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
        {closed > 0 && (
          <p className="mt-3 mb-0 text-[13px] text-ink-soft">
            <Link href="/outreach?stage=not_now" className={linkClass}>
              {t.crm.prospectStages.not_now}
            </Link>{" "}
            ·{" "}
            <Link href="/outreach?stage=disqualified" className={linkClass}>
              {t.crm.prospectStages.disqualified}
            </Link>{" "}
            ({closed})
          </p>
        )}
      </section>

      <Panel title={g.add} id="add-prospect">
        <p className="mt-0 mb-4 text-[13px] text-ink-soft">{g.addHelp}</p>
        <form action={quickProspectAction} className="flex flex-col gap-4" data-quick-prospect>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField id="qp-company" name="company_name" text={g.fields.company} required maxLength={160} />
            <TextField id="qp-contact" name="contact_handle" text={g.fields.contact} hint={g.fields.contactHelp} maxLength={200} />
          </div>
          <TextField id="qp-reason" name="trigger_note" text={g.fields.reason} hint={g.fields.reasonHelp} maxLength={500} required />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SelectField id="qp-owner" name="owner" text={g.fields.owner} required blank={g.choose} options={members.map((m) => ({ value: m.id, label: m.name }))} />
            <SelectField id="qp-priority" name="priority" text={g.fields.priority} blank={t.lead.noPriority} options={PRIORITIES.map((p) => ({ value: p, label: t.lead.priorities[p] }))} />
            <div className="sm:col-span-2 lg:col-span-1">
              <TextField id="qp-action" name="action" text={g.fields.next} placeholder={g.fields.nextPlaceholder} required maxLength={500} />
            </div>
            <TextField id="qp-due" name="dueOn" type="date" text={g.fields.due} required min={today} />
          </div>
          <details className="group rounded-xl bg-surface-2/60 p-3.5" data-research>
            <summary className={summaryClass}>{g.research}</summary>
            <div className="mt-3 flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TextField id="qp-website" name="website" text={t.crm.outreach.fields.website} maxLength={300} ltr />
                <TextField id="qp-country" name="country" text={t.crm.outreach.fields.country} maxLength={80} />
                <TextField id="qp-sector" name="sector" text={t.crm.outreach.fields.sector} maxLength={120} />
                <SelectField id="qp-pool" name="pool" text={t.crm.outreach.fields.pool} blank={g.choose} options={optionsOf(t.crm.pools, PROSPECT_POOLS)} />
                <SelectField
                  id="qp-origin"
                  name="lead_origin"
                  text={t.crm.outreach.fields.origin}
                  defaultValue="outbound"
                  required
                  options={(["warm", "outbound", "referral", "partner"] as const).map((v) => ({ value: v, label: t.crm.origins[v] }))}
                />
                <SelectField id="qp-tier" name="fit_tier" text={t.crm.outreach.fields.tier} blank={t.crm.source.unknown} options={optionsOf(t.crm.fitTiers, FIT_TIERS)} />
                <TextField id="qp-contact-name" name="contact_name" text={t.crm.outreach.fields.contactName} maxLength={120} />
                <TextField id="qp-role" name="contact_role" text={t.crm.outreach.fields.contactRole} maxLength={120} />
                <SelectField id="qp-channel" name="contact_channel" text={t.crm.outreach.fields.channel} blank={g.choose} options={optionsOf(t.crm.channels, CONTACT_CHANNELS)} />
                <SelectField id="qp-language" name="language" text={t.crm.outreach.fields.language} blank={t.crm.common.notSet} options={[{ value: "en", label: t.languages.en }, { value: "ar", label: t.languages.ar }]} />
              </div>
              <TextAreaField id="qp-observation" name="observation" text={t.crm.outreach.fields.observation} rows={2} maxLength={1000} />
              <TextField id="qp-proof" name="proof_case" text={t.crm.outreach.fields.proof} maxLength={300} />
              <TextAreaField id="qp-fit" name="fit_reason" text={t.crm.outreach.fields.fit} rows={2} maxLength={1000} />
              <ScoreFields idPrefix="qp-score" score={null} t={t.crm.score} />
            </div>
          </details>
          <SubmitButton className={`${primary} self-start`}>{g.save}</SubmitButton>
        </form>
      </Panel>
    </>
  );
}

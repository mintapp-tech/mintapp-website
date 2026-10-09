import type { Metadata } from "next";
import Link from "next/link";
import Notice from "@/components/crm/Notice";
import { ProspectForm } from "@/components/crm/ProspectForm";
import { Empty, PageHead, Panel, linkClass, smallMuted } from "@/components/crm/parts";
import SubmitButton from "@/components/dashboard/SubmitButton";
import { Chip, button, card, formatDay, primary, todayInCairo, type ChipTone } from "@/components/dashboard/ui";
import { SelectField, optionsOf } from "@/components/crm/Fields";
import { teamMembers } from "@/lib/admin/auth/config";
import { requireAdmin } from "@/lib/admin/auth/state";
import { adminText } from "@/lib/admin/locale";
import { people } from "@/lib/admin/people";
import { prospectList } from "@/lib/crm/data";
import { PROSPECT_POOLS, PROSPECT_STAGES, type ProspectPool, type ProspectRow, type ProspectStage } from "@/lib/crm/types";
import { createProspectAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Outreach" };

// The first 30 accounts are divided on purpose (campaign playbook, section 12).
const POOL_TARGETS: Record<ProspectPool, number> = { warm: 10, trigger_startup: 8, operational_sme: 7, referral_partner: 5 };

const STAGE_TONES: Record<ProspectStage, ChipTone> = {
  identified: "neutral",
  researched: "neutral",
  contacted: "info",
  replied: "info",
  qualified: "ok",
  inquiry_submitted: "ok",
  not_now: "warn",
  disqualified: "neutral",
};

export default async function OutreachPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const { locale, t } = await adminText();
  const o = t.crm.outreach;
  const members = teamMembers();
  const who = people(members);
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const ownerF = members.some((m) => m.id === one("owner")) ? one("owner") : "";
  const stageF = (PROSPECT_STAGES as readonly string[]).includes(one("stage")) ? one("stage") : "";
  const poolF = (PROSPECT_POOLS as readonly string[]).includes(one("pool")) ? one("pool") : "";
  const all = await prospectList();
  const rows = all.filter((r) => (!ownerF || r.owner === ownerF) && (!stageF || r.stage === stageF) && (!poolF || r.pool === poolF));
  const today = todayInCairo();
  const filtered = Boolean(ownerF || stageF || poolF);
  const counted = (pool: ProspectPool) => all.filter((r) => r.pool === pool).length;

  const nextLine = (r: ProspectRow) => {
    if (!r.follow_up) return <span className="text-ink-faint">–</span>;
    const overdue = r.follow_up.due_on < today;
    return (
      <>
        <span dir="auto" className="block">
          {r.follow_up.action}
        </span>
        <span className={`block text-[12.5px] ${overdue ? "font-semibold text-red-700" : "text-ink-faint"}`}>
          {who.ofId(r.follow_up.owner)} · {overdue ? `${o.overdue} · ` : ""}
          {formatDay(r.follow_up.due_on, locale)}
        </span>
      </>
    );
  };

  return (
    <>
      <PageHead eyebrowText={t.crm.nav.outreach} title={o.title}>
        <form action="/export/prospects" method="post">
          <button type="submit" className={button}>
            {t.crm.common.export}
          </button>
        </form>
      </PageHead>
      <p className="mt-0 mb-1 max-w-[72ch] text-[13.5px] text-ink-soft">{o.intro}</p>
      <p className="mt-0 mb-5 max-w-[72ch] text-[13px] font-semibold text-ink-soft">{o.rules}</p>
      <Notice n={sp.n} e={sp.e} t={t.crm} />

      <section aria-labelledby="pools" className="mb-6">
        <h2 id="pools" className="mb-3 text-[12px] font-bold tracking-[0.08em] text-ink-faint uppercase rtl:text-[13px] rtl:tracking-normal">
          {o.pools}
        </h2>
        <dl className="m-0 grid grid-cols-2 gap-3 lg:grid-cols-4" data-pools>
          {PROSPECT_POOLS.map((pool) => (
            <div key={pool} className={`${card} flex flex-col-reverse px-4 py-3.5`}>
              <dt className="mt-1.5 text-[12.5px] font-semibold text-ink-soft">{t.crm.pools[pool]}</dt>
              <dd className="m-0 text-[24px] leading-none font-bold">{o.poolTarget(counted(pool), POOL_TARGETS[pool])}</dd>
            </div>
          ))}
        </dl>
      </section>

      <form method="get" action="/outreach" role="search" className={`${card} mb-6 grid grid-cols-1 gap-3 p-4 sm:grid-cols-3`}>
        <SelectField id="po-owner" name="owner" text={o.filters.owner} defaultValue={ownerF} blank={o.filters.everyone} options={members.map((m) => ({ value: m.id, label: m.name }))} />
        <SelectField id="po-stage" name="stage" text={o.filters.stage} defaultValue={stageF} blank={o.filters.all} options={optionsOf(t.crm.prospectStages, PROSPECT_STAGES)} />
        <SelectField id="po-pool" name="pool" text={o.filters.pool} defaultValue={poolF} blank={o.filters.all} options={optionsOf(t.crm.pools, PROSPECT_POOLS)} />
        <div className="flex flex-wrap items-end gap-2 sm:col-span-3">
          <SubmitButton className={primary}>{t.crm.common.apply}</SubmitButton>
          {filtered && (
            <Link href="/outreach" className={button}>
              {t.crm.common.clear}
            </Link>
          )}
        </div>
      </form>

      {all.length === 0 ? (
        <Empty>{o.empty}</Empty>
      ) : rows.length === 0 ? (
        <Empty>{o.noMatches}</Empty>
      ) : (
        <>
          <div className={`${card} hidden overflow-hidden lg:block`}>
            <table className="w-full border-collapse text-start text-[14px]">
              <caption className="sr-only">{o.title}</caption>
              <thead className="border-b border-line bg-surface-2/60">
                <tr className="text-start text-[11.5px] font-bold tracking-[0.08em] text-ink-faint uppercase rtl:text-[12.5px] rtl:tracking-normal">
                  {(["company", "contact", "score", "stage", "owner", "next", "touches"] as const).map((k) => (
                    <th key={k} scope="col" className="px-4 py-3 text-start first:ps-5 last:pe-5">
                      {o.columns[k]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-line align-top first:border-t-0 hover:bg-canvas/70" data-prospect={r.id}>
                    <td className="py-4 ps-5 pe-4">
                      <Link href={`/outreach/${r.id}`} className={linkClass}>
                        <bdi>{r.company_name}</bdi>
                      </Link>
                      <span className="block text-[12.5px] text-ink-faint">{[r.country, r.pool ? t.crm.pools[r.pool] : null].filter(Boolean).join(" · ")}</span>
                      {r.trigger_note && (
                        <span dir="auto" className="mt-1 block max-w-[34ch] text-[13px] text-ink-soft">
                          {r.trigger_note}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {r.contact_name ? <bdi>{r.contact_name}</bdi> : <span className="text-ink-faint">–</span>}
                      {r.contact_role && <span className="block text-[12.5px] text-ink-faint">{r.contact_role}</span>}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">{r.lead_score === null ? <span className="text-ink-faint">–</span> : <Chip tone={r.lead_score >= 10 ? "ok" : "neutral"}>{r.lead_score}</Chip>}</td>
                    <td className="px-4 py-4">
                      <Chip tone={STAGE_TONES[r.stage]}>{t.crm.prospectStages[r.stage]}</Chip>
                      {r.do_not_contact && <Chip tone="attention" className="mt-1">{o.doNotContact}</Chip>}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">{who.ofId(r.owner)}</td>
                    <td className="px-4 py-4">{nextLine(r)}</td>
                    <td className="py-4 ps-4 pe-5 whitespace-nowrap">
                      {o.touchesOf(r.touches)}
                      {r.last_touch_on && <span className="block text-[12.5px] text-ink-faint">{o.lastTouch(formatDay(r.last_touch_on, locale))}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="m-0 flex list-none flex-col gap-3 p-0 lg:hidden" aria-label={o.title}>
            {rows.map((r) => (
              <li key={r.id} className={`${card} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/outreach/${r.id}`} className={linkClass}>
                    <bdi>{r.company_name}</bdi>
                  </Link>
                  <Chip tone={STAGE_TONES[r.stage]}>{t.crm.prospectStages[r.stage]}</Chip>
                </div>
                <p className={`m-0 mt-1 ${smallMuted}`}>
                  {[r.country, who.ofId(r.owner), r.lead_score === null ? null : t.crm.score.total(r.lead_score), o.touchesOf(r.touches)].filter(Boolean).join(" · ")}
                </p>
                {r.trigger_note && (
                  <p dir="auto" className="m-0 mt-1.5 text-[13px] text-ink-soft">
                    {r.trigger_note}
                  </p>
                )}
                <div className="mt-2 text-[13px]">{nextLine(r)}</div>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-8" id="add">
        <Panel title={o.add} id="add-prospect">
          <form action={createProspectAction} className="flex flex-col gap-4">
            <ProspectForm prefix="new" t={t} members={members} prospect={null} />
            <SubmitButton className={`${primary} self-start`}>{o.save}</SubmitButton>
          </form>
        </Panel>
      </div>
    </>
  );
}

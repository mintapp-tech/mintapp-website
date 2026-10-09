import type { Metadata } from "next";
import Link from "next/link";
import Notice from "@/components/crm/Notice";
import { Empty, PageHead, daysBetween, linkClass, smallMuted } from "@/components/crm/parts";
import { Chip, card, formatDay, todayInCairo } from "@/components/dashboard/ui";
import { teamMembers } from "@/lib/admin/auth/config";
import { requireAdmin } from "@/lib/admin/auth/state";
import { adminText } from "@/lib/admin/locale";
import { people } from "@/lib/admin/people";
import { inquiryList } from "@/lib/crm/data";
import { BOARD_GROUPS, isOpenStage } from "@/lib/crm/stages";
import type { InquiryListRow } from "@/lib/crm/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pipeline" };

// Every inquiry in the stage a person put it in. Read-only here: the stage is
// changed on the inquiry itself, and booking or cancelling never moves it.
export default async function PipelinePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const { locale, t } = await adminText();
  const p = t.crm.pipeline;
  const members = teamMembers();
  const who = people(members);
  const sp = await searchParams;
  const ownerParam = typeof sp.owner === "string" ? sp.owner : "";
  const owner = ownerParam === "unassigned" || members.some((m) => m.id === ownerParam) ? ownerParam : "";
  const rows = await inquiryList(owner ? { owner } : {});
  const today = todayInCairo();
  const byStage = (stage: string) => rows.filter((r) => r.lead_status === stage).sort((a, b) => a.stage_changed_at.localeCompare(b.stage_changed_at));
  const open = rows.filter((r) => isOpenStage(r.lead_status)).length;

  const renderCard = (r: InquiryListRow) => {
    const overdue = r.next_follow_up && r.next_follow_up.due_on < today;
    return (
      <li key={r.id} className={`${card} p-3 text-[13.5px] ${overdue ? "border-s-4 border-s-red-600" : ""}`} data-pipeline-card={r.id}>
        <Link href={`/inquiries/${r.id}`} className={linkClass}>
          <bdi>{r.client_name}</bdi>
        </Link>
        {r.company_name && (
          <span className="block text-ink-soft">
            <bdi>{r.company_name}</bdi>
          </span>
        )}
        <span className={`mt-1 block ${smallMuted}`}>
          {who.ofIds(r.owners, t.crm.common.unassigned)} · {t.crm.common.inStage(t.crm.common.daysAgo(daysBetween(r.stage_changed_at, today)))}
        </span>
        <span className="mt-1.5 flex flex-wrap gap-1">
          {overdue && <Chip tone="attention">{p.overdue}</Chip>}
          {!r.next_follow_up && isOpenStage(r.lead_status) && <Chip tone="warn">{p.noNext}</Chip>}
          {r.next_follow_up && !overdue && <Chip>{formatDay(r.next_follow_up.due_on, locale)}</Chip>}
          {r.lead_score !== null && <Chip tone={r.lead_score >= 10 ? "ok" : "neutral"}>{t.crm.score.total(r.lead_score)}</Chip>}
          {r.proposal_status && <Chip tone="info">{t.crm.proposalStatuses[r.proposal_status]}</Chip>}
        </span>
      </li>
    );
  };

  return (
    <>
      <PageHead eyebrowText={t.crm.nav.pipeline} title={p.title}>
        <form method="get" action="/pipeline" className="flex items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pipeline-owner" className="text-[13px] font-semibold">
              {p.ownerFilter}
            </label>
            <select id="pipeline-owner" name="owner" defaultValue={owner} className="rounded-xl border border-ink/15 bg-surface px-3 py-2 text-[14px]">
              <option value="">{p.everyone}</option>
              <option value="unassigned">{t.crm.common.unassigned}</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="inline-flex cursor-pointer items-center rounded-full border border-ink/15 bg-surface px-4 py-2 text-[13.5px] font-semibold hover:border-ink/40">
            {t.crm.common.apply}
          </button>
        </form>
      </PageHead>
      <p className="mt-0 mb-5 max-w-[70ch] text-[13.5px] text-ink-soft">
        {p.intro} <strong>{p.totalOpen(open)}</strong>
      </p>
      <Notice n={sp.n} e={sp.e} t={t.crm} />

      <div className="flex flex-col gap-8">
        {BOARD_GROUPS.map((group) => (
          <section key={group.id} aria-labelledby={`group-${group.id}`}>
            <h2 id={`group-${group.id}`} className="mb-3 text-[12px] font-bold tracking-[0.08em] text-ink-faint uppercase rtl:text-[13px] rtl:tracking-normal">
              {t.crm.stageGroups[group.id]}
            </h2>
            <div className={`grid grid-cols-1 gap-4 ${group.stages.length === 4 ? "lg:grid-cols-4" : group.stages.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
              {group.stages.map((stage) => {
                const items = byStage(stage);
                return (
                  <div key={stage} data-stage-column={stage} className="min-w-0 rounded-2xl bg-surface-2/60 p-3">
                    <h3 className="m-0 mb-2 flex items-baseline justify-between gap-2 text-[14px] font-semibold">
                      <span>{t.crm.stages[stage]}</span>
                      <span className="text-[12.5px] font-normal text-ink-soft">{p.count(items.length)}</span>
                    </h3>
                    {items.length === 0 ? (
                      <Empty>{p.empty}</Empty>
                    ) : (
                      <ul className="m-0 flex list-none flex-col gap-2 p-0">
                        {items.map((r) => renderCard(r))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

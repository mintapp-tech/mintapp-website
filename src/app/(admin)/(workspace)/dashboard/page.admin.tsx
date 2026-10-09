import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import Notice from "@/components/crm/Notice";
import { Empty, PageHead, Panel, RowList, Stat, linkClass, rowClass, smallMuted } from "@/components/crm/parts";
import { Chip, formatDate, formatDay, todayInCairo } from "@/components/dashboard/ui";
import { teamMembers } from "@/lib/admin/auth/config";
import { requireAdmin } from "@/lib/admin/auth/state";
import { adminText } from "@/lib/admin/locale";
import { people } from "@/lib/admin/people";
import { overview } from "@/lib/crm/data";
import { errorLabel } from "@/lib/dashboard/status";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard" };

function Section({ id, title, count, empty, children }: { id: string; title: string; count?: number; empty: string; children?: ReactNode }) {
  return (
    <Panel title={title} id={id} aside={count ? <span className={smallMuted}>{count}</span> : null}>
      {count === 0 || children == null ? <Empty>{empty}</Empty> : children}
    </Panel>
  );
}

// The day's view of the business: what needs a person, in the order it matters.
export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const { locale, t } = await adminText();
  const o = t.crm.overview;
  const today = todayInCairo();
  const data = await overview(today);
  const who = people(teamMembers());
  const when = (iso: string) => formatDate(iso, true, locale);
  const sp = await searchParams;

  return (
    <>
      <PageHead eyebrowText={o.eyebrow} title={o.title}>
        <p className="m-0 max-w-[52ch] text-[13.5px] text-ink-soft">{o.intro}</p>
      </PageHead>
      <Notice n={sp.n} e={sp.e} t={t.crm} />

      <dl className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-4" data-summary>
        <Stat value={data.counts.new_inquiries} title={o.counts.new_inquiries} href="/inquiries?stage=new" />
        <Stat value={data.counts.meetings_to_prepare} title={o.counts.meetings_to_prepare} tone="attention" />
        <Stat value={data.counts.overdue_follow_ups} title={o.counts.overdue_follow_ups} tone="attention" />
        <Stat value={data.counts.prep_failures} title={o.counts.prep_failures} tone="attention" href="/inquiries?preparation=failed" />
        <Stat value={data.counts.drafts_awaiting_review} title={o.counts.drafts_awaiting_review} />
        <Stat value={data.counts.proposals_awaiting} title={o.counts.proposals_awaiting} href="/proposals" />
        <Stat value={data.counts.unowned_open} title={o.counts.unowned_open} tone="attention" href="/inquiries?owner=unassigned" />
        <Stat value={data.counts.no_next_action} title={o.counts.no_next_action} tone="attention" />
      </dl>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <Section id="new" title={o.sections.newInquiries} count={data.new_inquiries.length} empty={o.empty.newInquiries}>
          <RowList label={o.sections.newInquiries}>
            {data.new_inquiries.map((r) => (
              <li key={r.id} className={rowClass}>
                <Link href={`/inquiries/${r.id}`} className={linkClass}>
                  <bdi>{r.name}</bdi>
                </Link>
                <span className={smallMuted}>
                  {when(r.at)} · {who.ofIds(r.owners, t.crm.common.unassigned)}
                </span>
              </li>
            ))}
          </RowList>
        </Section>

        <Section id="prepare" title={o.sections.toPrepare} count={data.meetings_to_prepare.length} empty={o.empty.toPrepare}>
          <RowList label={o.sections.toPrepare}>
            {data.meetings_to_prepare.map((r) => (
              <li key={r.id} className={rowClass}>
                <Link href={`/inquiries/${r.id}`} className={linkClass}>
                  <bdi>{r.name}</bdi>
                </Link>
                <span className="text-[12.5px] font-semibold text-red-700">{when(r.at)}</span>
              </li>
            ))}
          </RowList>
        </Section>

        <Section id="overdue" title={o.sections.overdue} count={data.overdue_follow_ups.length} empty={o.empty.overdue}>
          <RowList label={o.sections.overdue}>
            {data.overdue_follow_ups.map((r) => (
              <li key={`${r.kind}-${r.id}-${r.due_on}-${r.action}`} className="border-t border-line py-2.5 text-[14px] first:border-t-0 first:pt-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <Link href={r.kind === "prospect" ? `/outreach/${r.id}` : `/inquiries/${r.id}`} className={linkClass}>
                    <bdi>{r.name}</bdi>
                  </Link>
                  <span className="text-[12.5px] font-semibold text-red-700">
                    {who.ofId(r.owner)} · {formatDay(r.due_on, locale)}
                  </span>
                </div>
                <p dir="auto" className="m-0 mt-0.5 text-[13px] text-ink-soft">
                  <Chip className="me-2">{r.kind === "prospect" ? o.kindProspect : o.kindInquiry}</Chip>
                  {r.action}
                </p>
              </li>
            ))}
          </RowList>
        </Section>

        <Section id="attention" title={o.sections.attention} count={data.attention.length} empty={o.empty.attention}>
          <RowList label={o.sections.attention}>
            {data.attention.map((r) => (
              <li key={r.id} className={rowClass}>
                <Link href={`/inquiries/${r.id}`} className={linkClass}>
                  <bdi>{r.name}</bdi>
                </Link>
                <span className="flex flex-wrap gap-1">
                  {r.reasons.map((reason) => (
                    <Chip key={reason} tone="warn">
                      {t.crm.attention[reason]}
                    </Chip>
                  ))}
                </span>
              </li>
            ))}
          </RowList>
        </Section>

        <Section id="upcoming" title={o.sections.upcoming} count={data.upcoming_meetings.length} empty={o.empty.upcoming}>
          <RowList label={o.sections.upcoming}>
            {data.upcoming_meetings.map((r) => (
              <li key={r.id} className={rowClass}>
                <Link href={`/inquiries/${r.id}`} className={linkClass}>
                  <bdi>{r.name}</bdi>
                </Link>
                <span className="flex flex-wrap items-center gap-2">
                  <span className={smallMuted}>{when(r.at)}</span>
                  <Chip tone={r.ready ? "ok" : "warn"}>{r.ready ? o.ready : o.notReady}</Chip>
                </span>
              </li>
            ))}
          </RowList>
        </Section>

        <Section id="failures" title={o.sections.failures} count={data.prep_failures.length} empty={o.empty.failures}>
          <RowList label={o.sections.failures}>
            {data.prep_failures.map((r) => (
              <li key={r.id} className={rowClass}>
                <Link href={`/inquiries/${r.id}`} className={linkClass}>
                  <bdi>{r.name}</bdi>
                </Link>
                <span className="text-[12.5px] text-red-700">{errorLabel(r.error, locale)}</span>
              </li>
            ))}
          </RowList>
        </Section>

        <Section id="review" title={o.sections.review} count={data.drafts_awaiting_review.length} empty={o.empty.review}>
          <RowList label={o.sections.review}>
            {data.drafts_awaiting_review.map((r) => (
              <li key={r.id} className={rowClass}>
                <Link href={`/inquiries/${r.id}#draft`} className={linkClass}>
                  <bdi>{r.name}</bdi>
                </Link>
                <span className={smallMuted}>
                  {o.version(r.version)} · {o.writtenBy(who.ofEmail(r.author) || r.author)}
                </span>
              </li>
            ))}
          </RowList>
        </Section>

        <Section id="proposals" title={o.sections.proposals} count={data.proposals_awaiting.length} empty={o.empty.proposals}>
          <RowList label={o.sections.proposals}>
            {data.proposals_awaiting.map((r) => (
              <li key={r.id} className={rowClass}>
                <Link href={`/inquiries/${r.inquiry_id}#proposal`} className={linkClass}>
                  <bdi>{r.name}</bdi>
                </Link>
                <span className={smallMuted}>
                  {t.crm.proposals.version(r.version)} · {t.crm.proposalStatuses[r.status]}
                </span>
              </li>
            ))}
          </RowList>
        </Section>
      </div>

      <div className="mt-5 grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <Section id="workload" title={o.sections.workload} count={data.owner_workload.length} empty={o.empty.workload}>
          <table className="w-full border-collapse text-start text-[14px]">
            <caption className="sr-only">{o.sections.workload}</caption>
            <thead>
              <tr className="text-start text-[11.5px] font-bold tracking-[0.08em] text-ink-faint uppercase rtl:text-[12.5px] rtl:tracking-normal">
                <th scope="col" className="pb-2 text-start">
                  {o.workloadColumns.owner}
                </th>
                <th scope="col" className="pb-2 text-start">
                  {o.workloadColumns.inquiries}
                </th>
                <th scope="col" className="pb-2 text-start">
                  {o.workloadColumns.followUps}
                </th>
                <th scope="col" className="pb-2 text-start">
                  {o.workloadColumns.overdue}
                </th>
                <th scope="col" className="pb-2 text-start">
                  {o.workloadColumns.prospects}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.owner_workload.map((w) => (
                <tr key={w.owner} className="border-t border-line">
                  <th scope="row" className="py-2 text-start font-semibold">
                    {who.ofId(w.owner)}
                  </th>
                  <td className="py-2">{w.open_inquiries}</td>
                  <td className="py-2">{w.open_follow_ups}</td>
                  <td className={`py-2 ${w.overdue_follow_ups ? "font-semibold text-red-700" : ""}`}>{w.overdue_follow_ups}</td>
                  <td className="py-2">{w.prospects}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section id="activity" title={o.sections.activity} count={data.recent_activity.length} empty={o.empty.activity}>
          <RowList label={o.sections.activity}>
            {data.recent_activity.map((a, i) => (
              <li key={`${a.at}-${i}`} className="border-t border-line py-2.5 text-[13.5px] first:border-t-0 first:pt-0">
                <p className="m-0">
                  <span className="font-semibold">{who.ofEmail(a.actor) || a.actor}</span> {t.crm.actions[a.action] ?? a.action.replaceAll("_", " ")}
                  {a.name && a.inquiry_id ? (
                    <>
                      {" · "}
                      <Link href={`/inquiries/${a.inquiry_id}`} className={linkClass}>
                        <bdi>{a.name}</bdi>
                      </Link>
                    </>
                  ) : null}
                </p>
                <p className={`m-0 ${smallMuted}`}>{when(a.at)}</p>
              </li>
            ))}
          </RowList>
        </Section>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import Notice from "@/components/crm/Notice";
import { PageHead, daysBetween, linkClass } from "@/components/crm/parts";
import { MeetingSummary, PackChip } from "@/components/crm/LeadParts";
import { Chip, card, formatDate, formatDay, todayInCairo, type ChipTone } from "@/components/dashboard/ui";
import { teamMembers } from "@/lib/admin/auth/config";
import { requireAdmin } from "@/lib/admin/auth/state";
import { adminText } from "@/lib/admin/locale";
import { people } from "@/lib/admin/people";
import { commandCentre } from "@/lib/crm/data";
import type { CommandCentre } from "@/lib/crm/lead-types";
import { automationStatus } from "@/lib/crm/lead-load";
import { errorLabel } from "@/lib/dashboard/status";
import { ARTIFACTS, packState } from "@/lib/pack/state";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard" };

// Meetings, preparation and client work look different at a glance: a coloured
// edge and a labelled badge (never colour alone).
const KIND: Record<string, { tone: ChipTone; edge: string }> = {
  meeting: { tone: "info", edge: "border-s-sky-500" },
  pack_review: { tone: "warn", edge: "border-s-amber-500" },
  lead: { tone: "neutral", edge: "border-s-ink/30" },
  prospect: { tone: "ok", edge: "border-s-mint-deep" },
};

function Section({ id, title, count, children, wide }: { id: string; title: string; count?: number; children: ReactNode; wide?: boolean }) {
  return (
    <section aria-labelledby={id} className={wide ? "lg:col-span-2" : ""} data-section={id}>
      <h2 id={id} className="m-0 mb-3 flex items-baseline gap-2 text-[17px] font-bold tracking-[-0.01em] rtl:tracking-normal">
        {title}
        {count ? <span className="text-[13px] font-semibold text-ink-faint">{count}</span> : null}
      </h2>
      {children}
    </section>
  );
}

const itemClass = (kind: string) => `${card} border-s-4 ${KIND[kind]?.edge ?? ""} px-4 py-3`;

// The command centre: what needs Omar and Adam today. Every section is hidden
// when it has nothing in it; technical states stay in Settings.
export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const { locale, t } = await adminText();
  const h = t.lead.home;
  const today = todayInCairo();
  const c: CommandCentre = await commandCentre(today);
  const members = teamMembers();
  const who = people(members);
  const sp = await searchParams;
  const auto = automationStatus(c.alerts.automation_paused);
  const weekEnd = new Date(Date.parse(`${today}T00:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10);

  const groups = [
    { key: "overdue", title: h.overdue, rows: c.actions.filter((a) => a.due_on < today) },
    { key: "today", title: h.today, rows: c.actions.filter((a) => a.due_on === today) },
    { key: "week", title: h.thisWeek, rows: c.actions.filter((a) => a.due_on > today && a.due_on <= weekEnd) },
  ].filter((g) => g.rows.length);
  const a = c.alerts;
  const alertCount = (a.unowned_actions.length ? 1 : 0) + a.pack_problems.length + a.automation_paused.length + a.unready_soon.length;
  const workload = c.workload.filter((w) => w.open || w.leads);
  const anything = alertCount || groups.length || c.meetings.length || c.packs_to_review.length || c.awaiting_response.length || c.projects.length;
  const actionHref = (row: CommandCentre["actions"][number]) =>
    row.kind === "prospect" ? `/outreach/${row.id}` : row.kind === "pack_review" ? `/leads/${row.inquiry_id}/pack` : `/leads/${row.inquiry_id}#next`;

  return (
    <>
      <PageHead title={h.title}>
        <p className="m-0 max-w-[52ch] text-[13.5px] text-ink-soft">{h.intro}</p>
      </PageHead>
      <Notice n={sp.n} e={sp.e} t={t.crm} />

      {!anything && <p className={`${card} m-0 p-5 text-[14.5px] text-ink-soft`} data-all-clear>{h.allClear}</p>}

      <div className="grid grid-cols-1 items-start gap-x-6 gap-y-8 lg:grid-cols-2">
        {alertCount > 0 && (
          <Section id="alerts" title={h.alerts} wide>
            <ul className="m-0 flex list-none flex-col gap-2 p-0" data-alerts>
              {a.unowned_actions.length > 0 && (
                <li className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-900" data-alert="unowned">
                  <strong>{h.unowned(a.unowned_actions.length)}</strong>
                  {": "}
                  {a.unowned_actions.map((u, i) => (
                    <span key={u.id}>
                      {i > 0 && ", "}
                      <Link href={`/leads/${u.inquiry_id}#next`} className="font-semibold underline underline-offset-4">
                        <bdi>{u.name}</bdi>
                      </Link>
                    </span>
                  ))}
                </li>
              )}
              {a.unready_soon.map((m) => (
                <li key={m.id} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-amber-950" data-alert="unready">
                  <Link href={`/leads/${m.id}/pack`} className="font-semibold underline underline-offset-4">
                    <bdi>{m.name}</bdi>
                  </Link>
                  {" · "}
                  {h.unreadySoon(formatDate(m.start, true, locale))}
                </li>
              ))}
              {a.pack_problems.map((p) => (
                <li key={p.id} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-amber-950" data-alert="pack">
                  <Link href={`/leads/${p.id}/pack`} className="font-semibold underline underline-offset-4">
                    <bdi>{p.name}</bdi>
                  </Link>
                  {" · "}
                  {h.packProblem}
                </li>
              ))}
              {a.automation_paused.map((p) => (
                <li key={p.provider} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-amber-950" data-alert="automation">
                  {h.automationPaused(p.provider, errorLabel(p.reason, locale))}{" "}
                  <Link href="/settings" className="font-semibold underline underline-offset-4">
                    {t.lead.nav.settings}
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {groups.length > 0 && (
          <Section id="actions" title={h.actions} count={groups.reduce((n, g) => n + g.rows.length, 0)}>
            <div className="flex flex-col gap-4">
              {groups.map((g) => (
                <div key={g.key} data-group={g.key}>
                  <h3 className={`m-0 mb-2 text-[12.5px] font-bold ${g.key === "overdue" ? "text-red-800" : "text-ink-soft"}`}>{g.title}</h3>
                  <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {g.rows.map((row) => (
                      <li key={`${row.kind}-${row.id}`} className={itemClass(row.kind)} data-action-kind={row.kind}>
                        <div className="flex flex-wrap items-center gap-2">
                          <Chip tone={KIND[row.kind].tone}>{h.kinds[row.kind]}</Chip>
                          <Link href={actionHref(row)} className={linkClass}>
                            <bdi>{row.name}</bdi>
                          </Link>
                        </div>
                        <p dir="auto" className="m-0 mt-1 text-[14px]">
                          {row.kind === "pack_review" ? t.lead.common.reviewAction : row.action}
                        </p>
                        <p className="m-0 mt-0.5 flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-soft">
                          {row.owner ? <span className="font-semibold text-ink">{who.ofId(row.owner)}</span> : <Chip tone="attention">{h.noOwner}</Chip>}
                          <span aria-hidden>·</span>
                          <span className={row.due_on < today ? "font-semibold text-red-800" : ""}>{formatDay(row.due_on, locale)}</span>
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Section>
        )}

        {c.meetings.length > 0 && (
          <Section id="meetings" title={h.meetings} count={c.meetings.length}>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {c.meetings.map((m) => (
                <li key={m.id} className={itemClass("meeting")} data-meeting-row={m.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/leads/${m.id}`} className={linkClass}>
                      <bdi>{m.name}</bdi>
                    </Link>
                    <PackChip state={packState({ job: m.job, artifacts: m.artifacts, reviewDue: null, today, automation: auto })} t={t} />
                  </div>
                  <div className="mt-1 text-[14px]">
                    <MeetingSummary status="booked" start={m.start} timezone={m.timezone} uid={m.booking_uid} t={t} locale={locale} />
                  </div>
                  {m.owners.length > 0 && <p className="m-0 mt-1 text-[12.5px] text-ink-soft">{who.ofIds(m.owners, "")}</p>}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {c.packs_to_review.length > 0 && (
          <Section id="packs" title={h.packs} count={c.packs_to_review.length}>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {c.packs_to_review.map((p) => (
                <li key={p.id} className={itemClass("pack_review")}>
                  <Link href={`/leads/${p.id}/pack`} className={linkClass}>
                    <bdi>{p.name}</bdi>
                  </Link>
                  <p className="m-0 mt-1 text-[13px] text-ink-soft">
                    {h.packParts(
                      ARTIFACTS.filter((x) => p.artifacts[x]?.review_status === "in_review")
                        .map((x) => t.lead.artifacts[x])
                        .join(", "),
                    )}
                    {p.meeting_start_at ? ` · ${formatDate(p.meeting_start_at, true, locale)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {c.awaiting_response.length > 0 && (
          <Section id="awaiting" title={h.awaiting} count={c.awaiting_response.length}>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {c.awaiting_response.map((l) => {
                const days = daysBetween(l.created_at, today);
                return (
                  <li key={l.id} className={itemClass("lead")}>
                    <Link href={`/leads/${l.id}`} className={linkClass}>
                      <bdi>{l.name}</bdi>
                    </Link>
                    <p className="m-0 mt-1 text-[12.5px] text-ink-soft">
                      {days === 0 ? h.receivedToday : h.received(t.crm.common.daysAgo(days))}
                      {" · "}
                      {l.owners.length ? who.ofIds(l.owners, "") : t.lead.common.unassigned}
                    </p>
                  </li>
                );
              })}
            </ul>
          </Section>
        )}

        {workload.length > 0 && (
          <Section id="workload" title={h.workload}>
            <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
              {workload.map((w) => (
                <li key={w.owner} className={`${card} px-4 py-3`} data-workload={w.owner}>
                  <p className="m-0 text-[15px] font-bold">{who.ofId(w.owner)}</p>
                  <p className={`m-0 mt-0.5 text-[13px] ${w.overdue ? "text-red-800" : "text-ink-soft"}`}>{h.workloadLine(w.open, w.overdue, w.leads)}</p>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {c.projects.length > 0 && (
          <Section id="projects" title={h.projects} count={c.projects.length}>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {c.projects.map((p) => (
                <li key={p.id} className={`${card} flex flex-wrap items-center justify-between gap-2 px-4 py-3`}>
                  <Link href={`/projects/${p.id}`} className={linkClass}>
                    <bdi>{p.name}</bdi>
                  </Link>
                  <span className="flex items-center gap-2 text-[12.5px] text-ink-soft">
                    <Chip>{t.crm.projectStatuses[p.status as keyof typeof t.crm.projectStatuses] ?? p.status}</Chip>
                    {who.ofIds(p.owners, t.lead.common.unassigned)}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {c.campaign.active_prospects + c.campaign.touches_7d + c.campaign.replies_7d > 0 && (
          <Section id="campaign" title={h.campaign}>
            <div className={`${card} px-4 py-3`}>
              <dl className="m-0 flex flex-wrap gap-x-6 gap-y-2 text-[13.5px]" data-campaign>
                {(["active_prospects", "touches_7d", "replies_7d", "inquiries_30d"] as const).map((k) => (
                  <div key={k} className="flex items-baseline gap-1.5">
                    <dt className="text-ink-soft">{h.numbers[k]}</dt>
                    <dd className="m-0 font-bold">{c.campaign[k]}</dd>
                  </div>
                ))}
              </dl>
              <Link href="/growth" className={`${linkClass} mt-2 inline-block text-[13.5px]`}>
                {h.openGrowth}
              </Link>
            </div>
          </Section>
        )}
      </div>
    </>
  );
}

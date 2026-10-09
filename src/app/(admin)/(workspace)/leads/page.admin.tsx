import type { Metadata } from "next";
import Link from "next/link";
import { Chip, button, card, field, formatDay, primary, todayInCairo } from "@/components/dashboard/ui";
import { PageHead, Empty } from "@/components/crm/parts";
import { MeetingSummary, PackChip, PausedChip, PositionChip, PriorityChip } from "@/components/crm/LeadParts";
import { requireAdmin } from "@/lib/admin/auth/state";
import { teamMembers } from "@/lib/admin/auth/config";
import { adminText } from "@/lib/admin/locale";
import { people } from "@/lib/admin/people";
import { automationPaused, leadList } from "@/lib/crm/data";
import { automationStatus } from "@/lib/crm/lead-load";
import { PRIORITIES, leadFiltersSchema } from "@/lib/crm/schemas";
import { BOARD_COLUMNS, dbStagesOf } from "@/lib/crm/simple-stages";
import { clientProjectType } from "@/lib/dashboard/project-type";
import { excerpt, label, labelsFor } from "@/lib/dashboard/status";
import { packState } from "@/lib/pack/state";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Leads & Clients" };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const raw = await searchParams;
  const f = leadFiltersSchema.parse({ q: raw.q ?? "", owner: raw.owner ?? "", stage: raw.stage ?? "", priority: raw.priority ?? "", paused: raw.paused ?? "" });
  const { locale, t } = await adminText();
  const l = t.lead.list;
  const L = labelsFor(locale);
  const members = teamMembers();
  const who = people(members);
  const today = todayInCairo();
  const [paused, rows] = await Promise.all([
    automationPaused(),
    leadList({
      q: f.q || undefined,
      owner: f.owner || undefined,
      stages: f.stage ? dbStagesOf(f.stage) : undefined,
      priority: f.priority || undefined,
      paused: f.paused || undefined,
    }),
  ]);
  const auto = automationStatus(paused);
  const filtered = Boolean(f.q || f.owner || f.stage || f.priority || f.paused);

  return (
    <>
      <PageHead title={l.title} />
      <p className="mt-[-12px] mb-5 max-w-[70ch] text-[14px] text-ink-soft">{l.intro}</p>

      <form method="get" role="search" aria-label={l.filters} className={`${card} mb-5 grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto]`}>
        <div className="flex flex-col gap-1">
          <label htmlFor="lead-q" className="text-[12.5px] font-semibold">
            {l.search}
          </label>
          <input id="lead-q" name="q" type="search" maxLength={120} dir="auto" defaultValue={f.q} placeholder={l.searchPlaceholder} className={field} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="lead-owner" className="text-[12.5px] font-semibold">
            {l.owner}
          </label>
          <select id="lead-owner" name="owner" defaultValue={f.owner} className={field}>
            <option value="">{l.everyone}</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
            <option value="unassigned">{t.lead.common.unassigned}</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="lead-stage" className="text-[12.5px] font-semibold">
            {l.position}
          </label>
          <select id="lead-stage" name="stage" defaultValue={f.stage} className={field}>
            <option value="">{l.allPositions}</option>
            {BOARD_COLUMNS.map((s) => (
              <option key={s} value={s}>
                {t.lead.positions[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="lead-priority" className="text-[12.5px] font-semibold">
            {l.priority}
          </label>
          <select id="lead-priority" name="priority" defaultValue={f.priority} className={field}>
            <option value="">{l.anyPriority}</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {t.lead.priorities[p]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="lead-paused" className="text-[12.5px] font-semibold">
            {l.paused}
          </label>
          <select id="lead-paused" name="paused" defaultValue={f.paused} className={field}>
            <option value="">{l.any}</option>
            <option value="no">{l.pausedNo}</option>
            <option value="yes">{l.pausedYes}</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className={primary}>
            {l.apply}
          </button>
          {filtered && (
            <Link href="/leads" className={button}>
              {l.clear}
            </Link>
          )}
        </div>
      </form>

      <p className="m-0 mb-3 text-[13px] text-ink-soft" aria-live="polite" data-lead-count={rows.length}>
        {l.showing(rows.length)}
      </p>

      {rows.length === 0 ? (
        <Empty>{filtered ? l.empty : l.none}</Empty>
      ) : (
        <ul aria-label={l.title} className="m-0 flex list-none flex-col gap-3 p-0" data-leads>
          {rows.map((r) => {
            const state = packState({ job: r.pack.job, artifacts: r.pack.artifacts, reviewDue: r.pack.review_due, today, automation: auto });
            const next = r.next_action;
            return (
              <li key={r.id} className={`${card} relative p-4 sm:p-5`} data-lead={r.id}>
                <dl className="m-0 grid grid-cols-1 gap-x-5 gap-y-3 text-[14px] sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="min-w-0 sm:col-span-2 lg:col-span-1">
                    <dt className="sr-only">{l.columns.client}</dt>
                    <dd className="m-0">
                      <Link href={`/leads/${r.id}`} className="text-[16px] font-bold text-ink after:absolute after:inset-0 after:content-[''] hover:underline" data-lead-link>
                        <bdi>{r.company_name || r.client_name}</bdi>
                      </Link>
                      {r.company_name && (
                        <span className="block text-[13px] text-ink-soft">
                          <bdi>{r.client_name}</bdi>
                        </span>
                      )}
                      <span className="mt-1 block text-[13px] text-ink-soft">
                        {label(L.projectType, clientProjectType(r.project_type), t.lead.common.notProvided)}
                        {" · "}
                        <span dir="auto">{excerpt(r.summary, 90)}</span>
                      </span>
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[12px] font-semibold text-ink-faint">{l.columns.meeting}</dt>
                    <dd className="m-0 mt-0.5">
                      <MeetingSummary status={r.booking_status} start={r.meeting_start_at} timezone={null} uid={null} t={t} locale={locale} compact />
                    </dd>
                    <dt className="mt-2 text-[12px] font-semibold text-ink-faint">{l.columns.pack}</dt>
                    <dd className="m-0 mt-0.5">
                      <PackChip state={state} waiting={r.pack.job === "waiting_booking"} t={t} />
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[12px] font-semibold text-ink-faint">{l.columns.position}</dt>
                    <dd className="m-0 mt-0.5 flex flex-wrap gap-1.5">
                      <PositionChip stage={r.lead_status} t={t} />
                      <PriorityChip priority={r.priority} t={t} />
                      <PausedChip until={r.paused_until} t={t} locale={locale} />
                      {r.project_id && <Chip tone="ok">{l.project}</Chip>}
                    </dd>
                    <dt className="mt-2 text-[12px] font-semibold text-ink-faint">{l.columns.owner}</dt>
                    <dd className="m-0 mt-0.5" data-owners>
                      {r.owners.length ? who.ofIds(r.owners, "") : <span className="text-ink-faint">{t.lead.common.unassigned}</span>}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[12px] font-semibold text-ink-faint">{l.columns.next}</dt>
                    <dd className="m-0 mt-0.5" data-next-action>
                      {next ? (
                        <>
                          <span dir="auto" className="block font-medium">
                            {next.kind === "pack_review" ? t.lead.common.reviewAction : next.action}
                          </span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-soft">
                            {next.owner ? <span className="font-semibold text-ink">{who.ofId(next.owner)}</span> : <Chip tone="attention">{t.lead.common.needsOwner}</Chip>}
                            {next.due_on < today ? (
                              <Chip tone="attention">
                                {t.lead.common.overdue} · {formatDay(next.due_on, locale)}
                              </Chip>
                            ) : next.due_on === today ? (
                              <Chip tone="warn">{t.lead.common.today}</Chip>
                            ) : (
                              <span>{formatDay(next.due_on, locale)}</span>
                            )}
                          </span>
                        </>
                      ) : (
                        <span className="text-ink-faint">{t.lead.common.noNextAction}</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

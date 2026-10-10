import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import SubmitButton from "@/components/dashboard/SubmitButton";
import { Chip, button, card, eyebrow, field, formatDate, formatDay, primary, todayInCairo } from "@/components/dashboard/ui";
import Notice from "@/components/crm/Notice";
import { Panel, linkClass } from "@/components/crm/parts";
import { SelectField, TextField } from "@/components/crm/Fields";
import { LinkPanel, SourcePanel } from "@/components/crm/InquiryCrm";
import { MeetingSummary, PackChip } from "@/components/crm/LeadParts";
import { requireAdmin } from "@/lib/admin/auth/state";
import { ownerChoices, ownersLabel, teamMembers } from "@/lib/admin/auth/config";
import { adminText } from "@/lib/admin/locale";
import { people } from "@/lib/admin/people";
import { companyList } from "@/lib/crm/data";
import { automationStatus, isLeadId, loadExtra, loadInquiry, loadLead } from "@/lib/crm/lead-load";
import { leadPath } from "@/lib/crm/lead-path";
import { safeHref, PRIORITIES } from "@/lib/crm/schemas";
import { SIMPLE_STAGES, simpleStage } from "@/lib/crm/simple-stages";
import { LOSS_REASONS } from "@/lib/crm/types";
import { budgetLabel, timelineLabel } from "@/lib/form-options";
import { clientProjectType } from "@/lib/dashboard/project-type";
import { label, labelsFor } from "@/lib/dashboard/status";
import { packState } from "@/lib/pack/state";
import { addFollowUpAction, addNoteAction, completeFollowUpAction } from "../../inquiries/actions";
import { setOwnersAction } from "../../inquiries/crm-actions";
import { assignActionAction, pauseAction, setPositionAction, setPriorityAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Lead" };

const summaryClass = "flex cursor-pointer list-none items-center gap-2 text-[15px] font-semibold [&::-webkit-details-marker]:hidden";

function Hidden({ values }: { values: Record<string, string> }) {
  return (
    <>
      {Object.entries(values).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </>
  );
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-ink-soft">{term}</dt>
      <dd className="m-0 font-medium">{children}</dd>
    </div>
  );
}

export default async function LeadOverview({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const { id } = await params;
  if (!isLeadId(id)) notFound();
  const [detail, extra, lead, companies] = await Promise.all([loadInquiry(id), loadExtra(id), loadLead(id), companyList()]);
  if (!detail || !extra || !lead) notFound();
  const sp = await searchParams;
  const { locale, t } = await adminText();
  const o = t.lead.detail.overview;
  const L = labelsFor(locale);
  const members = teamMembers();
  const who = people(members);
  const today = todayInCairo();
  const { inquiry: i, meeting } = detail;
  const open = detail.follow_ups.filter((f) => !f.done_at);
  const done = detail.follow_ups.filter((f) => f.done_at);
  const position = simpleStage(extra.stage);
  const link = safeHref(i.company_url);
  const auto = automationStatus(detail.automation);
  const state = packState({ job: detail.preparation?.status ?? null, artifacts: lead.pack_latest, reviewDue: lead.review_action?.due_on ?? null, today, automation: auto });

  return (
    <>
      <Notice n={sp.n} e={sp.e} t={t.crm} />
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <Panel title={o.client} id="client">
            <h3 className={eyebrow}>{o.idea}</h3>
            <div dir="auto" className="mt-2 mb-5 rounded-xl border-s-4 border-mint bg-canvas p-4 text-[15px] leading-[1.8] whitespace-pre-wrap" data-brief="description">
              {i.project_description}
            </div>
            <dl className="m-0 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-2 text-[14px]" data-brief="provided">
              <Fact term={o.type}>{label(L.projectType, clientProjectType(i.project_type), t.lead.common.notProvided)}</Fact>
              <Fact term={o.budget}>
                <span data-budget>{budgetLabel(i.budget_range, lead.budget_currency, locale) ?? t.lead.common.notProvided}</span>
              </Fact>
              <Fact term={o.timeline}>
                <span data-timeline>{timelineLabel(i.timeline, locale) ?? t.lead.common.notProvided}</span>
              </Fact>
              <Fact term={o.link}>
                {i.company_url ? (
                  <span className="flex flex-col gap-0.5">
                    {link ? (
                      <a href={link} target="_blank" rel="noopener noreferrer nofollow" dir="ltr" className={`${linkClass} break-all`} data-existing-link>
                        {i.company_url}
                      </a>
                    ) : (
                      <span dir="ltr" className="break-all">
                        {i.company_url}
                      </span>
                    )}
                    <span className="text-[12px] font-normal text-ink-faint">{o.linkNote}</span>
                  </span>
                ) : (
                  t.lead.common.notProvided
                )}
              </Fact>
              {i.country && <Fact term={o.country}>{i.country}</Fact>}
              <Fact term={o.language}>{t.languages[i.language] ?? i.language}</Fact>
            </dl>
          </Panel>

          <Panel title={o.meeting} id="meeting" aside={<PackChip state={state} waiting={detail.preparation?.status === "waiting_booking"} t={t} />}>
            <div className="flex flex-wrap items-start justify-between gap-4 text-[14px]">
              <MeetingSummary status={meeting.booking_status} start={meeting.meeting_start_at} timezone={meeting.meeting_timezone} uid={meeting.cal_booking_id} t={t} locale={locale} />
              <Link href={leadPath(id, "pack")} className={button}>
                {t.lead.detail.tabs.pack}
              </Link>
            </div>
          </Panel>

          <Panel title={o.communication} id="communication" aside={detail.notes.length ? <span className="text-[12.5px] text-ink-faint">{detail.notes.length}</span> : null}>
            <p className="mt-0 mb-3 text-[13px] text-ink-soft">{o.communicationHelp}</p>
            <form action={addNoteAction} className="flex flex-col gap-2">
              <Hidden values={{ inquiryId: id }} />
              <label htmlFor="note" className="sr-only">
                {o.communication}
              </label>
              <textarea id="note" name="body" rows={3} required maxLength={4000} dir="auto" className={field} />
              <SubmitButton className={`${button} self-start`}>{t.detail.notes.add}</SubmitButton>
            </form>
            {detail.notes.length > 0 && (
              <ul className="mt-4 mb-0 list-none p-0" data-notes>
                {detail.notes.map((n) => (
                  <li key={n.id} className="border-t border-line py-3 text-[14px]">
                    <div className="mb-1 text-[12.5px] text-ink-faint">
                      <span className="font-semibold text-ink-soft">{who.ofEmail(n.author)}</span> · {formatDate(n.created_at, true, locale)}
                    </div>
                    <div dir="auto" className="leading-relaxed whitespace-pre-wrap">
                      {n.body}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          <Panel title={o.position} id="position">
            <p className="mt-0 mb-3 text-[13px] text-ink-soft">{o.positionHelp}</p>
            <form action={setPositionAction} className="flex flex-col gap-3">
              <Hidden values={{ inquiryId: id }} />
              <SelectField id="position-select" name="position" text={o.change} defaultValue={position} options={SIMPLE_STAGES.map((s) => ({ value: s, label: t.lead.positions[s] }))} required />
              <SelectField id="position-reason" name="reason" text={o.lossReason} blank={o.chooseReason} defaultValue={extra.qualification.loss_reason} options={LOSS_REASONS.map((v) => ({ value: v, label: t.crm.lossReasons[v] }))} />
              <TextField id="position-note" name="note" text={o.note} placeholder={o.notePlaceholder} maxLength={500} defaultValue={extra.qualification.loss_note} />
              <SubmitButton className={`${primary} self-start`}>{o.savePosition}</SubmitButton>
            </form>

            <form action={setPriorityAction} className="mt-5 flex flex-wrap items-end gap-3 border-t border-line pt-4">
              <Hidden values={{ inquiryId: id }} />
              <div className="min-w-[10rem] flex-1">
                <SelectField id="priority-select" name="priority" text={o.priority} hint={o.priorityHelp} blank={t.lead.noPriority} defaultValue={lead.priority} options={PRIORITIES.map((p) => ({ value: p, label: t.lead.priorities[p] }))} />
              </div>
              <SubmitButton className={button}>{o.savePriority}</SubmitButton>
            </form>

            <div className="mt-5 border-t border-line pt-4" data-pause>
              <h3 className="m-0 text-[14px] font-semibold">{o.pause}</h3>
              <p className="mt-1 mb-3 text-[12.5px] text-ink-faint">{o.pauseHelp}</p>
              {lead.paused_until ? (
                <form action={pauseAction} className="flex flex-wrap items-center gap-3">
                  <Hidden values={{ inquiryId: id, resume: "1" }} />
                  <Chip>{t.lead.common.pausedUntil(formatDay(lead.paused_until, locale))}</Chip>
                  <SubmitButton className={button}>{o.resume}</SubmitButton>
                </form>
              ) : (
                <form action={pauseAction} className="flex flex-wrap items-end gap-3">
                  <Hidden values={{ inquiryId: id }} />
                  <div className="min-w-[10rem] flex-1">
                    <TextField id="pause-until" name="pausedUntil" type="date" text={o.pauseUntil} min={today} />
                  </div>
                  <SubmitButton className={button}>{o.pauseSave}</SubmitButton>
                </form>
              )}
            </div>
          </Panel>

          <Panel title={o.owner} id="owner" aside={<span className="text-[13px] font-semibold" data-owners>{ownersLabel(i.owners, members, t.lead.common.unassigned)}</span>}>
            <form action={setOwnersAction} className="flex flex-col gap-3">
              <Hidden values={{ inquiryId: id }} />
              <SelectField
                id="owner-select"
                name="owners"
                text={o.owner}
                hint={o.ownerHelp}
                blank={t.lead.common.unassigned}
                defaultValue={[...i.owners].sort().join(",")}
                options={ownerChoices(members)}
              />
              <SubmitButton className={`${button} self-start`}>{o.saveOwner}</SubmitButton>
            </form>
          </Panel>

          <Panel title={o.next} id="next" aside={open.length ? <span className="text-[12.5px] text-ink-faint">{open.length}</span> : null}>
            <p className="mt-0 mb-3 text-[13px] text-ink-soft">{o.nextHelp}</p>
            {open.length > 0 ? (
              <ul className="m-0 mb-4 list-none p-0" data-follow-ups>
                {open.map((f) => {
                  const kind = f.kind;
                  return (
                    <li key={f.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-line py-3 first:pt-0" data-follow-up={f.action} data-kind={kind ?? "manual"}>
                      <div className="min-w-0">
                        <p dir="auto" className="m-0 text-[14px] font-medium">
                          {kind === "pack_review" ? t.lead.common.reviewAction : f.action}
                        </p>
                        <p className="m-0 mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-soft">
                          {f.owner ? <span className="font-semibold text-ink">{who.ofId(f.owner)}</span> : <Chip tone="attention">{t.lead.common.needsOwner}</Chip>}
                          <span aria-hidden>·</span>
                          {f.due_on < today ? (
                            <Chip tone="attention">
                              {t.lead.common.overdue} · {formatDay(f.due_on, locale)}
                            </Chip>
                          ) : f.due_on === today ? (
                            <Chip tone="warn">{t.lead.common.today}</Chip>
                          ) : (
                            <span>{t.lead.common.due(formatDay(f.due_on, locale))}</span>
                          )}
                        </p>
                        {!f.owner && (
                          <form action={assignActionAction} className="mt-2 flex flex-wrap items-center gap-2">
                            <Hidden values={{ inquiryId: id, followUpId: f.id }} />
                            <label htmlFor={`assign-${f.id}`} className="sr-only">
                              {t.detail.followUps.responsible}
                            </label>
                            <select id={`assign-${f.id}`} name="owner" required defaultValue="" className={`${field} w-auto py-1.5 text-[13px]`}>
                              <option value="" disabled>
                                {t.detail.followUps.choose}
                              </option>
                              {members.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name}
                                </option>
                              ))}
                            </select>
                            <SubmitButton className={`${button} px-3 py-1.5 text-[12.5px]`}>{t.lead.common.save}</SubmitButton>
                          </form>
                        )}
                      </div>
                      {kind !== "pack_review" && (
                        <form action={completeFollowUpAction} className="flex-none">
                          <Hidden values={{ inquiryId: id, followUpId: f.id }} />
                          <SubmitButton className={`${button} px-3 py-1.5 text-[12.5px]`}>{t.detail.followUps.done}</SubmitButton>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-0 mb-4 text-[13px] text-ink-faint">{t.lead.common.noNextAction}</p>
            )}
            <form action={addFollowUpAction} className="flex flex-col gap-3 rounded-xl bg-surface-2/60 p-3.5">
              <Hidden values={{ inquiryId: id }} />
              <TextField id="follow-up-action" name="action" text={t.detail.followUps.action} placeholder={t.detail.followUps.placeholder} maxLength={500} required />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <SelectField id="follow-up-owner" name="owner" text={t.detail.followUps.responsible} blank={t.detail.followUps.choose} required options={members.map((m) => ({ value: m.id, label: m.name }))} />
                <TextField id="follow-up-due" name="dueOn" type="date" text={t.detail.followUps.due} required min={today} />
              </div>
              <SubmitButton className={`${primary} self-start`}>{t.detail.followUps.add}</SubmitButton>
            </form>
            {done.length > 0 && (
              <details className="group mt-4 border-t border-line pt-3">
                <summary className={`${summaryClass} text-[14px]`}>{t.detail.followUps.completed(done.length)}</summary>
                <ul className="mt-2 mb-0 list-none p-0 text-[13px]">
                  {done.map((f) => (
                    <li key={f.id} className="border-t border-line py-2 first:border-t-0">
                      <span dir="auto" className="line-through decoration-ink/30">
                        {f.action}
                      </span>
                      <span className="block text-[12px] text-ink-faint">
                        {f.owner ? `${who.ofId(f.owner)} · ` : ""}
                        {t.detail.followUps.doneBy(f.done_by === "system" ? "Mintapp" : who.ofEmail(f.done_by), formatDate(f.done_at!, true, locale))}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Panel>

          <details className={`group ${card} p-5 sm:p-6`} data-contact>
            <summary className={summaryClass}>{o.contact}</summary>
            <p className="mt-2 text-[13px] text-ink-soft">{o.contactNote}</p>
            <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[14px]">
              <dt className="text-ink-soft">{t.detail.contact.email}</dt>
              <dd className="m-0 break-words" dir="ltr">
                {i.email}
              </dd>
              {i.phone && (
                <>
                  <dt className="text-ink-soft">{t.detail.contact.phone}</dt>
                  <dd className="m-0" dir="ltr">
                    {i.phone}
                  </dd>
                </>
              )}
            </dl>
          </details>
        </div>
      </div>

      <details className={`group ${card} mt-5 p-5 sm:p-6`} data-advanced>
        <summary className={summaryClass}>{o.advanced}</summary>
        <p className="mt-2 mb-4 text-[13px] text-ink-soft">{o.advancedHelp}</p>
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
          <SourcePanel inquiryId={id} extra={extra} t={t} />
          <LinkPanel inquiryId={id} extra={extra} t={t} companies={companies} hasCompanyName={Boolean(i.company_name)} />
        </div>
      </details>
    </>
  );
}

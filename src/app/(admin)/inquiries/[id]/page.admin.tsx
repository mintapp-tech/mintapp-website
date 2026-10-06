import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import CopyButton from "@/components/dashboard/CopyButton";
import DraftBody from "@/components/dashboard/DraftBody";
import SubmitButton from "@/components/dashboard/SubmitButton";
import { Chip, MEETING_TONES, REVIEW_TONES, button, card, eyebrow, field, formatDate, formatDay, primary, todayInCairo } from "@/components/dashboard/ui";
import { requireAdmin } from "@/lib/admin/auth/state";
import { ownerChoices, ownersLabel, teamMembers } from "@/lib/admin/auth/config";
import { adminText } from "@/lib/admin/locale";
import { getInquiry } from "@/lib/dashboard/data";
import { clientProjectType } from "@/lib/dashboard/project-type";
import { claudePrompt, draftText, structuredBrief, unstatedFigures } from "@/lib/dashboard/brief";
import { label, labelsFor, preparationNotice } from "@/lib/dashboard/status";
import { isLocalDashboardDemo } from "@/lib/sql-gateway";
import { selectGenerator } from "@/lib/preparation/config";
import {
  addNoteAction,
  addFollowUpAction,
  completeFollowUpAction,
  setOwnersAction,
  demoBookingAction,
  demoGenerateAction,
  markManualAction,
  prepareNowAction,
  resumeAutomationAction,
  retryAction,
  reviewAction,
  saveDraftAction,
} from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Inquiry" };

const NOTICE_STYLES = {
  attention: { box: "border-red-200 bg-red-50", dot: "bg-red-600" },
  info: { box: "border-sky-200 bg-sky-50", dot: "bg-sky-600" },
  ok: { box: "border-mint/50 bg-mint-soft", dot: "bg-mint-deep" },
} as const;

const summary = "flex cursor-pointer list-none items-center gap-2 text-[14px] font-semibold [&::-webkit-details-marker]:hidden";
const Chevron = () => (
  <svg aria-hidden viewBox="0 0 16 16" className="size-3.5 flex-none transition-transform ltr:group-open:rotate-90 rtl:-scale-x-100 rtl:group-open:-rotate-90">
    <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function Section({ title, id, children, aside }: { title: string; id: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section aria-labelledby={id} className={`${card} p-5 sm:p-6`}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id} className="m-0 text-[17px] font-bold tracking-[-0.01em] rtl:tracking-normal">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Hidden({ inquiryId, extra }: { inquiryId: string; extra?: Record<string, string | number> }) {
  return (
    <>
      <input type="hidden" name="inquiryId" value={inquiryId} />
      {Object.entries(extra ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={String(v)} />
      ))}
    </>
  );
}

export default async function InquiryPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detail = await getInquiry(id);
  if (!detail) notFound();

  const { locale, t } = await adminText();
  const L = labelsFor(locale);
  const d = t.detail;
  const when = (iso: string) => formatDate(iso, true, locale);
  const { inquiry, meeting, preparation, drafts, notes } = detail;
  const members = teamMembers();
  // People are shown by name; an unknown sign-in (a former member) by its local part only.
  const nameOf = (email: string | null) => (email ? (members.find((m) => m.email === email)?.name ?? email.split("@")[0]) : "");
  const memberName = (memberId: string) => ownersLabel([memberId], members, memberId);
  const today = todayInCairo();
  const openFollowUps = detail.follow_ups.filter((f) => !f.done_at);
  const doneFollowUps = detail.follow_ups.filter((f) => f.done_at);
  const ownersValue = [...inquiry.owners].sort().join(",");
  const generator = selectGenerator();
  const demo = isLocalDashboardDemo();
  const prepNotice = preparationNotice(preparation, { enabled: generator.enabled, provider: generator.enabled ? generator.generator.id : undefined, paused: detail.automation }, locale);
  const brief = structuredBrief({
    preferred_language: inquiry.language,
    project_type: inquiry.project_type,
    project_description: inquiry.project_description,
    budget_range: inquiry.budget_range,
    timeline: inquiry.timeline,
    country: inquiry.country,
  });
  const latest = drafts[0] ?? null;
  const latestText = latest ? draftText(latest.content) : "";
  const figures = latest && latest.source !== "mock" ? unstatedFigures(latestText, brief.text) : [];
  const approved = drafts.find((x) => x.review_status === "approved");
  // Once a version is approved, preparation is done: say so instead of the job's state.
  const notice = approved ? { tone: "ok" as const, title: d.approvedNotice.title, detail: d.approvedNotice.detail(approved.version) } : prepNotice;
  const waiting = preparation && ["queued", "retry_scheduled"].includes(preparation.status);
  const stuck = preparation && ["failed", "paused"].includes(preparation.status);
  const tone = NOTICE_STYLES[notice.tone];
  const versionShort = t.list.versionShort;

  const facts: [string, ReactNode, string | null][] = [
    [
      d.facts.meeting,
      <Chip key="m" tone={MEETING_TONES[meeting.booking_status] ?? "neutral"} data-status="meeting">
        {label(L.meeting, meeting.booking_status)}
      </Chip>,
      meeting.meeting_start_at && meeting.booking_status !== "not_booked" ? when(meeting.meeting_start_at) : null,
    ],
    [
      d.facts.preparation,
      <span key="p" data-status="preparation">
        {label(L.preparation, preparation?.status, d.none)}
      </span>,
      preparation?.generator && preparation.status !== "manual" ? d.via(preparation.generator) : null,
    ],
    [d.facts.review, approved ? t.list.approved(approved.version) : latest ? `${L.review[latest.review_status]} · ${versionShort(latest.version)}` : t.list.noDraft, null],
    [d.facts.lead, label(L.lead, inquiry.lead_status), null],
  ];

  return (
    <>
      <Link href="/inquiries" className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-soft hover:text-ink">
        <span aria-hidden className="rtl:-scale-x-100">←</span> {t.common.allInquiries}
      </Link>

      <header className="mt-4 mb-6">
        <p className={eyebrow}>
          {d.typeLabel}: {label(L.projectType, clientProjectType(inquiry.project_type), d.notProvided)} · {t.languages[inquiry.language] ?? inquiry.language}
        </p>
        <h1 className="m-0 mt-1.5 text-[26px] leading-tight font-bold tracking-[-0.02em] sm:text-[32px] rtl:tracking-normal">
          <bdi>{inquiry.client_name}</bdi>
          {inquiry.company_name ? (
            <span className="font-semibold text-ink-soft">
              {" · "}
              <bdi>{inquiry.company_name}</bdi>
            </span>
          ) : null}
        </h1>
        <p className="mt-1.5 mb-0 text-[13.5px] text-ink-soft">{d.received(when(inquiry.created_at))}</p>
      </header>

      <dl className={`${card} mb-5 grid grid-cols-2 gap-px overflow-hidden bg-line sm:grid-cols-4`}>
        {facts.map(([title, value, sub]) => (
          <div key={title} className="flex flex-col-reverse justify-end bg-surface px-4 py-3.5 sm:px-5">
            <dd className="m-0 mt-1.5 text-[15px] font-semibold">
              {value}
              {sub && <span className="mt-1 block text-[12.5px] font-normal text-ink-soft">{sub}</span>}
            </dd>
            <dt className={eyebrow}>{title}</dt>
          </div>
        ))}
      </dl>

      <div role="status" data-tone={notice.tone} className={`mb-6 rounded-2xl border p-4 sm:p-5 ${tone.box}`}>
        <div className="flex gap-3">
          <span aria-hidden className={`mt-1.5 size-2.5 flex-none rounded-full ${tone.dot}`} />
          <div className="min-w-0">
            <p className="m-0 text-[15px] font-semibold">{notice.title}</p>
            <p className="m-0 mt-1 text-[14px] leading-relaxed">{notice.detail}</p>
            {(waiting || stuck || detail.automation.length > 0) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {generator.enabled && waiting && (
                  <form action={prepareNowAction}>
                    <Hidden inquiryId={id} />
                    <SubmitButton className={primary}>{d.prepareNow(generator.generator.id)}</SubmitButton>
                  </form>
                )}
                {stuck && (
                  <form action={retryAction}>
                    <Hidden inquiryId={id} />
                    <SubmitButton className={button}>{d.retry}</SubmitButton>
                  </form>
                )}
                {(waiting || stuck) && (
                  <form action={markManualAction}>
                    <Hidden inquiryId={id} />
                    <SubmitButton className={button}>{d.manual}</SubmitButton>
                  </form>
                )}
                {detail.automation.map((p) => (
                  <form key={p.provider} action={resumeAutomationAction}>
                    <Hidden inquiryId={id} extra={{ provider: p.provider }} />
                    <SubmitButton className={button}>{d.resume(p.provider)}</SubmitButton>
                  </form>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <Section title={d.brief.title} id="brief">
            <h3 className={eyebrow}>{d.brief.provided}</h3>
            <dl className="mt-2 mb-5 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[14px]" data-brief="provided">
              {brief.provided.map((p) => (
                <div key={p.label} className="contents">
                  <dt className="text-ink-soft">{L.briefField[p.label] ?? p.label}</dt>
                  <dd className="m-0 font-medium">
                    <bdi>{p.label === "Project type" ? label(L.projectType, p.value) : p.value}</bdi>
                  </dd>
                </div>
              ))}
            </dl>
            <h3 className={eyebrow}>{d.brief.words}</h3>
            <div dir="auto" className="mt-2 rounded-xl border-s-4 border-mint bg-canvas p-4 text-[15px] leading-[1.8] whitespace-pre-wrap" data-brief="description">
              {brief.description}
            </div>
            <h3 className={`${eyebrow} mt-5`}>{d.brief.missing}</h3>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[14px]" data-brief="missing">
              {brief.missing.length ? (
                brief.missing.map((m) => (
                  <Chip key={m} tone="warn">
                    {L.briefField[m] ?? m}
                  </Chip>
                ))
              ) : (
                <span className="text-ink-soft">{d.brief.nothingMissing}</span>
              )}
            </div>

            <div className="mt-6 rounded-xl bg-surface-2/70 p-4">
              <p className="m-0 text-[14px] font-semibold">{d.brief.prepareTitle}</p>
              <ol className="mt-2 mb-3 list-decimal ps-5 text-[13.5px] leading-relaxed text-ink-soft">
                {d.brief.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <CopyButton text={claudePrompt(brief)} label={d.brief.copy} copied={d.brief.copied} failed={d.brief.copyFailed} />
            </div>
          </Section>

          <Section title={d.draft.title} id="draft" aside={approved && approved.version !== latest?.version ? <Chip tone="ok">{d.draft.approvedVersion(approved.version)}</Chip> : null}>
            {latest ? (
              <article data-draft-version={latest.version}>
                <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px]">
                  <Chip>{d.draft.version(latest.version)}</Chip>
                  <Chip tone={REVIEW_TONES[latest.review_status] ?? "neutral"} data-review={latest.review_status}>
                    {L.review[latest.review_status]}
                  </Chip>
                  <span className="text-ink-soft">
                    {d.draft.sources[latest.source] ?? latest.source} · {nameOf(latest.created_by)} · {when(latest.created_at)}
                  </span>
                </div>
                <DraftBody text={latestText} />
                {figures.length > 0 && <p className="mt-3 mb-0 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13.5px] text-amber-900">{d.draft.checkFigures(figures.join(", "))}</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  {latest.review_status === "draft" && (
                    <form action={reviewAction}>
                      <Hidden inquiryId={id} extra={{ version: latest.version, to: "in_review" }} />
                      <SubmitButton className={primary}>{d.draft.markReady}</SubmitButton>
                    </form>
                  )}
                  {latest.review_status === "in_review" && (
                    <>
                      <form action={reviewAction}>
                        <Hidden inquiryId={id} extra={{ version: latest.version, to: "approved" }} />
                        <SubmitButton className={primary}>{d.draft.approve}</SubmitButton>
                      </form>
                      <form action={reviewAction}>
                        <Hidden inquiryId={id} extra={{ version: latest.version, to: "draft" }} />
                        <SubmitButton className={button}>{d.draft.sendBack}</SubmitButton>
                      </form>
                    </>
                  )}
                  {latest.review_status === "approved" && (
                    <form action={reviewAction}>
                      <Hidden inquiryId={id} extra={{ version: latest.version, to: "draft" }} />
                      <SubmitButton className={button}>{d.draft.withdraw}</SubmitButton>
                    </form>
                  )}
                </div>
                {latest.reviewed_by && <p className="mt-2 mb-0 text-[13px] text-ink-soft">{d.draft.lastReview(nameOf(latest.reviewed_by), when(latest.reviewed_at!))}</p>}
              </article>
            ) : (
              <p className="m-0 rounded-xl border border-dashed border-ink/20 p-4 text-[14px] text-ink-soft">{generator.enabled ? d.draft.noneAutomated : d.draft.none}</p>
            )}

            <details className="group mt-5 border-t border-line pt-4" open={!latest}>
              <summary className={summary}>
                <Chevron />
                {d.draft.paste}
              </summary>
              <form action={saveDraftAction} className="mt-3 flex flex-col gap-2">
                <Hidden inquiryId={id} extra={{ source: "manual" }} />
                <label htmlFor="paste-draft" className="text-[13px] text-ink-soft">
                  {d.draft.pasteHelp}
                </label>
                <textarea id="paste-draft" name="body" rows={10} required maxLength={20000} dir="auto" className={`${field} leading-relaxed`} />
                <SubmitButton className={`${primary} self-start`}>{d.draft.saveNew}</SubmitButton>
              </form>
            </details>
            {latest && (
              <details className="group mt-3 border-t border-line pt-4">
                <summary className={summary}>
                  <Chevron />
                  {d.draft.edit}
                </summary>
                <form action={saveDraftAction} className="mt-3 flex flex-col gap-2">
                  <Hidden inquiryId={id} extra={{ source: "edited" }} />
                  <label htmlFor="edit-draft" className="text-[13px] text-ink-soft">
                    {d.draft.editHelp(latest.version + 1)}
                  </label>
                  <textarea id="edit-draft" name="body" rows={12} required maxLength={20000} dir="auto" defaultValue={latestText} className={`${field} leading-relaxed`} />
                  <SubmitButton className={`${primary} self-start`}>{d.draft.saveEdited}</SubmitButton>
                </form>
              </details>
            )}
            {drafts.length > 1 && (
              <details className="group mt-3 border-t border-line pt-4">
                <summary className={summary}>
                  <Chevron />
                  {d.draft.earlier(drafts.length - 1)}
                </summary>
                <ul className="mt-2 mb-0 list-none p-0 text-[13.5px]">
                  {drafts.slice(1).map((x) => (
                    <li key={x.id} className="flex flex-wrap items-center gap-2 border-t border-line py-2 first:border-t-0">
                      <Chip>{versionShort(x.version)}</Chip>
                      <span>{L.review[x.review_status]}</span>
                      <span className="text-ink-soft">
                        · {d.draft.sources[x.source] ?? x.source} · {nameOf(x.created_by)} · {when(x.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Section>
        </div>

        <div className="flex flex-col gap-5">
          <Section title={d.owner.title} id="owner" aside={<span className="text-[13px] font-semibold" data-owners>{ownersLabel(inquiry.owners, members, d.owner.unassigned)}</span>}>
            <form action={setOwnersAction} className="flex flex-col gap-3">
              <Hidden inquiryId={id} />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="owner-select" className="text-[13px] font-semibold">
                  {d.owner.owner}
                </label>
                <select id="owner-select" name="owners" defaultValue={ownersValue} className={field}>
                  <option value="">{d.owner.unassigned}</option>
                  {ownerChoices(members).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <p className="m-0 text-[12.5px] text-ink-faint">{d.owner.help}</p>
              </div>
              <SubmitButton className={`${button} self-start`}>{d.owner.save}</SubmitButton>
            </form>
          </Section>

          <Section title={d.followUps.title} id="follow-ups" aside={openFollowUps.length ? <span className="text-[12.5px] text-ink-faint">{openFollowUps.length}</span> : null}>
            {openFollowUps.length > 0 ? (
              <ul className="m-0 mb-4 list-none p-0" data-follow-ups>
                {openFollowUps.map((f) => {
                  const overdue = f.due_on < today;
                  return (
                    <li key={f.id} className="flex items-start justify-between gap-3 border-b border-line py-3 first:pt-0" data-follow-up={f.action}>
                      <div className="min-w-0">
                        <p dir="auto" className="m-0 text-[14px] font-medium">
                          {f.action}
                        </p>
                        <p className="m-0 mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-soft">
                          <span className="font-semibold text-ink">{memberName(f.owner)}</span>
                          <span aria-hidden>·</span>
                          {overdue ? (
                            <Chip tone="attention">
                              {d.followUps.overdue} · {formatDay(f.due_on, locale)}
                            </Chip>
                          ) : f.due_on === today ? (
                            <Chip tone="warn">{d.followUps.today}</Chip>
                          ) : (
                            <span>{d.followUps.dueOn(formatDay(f.due_on, locale))}</span>
                          )}
                        </p>
                      </div>
                      <form action={completeFollowUpAction} className="flex-none">
                        <Hidden inquiryId={id} extra={{ followUpId: f.id }} />
                        <SubmitButton className={`${button} px-3 py-1.5 text-[12.5px]`}>{d.followUps.done}</SubmitButton>
                      </form>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-0 mb-4 text-[13px] text-ink-faint">{d.followUps.none}</p>
            )}
            <form action={addFollowUpAction} className="flex flex-col gap-3 rounded-xl bg-surface-2/60 p-3.5">
              <Hidden inquiryId={id} />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="follow-up-action" className="text-[13px] font-semibold">
                  {d.followUps.action}
                </label>
                <input id="follow-up-action" name="action" required maxLength={500} dir="auto" placeholder={d.followUps.placeholder} className={field} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="follow-up-owner" className="text-[13px] font-semibold">
                    {d.followUps.responsible}
                  </label>
                  <select id="follow-up-owner" name="owner" required defaultValue="" className={field}>
                    <option value="" disabled>
                      {d.followUps.choose}
                    </option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="follow-up-due" className="text-[13px] font-semibold">
                    {d.followUps.due}
                  </label>
                  <input id="follow-up-due" name="dueOn" type="date" required min={today} className={field} />
                </div>
              </div>
              <SubmitButton className={`${primary} self-start`}>{d.followUps.add}</SubmitButton>
            </form>
            {doneFollowUps.length > 0 && (
              <details className="group mt-4 border-t border-line pt-3">
                <summary className={summary}>
                  <Chevron />
                  {d.followUps.completed(doneFollowUps.length)}
                </summary>
                <ul className="mt-2 mb-0 list-none p-0 text-[13px]">
                  {doneFollowUps.map((f) => (
                    <li key={f.id} className="border-t border-line py-2 first:border-t-0">
                      <span dir="auto" className="line-through decoration-ink/30">
                        {f.action}
                      </span>
                      <span className="block text-[12px] text-ink-faint">
                        {memberName(f.owner)} · {d.followUps.doneBy(nameOf(f.done_by), when(f.done_at!))}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Section>

          <Section title={d.notes.title} id="notes" aside={notes.length ? <span className="text-[12.5px] text-ink-faint">{notes.length}</span> : null}>
            <form action={addNoteAction} className="flex flex-col gap-2">
              <Hidden inquiryId={id} />
              <label htmlFor="note" className="sr-only">
                {d.notes.label}
              </label>
              <textarea id="note" name="body" rows={3} required maxLength={4000} dir="auto" placeholder={d.notes.placeholder} className={field} />
              <SubmitButton className={`${button} self-start`}>{d.notes.add}</SubmitButton>
            </form>
            {notes.length > 0 ? (
              <ul className="mt-4 mb-0 list-none p-0" data-notes>
                {notes.map((n) => (
                  <li key={n.id} className="border-t border-line py-3 text-[14px]">
                    <div className="mb-1 text-[12.5px] text-ink-faint">
                      <span className="font-semibold text-ink-soft">{nameOf(n.author)}</span> · {when(n.created_at)}
                    </div>
                    <div dir="auto" className="leading-relaxed whitespace-pre-wrap">
                      {n.body}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 mb-0 text-[13px] text-ink-faint">{d.notes.none}</p>
            )}
          </Section>

          <details className={`group ${card} p-5 sm:p-6`}>
            <summary className={`${summary} text-[15px]`}>
              <Chevron />
              {d.contact.title}
            </summary>
            <p className="mt-2 text-[13px] text-ink-soft">{d.contact.note}</p>
            <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[14px]">
              <dt className="text-ink-soft">{d.contact.email}</dt>
              <dd className="m-0 break-words" dir="ltr">
                {inquiry.email}
              </dd>
              {inquiry.phone && (
                <>
                  <dt className="text-ink-soft">{d.contact.phone}</dt>
                  <dd className="m-0" dir="ltr">
                    {inquiry.phone}
                  </dd>
                </>
              )}
              {inquiry.company_url && (
                <>
                  <dt className="text-ink-soft">{d.contact.website}</dt>
                  <dd className="m-0 break-words" dir="ltr">
                    {inquiry.company_url}
                  </dd>
                </>
              )}
            </dl>
          </details>

          {demo && (
            <section aria-labelledby="demo" className="rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50 p-5">
              <h2 id="demo" className="m-0 text-[15px] font-semibold text-amber-900">
                {d.demo.title}
              </h2>
              <p className="mt-1 mb-3 text-[13px] text-amber-900">{d.demo.body}</p>
              <div className="flex flex-wrap gap-2">
                {(["book", "reschedule", "cancel"] as const).map((kind) => (
                  <form key={kind} action={demoBookingAction}>
                    <Hidden inquiryId={id} extra={{ kind }} />
                    <SubmitButton className={button}>{d.demo[kind]}</SubmitButton>
                  </form>
                ))}
                {(
                  [
                    ["mock", d.demo.mock],
                    ["invalid", d.demo.fail],
                    ["quota", d.demo.quota],
                  ] as const
                ).map(([outcome, text]) => (
                  <form key={outcome} action={demoGenerateAction}>
                    <Hidden inquiryId={id} extra={{ outcome }} />
                    <SubmitButton className={button}>{text}</SubmitButton>
                  </form>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

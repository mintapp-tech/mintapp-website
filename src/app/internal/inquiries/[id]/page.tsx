import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import CopyButton from "@/components/dashboard/CopyButton";
import DraftBody from "@/components/dashboard/DraftBody";
import SubmitButton from "@/components/dashboard/SubmitButton";
import { Chip, MEETING_TONES, REVIEW_TONES, button, card, eyebrow, field, formatDate, primary } from "@/components/dashboard/ui";
import { requireTeamMember } from "@/lib/team-auth/guard";
import { teamAccounts } from "@/lib/team-auth/accounts";
import { getInquiry } from "@/lib/dashboard/data";
import { claudePrompt, draftText, structuredBrief, unstatedFigures } from "@/lib/dashboard/brief";
import { LEAD_LABELS, MEETING_LABELS, PREPARATION_LABELS, PROJECT_TYPE_LABELS, REVIEW_LABELS, label, preparationNotice } from "@/lib/dashboard/status";
import { isLocalDashboardDemo } from "@/lib/sql-gateway";
import { selectGenerator } from "@/lib/preparation/config";
import {
  addNoteAction,
  assignAction,
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
export const metadata: Metadata = { title: "Inquiry · Mintapp team", robots: { index: false, follow: false, nocache: true } };

const SOURCE_LABELS: Record<string, string> = {
  mock: "Mock generator (placeholder, not real analysis)",
  codecraft: "Automated (CodeCraft)",
  manual: "Pasted by the team",
  edited: "Edited by the team",
};

const NOTICE_STYLES = {
  attention: { box: "border-red-200 bg-red-50", dot: "bg-red-600" },
  info: { box: "border-sky-200 bg-sky-50", dot: "bg-sky-600" },
  ok: { box: "border-mint/50 bg-mint-soft", dot: "bg-mint-deep" },
} as const;

const summary = "flex cursor-pointer list-none items-center gap-2 text-[14px] font-semibold [&::-webkit-details-marker]:hidden";
const Chevron = () => (
  <svg aria-hidden viewBox="0 0 16 16" className="size-3.5 flex-none transition-transform group-open:rotate-90">
    <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function Section({ title, id, children, aside }: { title: string; id: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section aria-labelledby={id} className={`${card} p-5 sm:p-6`}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id} className="m-0 text-[17px] font-bold tracking-[-0.01em]">
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
  await requireTeamMember();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detail = await getInquiry(id);
  if (!detail) notFound();

  const { inquiry, meeting, preparation, drafts, notes } = detail;
  const accounts = teamAccounts();
  const nameOf = (email: string | null) => (email ? (accounts.find((a) => a.email === email)?.name ?? email) : "");
  const generator = selectGenerator();
  const demo = isLocalDashboardDemo();
  const notice = preparationNotice(preparation, {
    enabled: generator.enabled,
    provider: generator.enabled ? generator.generator.id : undefined,
    paused: detail.automation,
  });
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
  const approved = drafts.find((d) => d.review_status === "approved");
  const waiting = preparation && ["queued", "retry_scheduled"].includes(preparation.status);
  const stuck = preparation && ["failed", "paused"].includes(preparation.status);
  const tone = NOTICE_STYLES[notice.tone];
  const language = inquiry.language === "ar" ? "Arabic" : "English";

  const facts: [string, ReactNode, string | null][] = [
    [
      "Meeting",
      <Chip key="m" tone={MEETING_TONES[meeting.booking_status] ?? "neutral"} data-status="meeting">
        {label(MEETING_LABELS, meeting.booking_status)}
      </Chip>,
      meeting.meeting_start_at && meeting.booking_status !== "not_booked" ? formatDate(meeting.meeting_start_at) : null,
    ],
    [
      "Preparation",
      <span key="p" data-status="preparation">
        {label(PREPARATION_LABELS, preparation?.status)}
      </span>,
      preparation?.generator && preparation.status !== "manual" ? `via ${preparation.generator}` : null,
    ],
    ["Review", approved ? `Approved · v${approved.version}` : latest ? `${REVIEW_LABELS[latest.review_status]} · v${latest.version}` : "No draft", null],
    ["Lead", label(LEAD_LABELS, inquiry.lead_status), null],
  ];

  return (
    <>
      <Link href="/internal/inquiries" className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-soft hover:text-ink">
        <span aria-hidden>←</span> All inquiries
      </Link>

      <header className="mt-4 mb-6">
        <p className={eyebrow}>
          {label(PROJECT_TYPE_LABELS, inquiry.project_type, "Project type not stated")} · {language}
        </p>
        <h1 className="m-0 mt-1.5 text-[26px] leading-tight font-bold tracking-[-0.02em] sm:text-[32px]">
          <span dir="auto">{inquiry.client_name}</span>
          {inquiry.company_name ? <span className="font-semibold text-ink-soft"> · {inquiry.company_name}</span> : null}
        </h1>
        <p className="mt-1.5 mb-0 text-[13.5px] text-ink-soft">Received {formatDate(inquiry.created_at)}</p>
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
                    <SubmitButton className={primary}>Prepare now ({generator.generator.id})</SubmitButton>
                  </form>
                )}
                {stuck && (
                  <form action={retryAction}>
                    <Hidden inquiryId={id} />
                    <SubmitButton className={button}>Retry automated preparation</SubmitButton>
                  </form>
                )}
                {(waiting || stuck) && (
                  <form action={markManualAction}>
                    <Hidden inquiryId={id} />
                    <SubmitButton className={button}>Prepare manually instead</SubmitButton>
                  </form>
                )}
                {detail.automation.map((p) => (
                  <form key={p.provider} action={resumeAutomationAction}>
                    <Hidden inquiryId={id} extra={{ provider: p.provider }} />
                    <SubmitButton className={button}>Resume automation ({p.provider})</SubmitButton>
                  </form>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <Section title="Brief" id="brief">
            <h3 className={eyebrow}>Provided by the client</h3>
            <dl className="mt-2 mb-5 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[14px]" data-brief="provided">
              {brief.provided.map((p) => (
                <div key={p.label} className="contents">
                  <dt className="text-ink-soft">{p.label}</dt>
                  <dd className="m-0 font-medium">
                    <span dir="auto">{p.label === "Project type" ? label(PROJECT_TYPE_LABELS, p.value) : p.value}</span>
                  </dd>
                </div>
              ))}
            </dl>
            <h3 className={eyebrow}>In their words</h3>
            <div dir="auto" className="mt-2 rounded-xl border-s-4 border-mint bg-canvas p-4 text-[15px] leading-[1.8] whitespace-pre-wrap" data-brief="description">
              {brief.description}
            </div>
            <h3 className={`${eyebrow} mt-5`}>Missing from the form</h3>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[14px]" data-brief="missing">
              {brief.missing.length ? (
                brief.missing.map((m) => (
                  <Chip key={m} tone="warn">
                    {m}
                  </Chip>
                ))
              ) : (
                <span className="text-ink-soft">Nothing, but the description may still leave questions.</span>
              )}
            </div>

            <div className="mt-6 rounded-xl bg-surface-2/70 p-4">
              <p className="m-0 text-[14px] font-semibold">Prepare it with Claude</p>
              <ol className="mt-2 mb-3 list-decimal ps-5 text-[13.5px] leading-relaxed text-ink-soft">
                <li>Copy the brief. It holds the brief and instructions only, no contact details.</li>
                <li>Paste it into Claude and review the answer.</li>
                <li>Paste the result under Preparation draft, then mark it ready for review.</li>
              </ol>
              <CopyButton text={claudePrompt(brief)} label="Copy brief for Claude" />
            </div>
          </Section>

          <Section
            title="Preparation draft"
            id="draft"
            aside={approved && approved.version !== latest?.version ? <Chip tone="ok">Approved for the meeting: v{approved.version}</Chip> : null}
          >
            {latest ? (
              <article data-draft-version={latest.version}>
                <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px]">
                  <Chip>Version {latest.version}</Chip>
                  <Chip tone={REVIEW_TONES[latest.review_status] ?? "neutral"} data-review={latest.review_status}>
                    {REVIEW_LABELS[latest.review_status]}
                  </Chip>
                  <span className="text-ink-soft">
                    {SOURCE_LABELS[latest.source] ?? latest.source} · {nameOf(latest.created_by)} · {formatDate(latest.created_at)}
                  </span>
                </div>
                <DraftBody text={latestText} />
                {figures.length > 0 && (
                  <p className="mt-3 mb-0 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13.5px] text-amber-900">
                    Check before approving: figures not stated by the client ({figures.join(", ")}).
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {latest.review_status === "draft" && (
                    <form action={reviewAction}>
                      <Hidden inquiryId={id} extra={{ version: latest.version, to: "in_review" }} />
                      <SubmitButton className={primary}>Mark ready for review</SubmitButton>
                    </form>
                  )}
                  {latest.review_status === "in_review" && (
                    <>
                      <form action={reviewAction}>
                        <Hidden inquiryId={id} extra={{ version: latest.version, to: "approved" }} />
                        <SubmitButton className={primary}>Approve for the meeting</SubmitButton>
                      </form>
                      <form action={reviewAction}>
                        <Hidden inquiryId={id} extra={{ version: latest.version, to: "draft" }} />
                        <SubmitButton className={button}>Send back to draft</SubmitButton>
                      </form>
                    </>
                  )}
                  {latest.review_status === "approved" && (
                    <form action={reviewAction}>
                      <Hidden inquiryId={id} extra={{ version: latest.version, to: "draft" }} />
                      <SubmitButton className={button}>Withdraw approval</SubmitButton>
                    </form>
                  )}
                </div>
                {latest.reviewed_by && (
                  <p className="mt-2 mb-0 text-[13px] text-ink-soft">
                    Last review change by {nameOf(latest.reviewed_by)}, {formatDate(latest.reviewed_at!)}
                  </p>
                )}
              </article>
            ) : (
              <p className="m-0 rounded-xl border border-dashed border-ink/20 p-4 text-[14px] text-ink-soft">
                No draft yet. Paste one prepared in Claude below{generator.enabled ? ", or wait for automated preparation" : ""}.
              </p>
            )}

            <details className="group mt-5 border-t border-line pt-4" open={!latest}>
              <summary className={summary}>
                <Chevron />
                Paste a draft prepared in Claude
              </summary>
              <form action={saveDraftAction} className="mt-3 flex flex-col gap-2">
                <Hidden inquiryId={id} extra={{ source: "manual" }} />
                <label htmlFor="paste-draft" className="text-[13px] text-ink-soft">
                  Paste the result, edit it here if needed, then save. It is saved as a new draft version for review.
                </label>
                <textarea id="paste-draft" name="body" rows={10} required maxLength={20000} dir="auto" className={`${field} leading-relaxed`} />
                <SubmitButton className={`${primary} self-start`}>Save as new draft</SubmitButton>
              </form>
            </details>
            {latest && (
              <details className="group mt-3 border-t border-line pt-4">
                <summary className={summary}>
                  <Chevron />
                  Edit the latest version
                </summary>
                <form action={saveDraftAction} className="mt-3 flex flex-col gap-2">
                  <Hidden inquiryId={id} extra={{ source: "edited" }} />
                  <label htmlFor="edit-draft" className="text-[13px] text-ink-soft">
                    Saving creates version {latest.version + 1}; earlier versions are kept.
                  </label>
                  <textarea id="edit-draft" name="body" rows={12} required maxLength={20000} dir="auto" defaultValue={latestText} className={`${field} leading-relaxed`} />
                  <SubmitButton className={`${primary} self-start`}>Save edited version</SubmitButton>
                </form>
              </details>
            )}
            {drafts.length > 1 && (
              <details className="group mt-3 border-t border-line pt-4">
                <summary className={summary}>
                  <Chevron />
                  Earlier versions ({drafts.length - 1})
                </summary>
                <ul className="mt-2 mb-0 list-none p-0 text-[13.5px]">
                  {drafts.slice(1).map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center gap-2 border-t border-line py-2 first:border-t-0">
                      <Chip>v{d.version}</Chip>
                      <span>{REVIEW_LABELS[d.review_status]}</span>
                      <span className="text-ink-soft">
                        · {SOURCE_LABELS[d.source] ?? d.source} · {nameOf(d.created_by)} · {formatDate(d.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Section>
        </div>

        <div className="flex flex-col gap-5">
          <Section title="Owner and next action" id="owner">
            <form action={assignAction} className="flex flex-col gap-3">
              <Hidden inquiryId={id} />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="owner-select" className="text-[13px] font-semibold">
                  Owner
                </label>
                <select id="owner-select" name="owner" defaultValue={inquiry.assigned_to ?? ""} className={field}>
                  <option value="">Unassigned</option>
                  {accounts.map((a) => (
                    <option key={a.email} value={a.email}>
                      {a.name} ({a.email})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="next-action" className="text-[13px] font-semibold">
                  Next action
                </label>
                <input id="next-action" name="nextAction" defaultValue={inquiry.next_action ?? ""} maxLength={500} placeholder="For example: send the meeting questions" className={field} />
              </div>
              <SubmitButton className={`${button} self-start`}>Save</SubmitButton>
            </form>
          </Section>

          <Section title="Notes" id="notes" aside={notes.length ? <span className="text-[12.5px] text-ink-faint">{notes.length}</span> : null}>
            <form action={addNoteAction} className="flex flex-col gap-2">
              <Hidden inquiryId={id} />
              <label htmlFor="note" className="sr-only">
                New note
              </label>
              <textarea id="note" name="body" rows={3} required maxLength={4000} dir="auto" placeholder="Add a note for the team" className={field} />
              <SubmitButton className={`${button} self-start`}>Add note</SubmitButton>
            </form>
            {notes.length > 0 ? (
              <ul className="mt-4 mb-0 list-none p-0" data-notes>
                {notes.map((n) => (
                  <li key={n.id} className="border-t border-line py-3 text-[14px]">
                    <div className="mb-1 text-[12.5px] text-ink-faint">
                      <span className="font-semibold text-ink-soft">{nameOf(n.author)}</span> · {formatDate(n.created_at)}
                    </div>
                    <div dir="auto" className="leading-relaxed whitespace-pre-wrap">
                      {n.body}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 mb-0 text-[13px] text-ink-faint">No notes yet.</p>
            )}
          </Section>

          <details className={`group ${card} p-5 sm:p-6`}>
            <summary className={`${summary} text-[15px]`}>
              <Chevron />
              Contact details
            </summary>
            <p className="mt-2 text-[13px] text-ink-soft">For the team only. Never included in briefs or sent to automation.</p>
            <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[14px]">
              <dt className="text-ink-soft">Email</dt>
              <dd className="m-0 break-words">{inquiry.email}</dd>
              {inquiry.phone && (
                <>
                  <dt className="text-ink-soft">Phone</dt>
                  <dd className="m-0" dir="ltr">
                    {inquiry.phone}
                  </dd>
                </>
              )}
              {inquiry.company_url && (
                <>
                  <dt className="text-ink-soft">Website</dt>
                  <dd className="m-0 break-words">{inquiry.company_url}</dd>
                </>
              )}
            </dl>
          </details>

          {demo && (
            <section aria-labelledby="demo" className="rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50 p-5">
              <h2 id="demo" className="m-0 text-[15px] font-semibold text-amber-900">
                Simulated (local demo only)
              </h2>
              <p className="mt-1 mb-3 text-[13px] text-amber-900">These stand in for Cal.com webhooks and a generator. They do not exist outside the local demo.</p>
              <div className="flex flex-wrap gap-2">
                {(["book", "reschedule", "cancel"] as const).map((kind) => (
                  <form key={kind} action={demoBookingAction}>
                    <Hidden inquiryId={id} extra={{ kind }} />
                    <SubmitButton className={button}>Simulate {kind === "book" ? "booking" : kind === "reschedule" ? "reschedule" : "cancellation"}</SubmitButton>
                  </form>
                ))}
                {(
                  [
                    ["mock", "Run mock generator"],
                    ["invalid", "Simulate generator failure"],
                    ["quota", "Simulate quota exhausted"],
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

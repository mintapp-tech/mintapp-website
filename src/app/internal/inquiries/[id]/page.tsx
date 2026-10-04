import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import Shell from "@/components/dashboard/Shell";
import CopyButton from "@/components/dashboard/CopyButton";
import { requireTeamMember } from "@/lib/team-auth/guard";
import { teamAccounts } from "@/lib/team-auth/accounts";
import { getInquiry } from "@/lib/dashboard/data";
import { claudePrompt, draftText, structuredBrief, unstatedFigures } from "@/lib/dashboard/brief";
import { MEETING_LABELS, REVIEW_LABELS, preparationNotice } from "@/lib/dashboard/status";
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
export const metadata: Metadata = { title: "Inquiry — Mintapp team", robots: { index: false, follow: false, nocache: true } };

const SOURCE_LABELS: Record<string, string> = {
  mock: "Mock generator (placeholder, not real analysis)",
  codecraft: "Automated (CodeCraft)",
  manual: "Pasted by the team",
  edited: "Edited by the team",
};

const card = "rounded-[18px] border border-ink/10 bg-surface p-5";
const button = "cursor-pointer rounded-full border border-ink/20 bg-surface px-4 py-2 text-[13.5px] font-semibold hover:border-ink/40";
const primary = "cursor-pointer rounded-full bg-ink px-4 py-2 text-[13.5px] font-semibold text-white";

function Section({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id} className={card}>
      <h2 id={id} className="m-0 mb-4 text-[17px] font-semibold">
        {title}
      </h2>
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
  const member = await requireTeamMember();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detail = await getInquiry(id);
  if (!detail) notFound();

  const { inquiry, meeting, preparation, drafts, notes } = detail;
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
  const toneClass = notice.tone === "attention" ? "border-red-300 bg-red-50" : notice.tone === "info" ? "border-sky-200 bg-sky-50" : "border-emerald-200 bg-emerald-50";

  return (
    <Shell member={member} demo={demo}>
      <p className="m-0 mb-3 text-[14px]">
        <Link href="/internal/inquiries" className="underline underline-offset-4">
          All inquiries
        </Link>
      </p>
      <h1 className="m-0 text-[26px] font-semibold">
        {inquiry.client_name}
        {inquiry.company_name ? <span className="text-ink-soft"> · {inquiry.company_name}</span> : null}
      </h1>
      <p className="mt-1 mb-5 text-[14px] text-ink-soft">
        Received {new Date(inquiry.created_at).toUTCString()} · {inquiry.language === "ar" ? "Arabic" : "English"}
      </p>

      <dl className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          ["Meeting", `${MEETING_LABELS[meeting.booking_status] ?? meeting.booking_status}${meeting.meeting_start_at ? ` · ${new Date(meeting.meeting_start_at).toUTCString()}` : ""}`],
          ["Preparation", (preparation?.status ?? "none").replaceAll("_", " ")],
          ["Sales", inquiry.lead_status.replaceAll("_", " ")],
        ].map(([k, v]) => (
          <div key={k} className={card}>
            <dt className="text-[12px] font-semibold tracking-wide text-ink-soft uppercase">{k}</dt>
            <dd className="m-0 mt-1 text-[15px] font-semibold" data-status={k.toLowerCase()}>
              {v}
            </dd>
          </div>
        ))}
      </dl>

      <div role="status" data-tone={notice.tone} className={`mb-6 rounded-[18px] border p-5 ${toneClass}`}>
        <p className="m-0 text-[15px] font-semibold">{notice.title}</p>
        <p className="m-0 mt-1 text-[14px]">{notice.detail}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {generator.enabled && waiting && (
            <form action={prepareNowAction}>
              <Hidden inquiryId={id} />
              <button className={primary}>Prepare now ({generator.generator.id})</button>
            </form>
          )}
          {stuck && (
            <form action={retryAction}>
              <Hidden inquiryId={id} />
              <button className={button}>Retry automated preparation</button>
            </form>
          )}
          {(waiting || stuck) && (
            <form action={markManualAction}>
              <Hidden inquiryId={id} />
              <button className={button}>Prepare manually instead</button>
            </form>
          )}
          {detail.automation.map((p) => (
            <form key={p.provider} action={resumeAutomationAction}>
              <Hidden inquiryId={id} extra={{ provider: p.provider }} />
              <button className={button}>Resume automation ({p.provider})</button>
            </form>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.25fr_1fr]">
        <div className="flex flex-col gap-5">
          <Section title="Brief" id="brief">
            <h3 className="m-0 text-[13px] font-semibold tracking-wide text-ink-soft uppercase">Provided by the client</h3>
            <ul className="mt-2 mb-4 list-disc ps-5 text-[14.5px]" data-brief="provided">
              {brief.provided.map((p) => (
                <li key={p.label}>
                  {p.label}: <span dir="auto">{p.value}</span>
                </li>
              ))}
            </ul>
            <div dir="auto" className="rounded-xl bg-canvas p-4 text-[15px] leading-[1.75] whitespace-pre-wrap" data-brief="description">
              {brief.description}
            </div>
            <h3 className="mt-4 mb-0 text-[13px] font-semibold tracking-wide text-ink-soft uppercase">Missing</h3>
            <p className="mt-2 mb-4 text-[14.5px]" data-brief="missing">
              {brief.missing.length ? brief.missing.join(", ") : "Nothing from the form, but the description may still leave questions."}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <CopyButton text={claudePrompt(brief)} label="Copy brief for Claude" />
              <span className="text-[13px] text-ink-soft">Contains the brief and instructions only, no contact details.</span>
            </div>
          </Section>

          <Section title="Preparation draft" id="draft">
            {latest ? (
              <article data-draft-version={latest.version}>
                <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px]">
                  <span className="rounded-full bg-canvas px-2.5 py-1 font-semibold">Version {latest.version}</span>
                  <span className="rounded-full bg-canvas px-2.5 py-1" data-review={latest.review_status}>
                    {REVIEW_LABELS[latest.review_status]}
                  </span>
                  <span className="text-ink-soft">
                    {SOURCE_LABELS[latest.source] ?? latest.source} · {latest.created_by}
                  </span>
                </div>
                <div dir="auto" className="rounded-xl bg-canvas p-4 text-[14.5px] leading-[1.75] whitespace-pre-wrap">
                  {latestText}
                </div>
                {figures.length > 0 && (
                  <p className="mt-3 mb-0 rounded-xl bg-amber-50 p-3 text-[13.5px] text-amber-900">
                    Check before approving: figures not stated by the client ({figures.join(", ")}).
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {latest.review_status === "draft" && (
                    <form action={reviewAction}>
                      <Hidden inquiryId={id} extra={{ version: latest.version, to: "in_review" }} />
                      <button className={primary}>Mark ready for review</button>
                    </form>
                  )}
                  {latest.review_status === "in_review" && (
                    <>
                      <form action={reviewAction}>
                        <Hidden inquiryId={id} extra={{ version: latest.version, to: "approved" }} />
                        <button className={primary}>Approve for the meeting</button>
                      </form>
                      <form action={reviewAction}>
                        <Hidden inquiryId={id} extra={{ version: latest.version, to: "draft" }} />
                        <button className={button}>Send back to draft</button>
                      </form>
                    </>
                  )}
                  {latest.review_status === "approved" && (
                    <form action={reviewAction}>
                      <Hidden inquiryId={id} extra={{ version: latest.version, to: "draft" }} />
                      <button className={button}>Withdraw approval</button>
                    </form>
                  )}
                </div>
                {latest.reviewed_by && (
                  <p className="mt-2 mb-0 text-[13px] text-ink-soft">
                    Last review change by {latest.reviewed_by}, {new Date(latest.reviewed_at!).toUTCString()}
                  </p>
                )}
              </article>
            ) : (
              <p className="mt-0 text-[14.5px] text-ink-soft">No draft yet.</p>
            )}
            {approved && approved.version !== latest?.version && (
              <p className="mt-3 mb-0 text-[13.5px]">Approved for the meeting: version {approved.version}.</p>
            )}

            <details className="mt-5" open={!latest}>
              <summary className="cursor-pointer text-[14.5px] font-semibold">Paste a draft prepared in Claude</summary>
              <form action={saveDraftAction} className="mt-3 flex flex-col gap-2">
                <Hidden inquiryId={id} extra={{ source: "manual" }} />
                <label htmlFor="paste-draft" className="text-[13px] text-ink-soft">
                  Paste the result, edit it here if needed, then save. It is saved as a new draft version for review.
                </label>
                <textarea id="paste-draft" name="body" rows={10} required maxLength={20000} dir="auto" className="rounded-xl border border-ink/20 bg-surface p-3 text-[14.5px]" />
                <button className={`${primary} self-start`}>Save as new draft</button>
              </form>
            </details>
            {latest && (
              <details className="mt-3">
                <summary className="cursor-pointer text-[14.5px] font-semibold">Edit the latest version</summary>
                <form action={saveDraftAction} className="mt-3 flex flex-col gap-2">
                  <Hidden inquiryId={id} extra={{ source: "edited" }} />
                  <label htmlFor="edit-draft" className="text-[13px] text-ink-soft">
                    Saving creates version {latest.version + 1}; earlier versions are kept.
                  </label>
                  <textarea id="edit-draft" name="body" rows={12} required maxLength={20000} dir="auto" defaultValue={latestText} className="rounded-xl border border-ink/20 bg-surface p-3 text-[14.5px]" />
                  <button className={`${primary} self-start`}>Save edited version</button>
                </form>
              </details>
            )}
            {drafts.length > 1 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-[14.5px] font-semibold">Earlier versions ({drafts.length - 1})</summary>
                <ul className="mt-2 list-none p-0 text-[13.5px]">
                  {drafts.slice(1).map((d) => (
                    <li key={d.id} className="border-t border-ink/10 py-2">
                      Version {d.version} · {REVIEW_LABELS[d.review_status]} · {SOURCE_LABELS[d.source] ?? d.source} · {d.created_by}
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
              <label htmlFor="owner-select" className="text-[13.5px] font-medium">
                Owner
              </label>
              <select id="owner-select" name="owner" defaultValue={inquiry.assigned_to ?? ""} className="-mt-2 rounded-xl border border-ink/20 bg-surface px-3 py-2 text-[14.5px]">
                  <option value="">Unassigned</option>
                  {teamAccounts().map((a) => (
                    <option key={a.email} value={a.email}>
                      {a.name} ({a.email})
                    </option>
                  ))}
              </select>
              <label htmlFor="next-action" className="text-[13.5px] font-medium">
                Next action
              </label>
              <input id="next-action" name="nextAction" defaultValue={inquiry.next_action ?? ""} maxLength={500} className="-mt-2 rounded-xl border border-ink/20 bg-surface px-3 py-2 text-[14.5px]" />
              <button className={`${button} self-start`}>Save</button>
            </form>
          </Section>

          <Section title="Notes" id="notes">
            <form action={addNoteAction} className="flex flex-col gap-2">
              <Hidden inquiryId={id} />
              <label htmlFor="note" className="sr-only">
                New note
              </label>
              <textarea id="note" name="body" rows={3} required maxLength={4000} dir="auto" placeholder="Add a note for the team" className="rounded-xl border border-ink/20 bg-surface p-3 text-[14.5px]" />
              <button className={`${button} self-start`}>Add note</button>
            </form>
            <ul className="mt-4 list-none p-0" data-notes>
              {notes.map((n) => (
                <li key={n.id} className="border-t border-ink/10 py-3 text-[14.5px]">
                  <div dir="auto" className="whitespace-pre-wrap">
                    {n.body}
                  </div>
                  <div className="mt-1 text-[12.5px] text-ink-soft">
                    {n.author} · {new Date(n.created_at).toUTCString()}
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          <details className={card}>
            <summary className="cursor-pointer text-[15px] font-semibold">Contact details</summary>
            <p className="mt-2 text-[13px] text-ink-soft">For the team only. Never included in briefs or sent to automation.</p>
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[14px]">
              <dt className="text-ink-soft">Email</dt>
              <dd className="m-0">{inquiry.email}</dd>
              {inquiry.phone && (
                <>
                  <dt className="text-ink-soft">Phone</dt>
                  <dd className="m-0">{inquiry.phone}</dd>
                </>
              )}
              {inquiry.company_url && (
                <>
                  <dt className="text-ink-soft">Website</dt>
                  <dd className="m-0">{inquiry.company_url}</dd>
                </>
              )}
            </dl>
          </details>

          {demo && (
            <section aria-labelledby="demo" className="rounded-[18px] border-2 border-dashed border-amber-400 bg-amber-50 p-5">
              <h2 id="demo" className="m-0 text-[16px] font-semibold text-amber-900">
                Simulated (local demo only)
              </h2>
              <p className="mt-1 mb-3 text-[13px] text-amber-900">These stand in for Cal.com webhooks and a generator. They do not exist outside the local demo.</p>
              <div className="flex flex-wrap gap-2">
                {(["book", "reschedule", "cancel"] as const).map((kind) => (
                  <form key={kind} action={demoBookingAction}>
                    <Hidden inquiryId={id} extra={{ kind }} />
                    <button className={button}>Simulate {kind === "book" ? "booking" : kind === "reschedule" ? "reschedule" : "cancellation"}</button>
                  </form>
                ))}
                {(
                  [
                    ["mock", "Run mock generator"],
                    ["invalid", "Simulate generator failure"],
                    ["quota", "Simulate quota exhausted"],
                  ] as const
                ).map(([outcome, label]) => (
                  <form key={outcome} action={demoGenerateAction}>
                    <Hidden inquiryId={id} extra={{ outcome }} />
                    <button className={button}>{label}</button>
                  </form>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </Shell>
  );
}

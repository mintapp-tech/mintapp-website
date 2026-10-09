import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CopyButton from "@/components/dashboard/CopyButton";
import SubmitButton from "@/components/dashboard/SubmitButton";
import { Chip, REVIEW_TONES, button, card, field, formatDate, formatDay, primary, todayInCairo } from "@/components/dashboard/ui";
import Notice from "@/components/crm/Notice";
import { PackChip } from "@/components/crm/LeadParts";
import { requireAdmin } from "@/lib/admin/auth/state";
import { teamMembers } from "@/lib/admin/auth/config";
import { adminText } from "@/lib/admin/locale";
import type { AdminMessages } from "@/lib/admin/messages";
import { people } from "@/lib/admin/people";
import { automationStatus, isLeadId, loadInquiry, loadLead } from "@/lib/crm/lead-load";
import { designPath } from "@/lib/crm/lead-path";
import type { DraftRow } from "@/lib/dashboard/data";
import { draftText, unstatedFigures } from "@/lib/dashboard/brief";
import { ARTIFACTS, manualReason, mayApproveArtifact, packState, type Artifact } from "@/lib/pack/state";
import { renderableDesign } from "@/lib/pack/schema";
import { artifactLanguage, artifactSections, artifactText } from "@/lib/pack/text";
import { manualPackPrompt } from "@/lib/pack/prompt";
import { buildGenerationInput } from "@/lib/preparation/input";
import { knownDetails } from "@/lib/preparation/scrub";
import { demoBookingAction, demoGenerateAction, markManualAction, resumeAutomationAction } from "../../../inquiries/actions";
import { isLocalDashboardDemo } from "@/lib/sql-gateway";
import { packEditDesignAction, packEditTextAction, packPasteAction, packReviewAction, prepareNowLeadAction, takeReviewAction } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pre-meeting Pack" };

const summaryClass = "flex cursor-pointer list-none items-center gap-2 text-[14px] font-semibold [&::-webkit-details-marker]:hidden";

function Hidden({ values }: { values: Record<string, string | number> }) {
  return (
    <>
      {Object.entries(values).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={String(v)} />
      ))}
    </>
  );
}

// Consecutive "- " lines become one list; other lines stay paragraphs.
function groupLines(lines: string[]) {
  const groups: { list: boolean; lines: string[] }[] = [];
  for (const l of lines) {
    const list = l.startsWith("- ");
    const last = groups.at(-1);
    if (last && last.list === list) last.lines.push(l);
    else groups.push({ list, lines: [l] });
  }
  return groups;
}

// One version's content: headed sections for a structured version, the text as
// written for a hand-written one. Content keeps its own direction.
function ArtifactBody({ content }: { content: unknown }) {
  const sections = artifactSections(content);
  const lang = artifactLanguage(content);
  if (!sections) {
    return (
      <div dir="auto" className="rounded-xl bg-canvas p-4 text-[14.5px] leading-[1.8] whitespace-pre-wrap" data-artifact-text>
        {artifactText(content)}
      </div>
    );
  }
  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} lang={lang ?? undefined} className="flex flex-col gap-4 rounded-xl bg-canvas p-4 text-[14.5px] leading-[1.75]" data-artifact-sections>
      {sections.map((s) => (
        <section key={s.title}>
          <h4 className="m-0 mb-1 text-[13px] font-bold text-ink">{s.title}</h4>
          {groupLines(s.lines).map((g, i) =>
            g.list ? (
              <ul key={i} className="m-0 list-disc ps-5">
                {g.lines.map((l, j) => (
                  <li key={j}>{l.slice(2)}</li>
                ))}
              </ul>
            ) : (
              g.lines.map((l, j) => (
                <p key={`${i}-${j}`} className="m-0">
                  {l}
                </p>
              ))
            ),
          )}
        </section>
      ))}
    </div>
  );
}

function ArtifactCard({
  inquiryId,
  name,
  versions,
  me,
  t,
  locale,
  nameOf,
  brief,
  nextVersion,
}: {
  inquiryId: string;
  name: Artifact;
  versions: DraftRow[];
  me: string;
  t: AdminMessages;
  locale: "en" | "ar";
  nameOf: (email: string) => string;
  brief: string;
  nextVersion: number;
}) {
  const p = t.lead.detail.pack;
  const latest = versions[0] ?? null;
  const earlier = versions.slice(1);
  const design = name === "design" && latest ? renderableDesign(latest.content) : null;
  const structuredDesign = name === "design" && latest && (latest.content as { format?: string }).format === "pack-design";
  const text = latest ? artifactText(latest.content) : "";
  const figures = name === "proposal" && latest && latest.source !== "mock" ? unstatedFigures(text, brief) : [];
  // An automated version already says so in its source; it has no author to name.
  const who = (email: string) => (email === "automation" ? "" : nameOf(email));

  return (
    <section aria-labelledby={`artifact-${name}-title`} id={`artifact-${name}`} className={`${card} p-5 sm:p-6`} data-artifact={name}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`artifact-${name}-title`} className="m-0 text-[17px] font-bold tracking-[-0.01em] rtl:tracking-normal">
          {t.lead.artifacts[name]}
        </h2>
        {latest && (
          <span className="flex flex-wrap items-center gap-1.5">
            <Chip>{p.version(latest.version)}</Chip>
            <Chip tone={REVIEW_TONES[latest.review_status] ?? "neutral"} data-review={latest.review_status}>
              {t.lead.reviewStatus[latest.review_status]}
            </Chip>
          </span>
        )}
      </div>

      {name === "proposal" && (
        <p className="m-0 mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13.5px] font-semibold text-amber-950" data-proposal-label>
          {p.proposalLabel}
        </p>
      )}

      {latest ? (
        <article data-version={latest.version}>
          <p className="m-0 mb-3 text-[12.5px] text-ink-soft">
            <span data-source={latest.source}>{t.lead.sources[latest.source] ?? latest.source}</span> · {who(latest.created_by) ? p.by(who(latest.created_by), formatDate(latest.created_at, true, locale)) : formatDate(latest.created_at, true, locale)}
            {latest.model ? <span dir="ltr"> · {latest.model}</span> : null}
          </p>
          {name === "design" && structuredDesign && !design && <p className="m-0 mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13.5px] text-amber-950">{p.unsupported}</p>}
          {design && (
            <p className="m-0 mb-3">
              <Link href={designPath(inquiryId, latest.version)} className={primary} data-open-preview>
                {p.openPreview}
              </Link>
            </p>
          )}
          <ArtifactBody content={latest.content} />
          {figures.length > 0 && <p className="mt-3 mb-0 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13.5px] text-amber-900">{p.checkFigures(figures.join(", "))}</p>}

          <div className="mt-4 flex flex-wrap gap-2">
            {latest.review_status === "draft" && (
              <form action={packReviewAction}>
                <Hidden values={{ inquiryId, artifact: name, version: latest.version, to: "in_review" }} />
                <SubmitButton className={primary}>{p.markReady}</SubmitButton>
              </form>
            )}
            {latest.review_status === "in_review" && (
              <>
                {mayApproveArtifact(latest, me) ? (
                  <form action={packReviewAction}>
                    <Hidden values={{ inquiryId, artifact: name, version: latest.version, to: "approved" }} />
                    <SubmitButton className={primary}>{p.approve}</SubmitButton>
                  </form>
                ) : (
                  <p data-waiting-for-teammate className="m-0 self-center rounded-xl bg-surface-2/70 px-3 py-2 text-[13.5px] text-ink-soft">
                    {p.waitingForTeammate}
                  </p>
                )}
                <form action={packReviewAction}>
                  <Hidden values={{ inquiryId, artifact: name, version: latest.version, to: "draft" }} />
                  <SubmitButton className={button}>{p.sendBack}</SubmitButton>
                </form>
              </>
            )}
            {latest.review_status === "approved" && (
              <form action={packReviewAction}>
                <Hidden values={{ inquiryId, artifact: name, version: latest.version, to: "draft" }} />
                <SubmitButton className={button}>{p.withdraw}</SubmitButton>
              </form>
            )}
          </div>
          {latest.reviewed_by && latest.reviewed_at && (
            <p className="mt-2 mb-0 text-[12.5px] text-ink-soft">{t.detail.draft.lastReview(nameOf(latest.reviewed_by), formatDate(latest.reviewed_at, true, locale))}</p>
          )}
        </article>
      ) : (
        <p className="m-0 rounded-xl border border-dashed border-ink/20 p-4 text-[14px] text-ink-soft">{p.empty}</p>
      )}

      <details className="group mt-4 border-t border-line pt-4">
        <summary className={summaryClass}>{latest ? p.editText : name === "design" ? p.writeDesign : p.edit}</summary>
        <form action={packEditTextAction} className="mt-3 flex flex-col gap-2">
          <Hidden values={{ inquiryId, artifact: name, source: latest ? "edited" : "manual" }} />
          <label htmlFor={`edit-${name}`} className="text-[13px] text-ink-soft">
            {name === "design" && !latest ? p.writeDesignHelp : p.editHelp(nextVersion)}
          </label>
          <textarea id={`edit-${name}`} name="body" rows={12} required maxLength={20000} dir="auto" defaultValue={text} className={`${field} leading-relaxed`} />
          <SubmitButton className={`${primary} self-start`}>{p.saveVersion}</SubmitButton>
        </form>
      </details>

      {structuredDesign && latest && (
        <details className="group mt-3 border-t border-line pt-4">
          <summary className={summaryClass}>{p.editDesignData}</summary>
          <form action={packEditDesignAction} className="mt-3 flex flex-col gap-2">
            <Hidden values={{ inquiryId }} />
            <label htmlFor="edit-design-json" className="text-[13px] text-ink-soft">
              {p.editDesignDataHelp}
            </label>
            <textarea
              id="edit-design-json"
              name="body"
              rows={14}
              required
              maxLength={40000}
              dir="ltr"
              spellCheck={false}
              defaultValue={JSON.stringify(
                { language: (latest.content as { language: string }).language, blueprint: (latest.content as { blueprint: unknown }).blueprint, screens: (latest.content as { screens: unknown }).screens, user_flow: (latest.content as { user_flow: unknown }).user_flow },
                null,
                2,
              )}
              className={`${field} font-mono text-[12.5px] leading-relaxed`}
            />
            <SubmitButton className={`${primary} self-start`}>{p.saveVersion}</SubmitButton>
          </form>
        </details>
      )}

      {earlier.length > 0 && (
        <details className="group mt-3 border-t border-line pt-4">
          <summary className={summaryClass}>{p.history(earlier.length)}</summary>
          <ul className="mt-2 mb-0 list-none p-0 text-[13px]" data-history>
            {earlier.map((v) => (
              <li key={v.id} className="border-t border-line py-2 first:border-t-0">
                <span className="flex flex-wrap items-center gap-2">
                  <Chip>{p.version(v.version)}</Chip>
                  <span>{t.lead.reviewStatus[v.review_status]}</span>
                  <span className="text-ink-soft">
                    · {t.lead.sources[v.source] ?? v.source} · {who(v.created_by) ? p.by(who(v.created_by), formatDate(v.created_at, true, locale)) : formatDate(v.created_at, true, locale)}
                  </span>
                  {name === "design" && renderableDesign(v.content) && (
                    <Link href={designPath(inquiryId, v.version)} className="font-semibold underline decoration-mint decoration-2 underline-offset-4">
                      {p.openPreview}
                    </Link>
                  )}
                </span>
                <details className="mt-1">
                  <summary className="cursor-pointer text-[12.5px] text-ink-soft">{p.version(v.version)}</summary>
                  <div className="mt-2">
                    <ArtifactBody content={v.content} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

export default async function LeadPack({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireAdmin();
  const { id } = await params;
  if (!isLeadId(id)) notFound();
  const [detail, lead] = await Promise.all([loadInquiry(id), loadLead(id)]);
  if (!detail || !lead) notFound();
  const sp = await searchParams;
  const { locale, t } = await adminText();
  const p = t.lead.detail.pack;
  const members = teamMembers();
  const who = people(members);
  const today = todayInCairo();
  const job = detail.preparation?.status ?? null;
  const auto = automationStatus(detail.automation);
  const state = packState({ job, artifacts: lead.pack_latest, reviewDue: lead.review_action?.due_on ?? null, today, automation: auto });
  const i = detail.inquiry;
  // The manual prompt carries the brief only, with the client's contact details removed.
  const input = buildGenerationInput({
    preferred_language: i.language,
    project_type: i.project_type,
    project_description: i.project_description,
    budget_range: i.budget_range,
    timeline: i.timeline,
    country: i.country,
    redact: knownDetails({ client_name: i.client_name, company_name: i.company_name, email: i.email, phone: i.phone, company_url: i.company_url }),
  });
  const prompt = manualPackPrompt(input);
  const byArtifact = (a: Artifact) => detail.drafts.filter((d) => d.artifact === a);
  const notes = detail.drafts.filter((d) => !d.artifact || d.artifact === "note");
  // Versions are numbered per lead, across the three parts.
  const nextVersion = Math.max(0, ...detail.drafts.map((d) => d.version)) + 1;
  const review = lead.review_action;
  const working = job === "running";
  const canPrepare = auto.enabled && !auto.paused && !working && job !== null && ["waiting_booking", "queued", "retry_scheduled", "failed", "paused", "manual"].includes(job) && !ARTIFACTS.some((a) => lead.pack_latest[a]);
  const canHandOver = job !== null && ["waiting_booking", "queued", "retry_scheduled", "failed", "paused"].includes(job);
  const problems = String(sp.p ?? "")
    .split(",")
    .filter((k) => k in p.problems);
  const explanation =
    state === "not_started"
      ? p.notStarted
      : state === "preparing"
        ? p.preparing
        : state === "needs_manual"
          ? p.manualReasons[manualReason({ job, artifacts: lead.pack_latest, automation: auto })]
          : null;

  return (
    <>
      <Notice n={sp.n} e={sp.e} t={t.crm} />
      {problems.length > 0 && (
        <ul className="mt-0 mb-5 rounded-xl border border-red-200 bg-red-50 py-3 ps-8 pe-4 text-[13.5px] text-red-900" data-pack-problems>
          {problems.map((k) => (
            <li key={k}>{p.problems[k]}</li>
          ))}
        </ul>
      )}

      <section aria-labelledby="pack-state-title" id="pack-state" className={`${card} mb-5 p-5 sm:p-6`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="pack-state-title" className="m-0 text-[17px] font-bold tracking-[-0.01em] rtl:tracking-normal">
            {p.title}
          </h2>
          <PackChip state={state} waiting={job === "waiting_booking"} t={t} />
        </div>
        <p className="mt-2 mb-0 text-[13.5px] text-ink-soft">{p.intro}</p>
        {explanation && <p className="mt-3 mb-0 text-[14px]" data-pack-explanation>{explanation}</p>}
        {review && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[14px]" data-review-action>
            {review.owner ? (
              <span className={review.due_on < today ? "font-semibold text-red-800" : ""}>{p.reviewBy(who.ofId(review.owner), formatDay(review.due_on, locale))}</span>
            ) : (
              <Chip tone="attention">{p.reviewUnowned(formatDay(review.due_on, locale))}</Chip>
            )}
            {review.owner !== me.id && (
              <form action={takeReviewAction}>
                <Hidden values={{ inquiryId: id, followUpId: review.id }} />
                <SubmitButton className={`${button} px-3 py-1.5 text-[12.5px]`}>{p.takeReview}</SubmitButton>
              </form>
            )}
          </div>
        )}
        {(canPrepare || canHandOver || detail.automation.length > 0 || !auto.enabled) && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {canPrepare && (
              <form action={prepareNowLeadAction} title={p.prepareNowHelp}>
                <Hidden values={{ inquiryId: id }} />
                <SubmitButton className={primary}>{p.prepareNow}</SubmitButton>
              </form>
            )}
            {canHandOver && (
              <form action={markManualAction}>
                <Hidden values={{ inquiryId: id }} />
                <SubmitButton className={button}>{p.manual}</SubmitButton>
              </form>
            )}
            {detail.automation.map((a) => (
              <form key={a.provider} action={resumeAutomationAction}>
                <Hidden values={{ inquiryId: id, provider: a.provider }} />
                <SubmitButton className={button}>{p.resume(a.provider)}</SubmitButton>
              </form>
            ))}
            {!auto.enabled && <p className="m-0 text-[13px] text-ink-soft">{p.prepareOff}</p>}
          </div>
        )}
      </section>

      <div className="flex flex-col gap-5">
        {ARTIFACTS.map((a) => (
          <ArtifactCard key={a} inquiryId={id} name={a} versions={byArtifact(a)} me={me.email} t={t} locale={locale} nameOf={who.ofEmail} brief={input.brief} nextVersion={nextVersion} />
        ))}

        <section aria-labelledby="claude-title" id="claude" className={`${card} p-5 sm:p-6`} data-manual-claude>
          <h2 id="claude-title" className="m-0 text-[17px] font-bold tracking-[-0.01em] rtl:tracking-normal">
            {p.claude.title}
          </h2>
          <ol className="mt-3 mb-3 list-decimal ps-5 text-[13.5px] leading-relaxed text-ink-soft">
            {p.claude.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <CopyButton text={prompt} label={p.claude.copy} copied={p.claude.copied} failed={p.claude.copyFailed} />
          <details className="group mt-3">
            <summary className={summaryClass}>{p.claude.promptLabel}</summary>
            <pre dir="auto" className="mt-2 max-h-80 overflow-auto rounded-xl bg-canvas p-3 text-[12.5px] leading-relaxed whitespace-pre-wrap" data-manual-prompt>
              {prompt}
            </pre>
          </details>
          <form action={packPasteAction} className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
            <Hidden values={{ inquiryId: id }} />
            <label htmlFor="paste-pack" className="text-[13.5px] font-semibold">
              {p.claude.paste}
            </label>
            <p id="paste-pack-hint" className="m-0 text-[12.5px] text-ink-faint">
              {p.claude.pasteHelp}
            </p>
            <textarea id="paste-pack" name="body" rows={8} required maxLength={60000} dir="ltr" spellCheck={false} aria-describedby="paste-pack-hint" className={`${field} font-mono text-[12.5px]`} />
            <SubmitButton className={`${primary} self-start`}>{p.claude.save}</SubmitButton>
          </form>
        </section>

        <details className={`group ${card} p-5 sm:p-6`} data-audit>
          <summary className={`${summaryClass} text-[15px]`}>{p.audit.title}</summary>
          <p className="mt-2 text-[13px] text-ink-soft">{p.audit.help}</p>
          {lead.last_payload ? (
            <pre dir="ltr" className="max-h-96 overflow-auto rounded-xl bg-canvas p-3 text-[12px] leading-relaxed whitespace-pre-wrap" data-payload>
              {JSON.stringify(lead.last_payload, null, 2)}
            </pre>
          ) : (
            <p className="m-0 text-[13px] text-ink-faint">{p.audit.none}</p>
          )}
        </details>

        {isLocalDashboardDemo() && (
          <section aria-labelledby="demo" className="rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50 p-5">
            <h2 id="demo" className="m-0 text-[15px] font-semibold text-amber-900">
              {t.detail.demo.title}
            </h2>
            <p className="mt-1 mb-3 text-[13px] text-amber-900">{t.detail.demo.body}</p>
            <div className="flex flex-wrap gap-2">
              {(["book", "reschedule", "cancel"] as const).map((kind) => (
                <form key={kind} action={demoBookingAction}>
                  <Hidden values={{ inquiryId: id, kind }} />
                  <SubmitButton className={button}>{t.detail.demo[kind]}</SubmitButton>
                </form>
              ))}
              {(
                [
                  ["mock", t.detail.demo.mock],
                  ["invalid", t.detail.demo.fail],
                  ["quota", t.detail.demo.quota],
                ] as const
              ).map(([outcome, text]) => (
                <form key={outcome} action={demoGenerateAction}>
                  <Hidden values={{ inquiryId: id, outcome }} />
                  <SubmitButton className={button}>{text}</SubmitButton>
                </form>
              ))}
            </div>
          </section>
        )}

        {notes.length > 0 && (
          <details className={`group ${card} p-5 sm:p-6`} data-earlier-notes>
            <summary className={`${summaryClass} text-[15px]`}>{t.detail.draft.earlier(notes.length)}</summary>
            <ul className="mt-3 mb-0 list-none p-0">
              {notes.map((n) => (
                <li key={n.id} className="border-t border-line py-3 first:border-t-0">
                  <p className="m-0 mb-2 text-[12.5px] text-ink-soft">
                    {p.version(n.version)} · {t.lead.reviewStatus[n.review_status]} · {who.ofEmail(n.created_by)}
                  </p>
                  <div dir="auto" className="rounded-xl bg-canvas p-4 text-[14px] leading-[1.8] whitespace-pre-wrap">
                    {draftText(n.content)}
                  </div>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CopyButton from "@/components/dashboard/CopyButton";
import SubmitButton from "@/components/dashboard/SubmitButton";
import { Chip, REVIEW_TONES, button, card, field, formatDate, formatDay, primary, todayInCairo } from "@/components/dashboard/ui";
import Notice from "@/components/crm/Notice";
import { PackChip } from "@/components/crm/LeadParts";
import ArtifactEditor, { type EditorLabels, type EditorOptions } from "@/components/pack/ArtifactEditor";
import { requireAdmin } from "@/lib/admin/auth/state";
import { teamMembers } from "@/lib/admin/auth/config";
import { adminText } from "@/lib/admin/locale";
import type { AdminMessages } from "@/lib/admin/messages";
import { people } from "@/lib/admin/people";
import { automationStatus, isLeadId, loadInquiry, loadLead } from "@/lib/crm/lead-load";
import { designPath, presentPath } from "@/lib/crm/lead-path";
import { packContext, packInput } from "@/lib/crm/pack-input";
import type { DraftRow } from "@/lib/dashboard/data";
import { draftText } from "@/lib/dashboard/brief";
import { EDITOR, PHASE_ROWS, SCREEN_FIELDS, fieldsFrom, optionValues, type OptionSource } from "@/lib/pack/editor";
import { APPROVAL_CHECKLIST, DISCOVERY_BANKS, PATTERNS, PROPOSAL_PATTERNS, type DiscoveryBankId, type PatternId, type ProposalPatternId, type TemplateId } from "@/lib/pack/library";
import { ARTIFACT_NAMES, BASIS_LABELS, FIELD_LABELS, SECTION_LABELS, TEMPLATE_LABELS, type Lang } from "@/lib/pack/labels";
import { directionPack, PACK_PARTS } from "@/lib/pack/presentation";
import { ARTIFACT_SCHEMAS, artifactFindings, artifactProblems, renderableDesign, type ArtifactKind, type PackArtifact, type PackContext } from "@/lib/pack/schema";
import { manualReason, mayApproveArtifact, packState } from "@/lib/pack/state";
import { artifactLanguage, artifactView, compareVersions, legacyArtifactSections } from "@/lib/pack/text";
import { manualPackPrompt } from "@/lib/pack/prompt";
import { demoBookingAction, demoGenerateAction, markManualAction, resumeAutomationAction } from "../../../inquiries/actions";
import { isLocalDashboardDemo } from "@/lib/sql-gateway";
import { packEditAction, packPasteAction, packReviewAction, prepareNowLeadAction, takeReviewAction } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pre-meeting Pack" };

const summaryClass = "flex cursor-pointer list-none items-center gap-2 text-[14px] font-semibold [&::-webkit-details-marker]:hidden";
const BASIS_TONES = { client_fact: "bg-mint/25 text-ink", assumption: "bg-amber-100 text-amber-950", recommendation: "bg-surface-2 text-ink", question: "bg-sky-100 text-sky-950" } as const;

function Hidden({ values }: { values: Record<string, string | number> }) {
  return (
    <>
      {Object.entries(values).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={String(v)} />
      ))}
    </>
  );
}

// One version's content: the structured view with each statement's basis; an
// older format as its headed notes; a free-text version as written.
function VersionBody({ kind, content, locale }: { kind: ArtifactKind; content: unknown; locale: Lang }) {
  const view = artifactView(kind, content, locale);
  const lang = artifactLanguage(content);
  const dir = lang === "ar" ? "rtl" : "ltr";
  if (view) {
    return (
      <div className="flex flex-col gap-4 rounded-xl bg-canvas p-4 text-[14.5px] leading-[1.7]" data-artifact-view>
        {view.map((section) => (
          <section key={section.key} data-section={section.key}>
            <h4 className="m-0 mb-1.5 text-[13px] font-bold text-ink">{SECTION_LABELS[locale][section.key]}</h4>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {section.items.map((item, i) => (
                <li key={i} className="min-w-0">
                  <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    {item.basis && (
                      <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${BASIS_TONES[item.basis]}`} data-basis={item.basis}>
                        {BASIS_LABELS[locale][item.basis]}
                      </span>
                    )}
                    {item.field && item.field !== "screen" && item.field !== "topic" && <span className="text-[12.5px] font-semibold text-ink-soft">{FIELD_LABELS[locale][item.field]}:</span>}
                    <span dir={dir} className="min-w-0">
                      {item.text}
                    </span>
                  </span>
                  {item.note && (
                    <span className="mt-0.5 block text-[13px] text-ink-soft">
                      {FIELD_LABELS[locale][item.note.field]}: <span dir={dir}>{item.note.text}</span>
                    </span>
                  )}
                  {item.lines && (
                    <ul dir={dir} className="mt-1 mb-0 list-disc ps-5 text-[13.5px] text-ink-soft">
                      {item.lines.map((l, j) => (
                        <li key={j}>{l}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  }
  const legacy = legacyArtifactSections(content);
  if (legacy) {
    return (
      <div dir={dir} className="flex flex-col gap-3 rounded-xl bg-canvas p-4 text-[14px] leading-[1.7]" data-artifact-legacy>
        {legacy.map((s) => (
          <section key={s.title}>
            <h4 className="m-0 mb-1 text-[13px] font-bold">{s.title}</h4>
            {s.lines.map((l, i) => (
              <p key={i} className="m-0">
                {l}
              </p>
            ))}
          </section>
        ))}
      </div>
    );
  }
  const c = content as { format?: string; body?: unknown } | null;
  return (
    <div dir="auto" className="rounded-xl bg-canvas p-4 text-[14.5px] leading-[1.8] whitespace-pre-wrap" data-artifact-text>
      {c?.format === "text" && typeof c.body === "string" ? c.body : ""}
    </div>
  );
}

// The checks of a version against the brief, and what the reviewer should know.
function Checks({ kind, content, ctx, t, locale }: { kind: ArtifactKind; content: unknown; ctx: PackContext; t: AdminMessages; locale: Lang }) {
  const p = t.pack;
  const parsed = ARTIFACT_SCHEMAS[kind].safeParse(content);
  if (!parsed.success)
    return (
      <p className="m-0 mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13.5px] text-amber-950" data-checks="legacy">
        {p.checks.notChecked}
      </p>
    );
  const problems = artifactProblems(kind, parsed.data as PackArtifact, ctx);
  const findings = artifactFindings(kind, content);
  const sectionName = (s: string) => (s in SECTION_LABELS[locale] ? ` (${SECTION_LABELS[locale][s as keyof (typeof SECTION_LABELS)["en"]]})` : "");
  return (
    <div className="mb-3 flex flex-col gap-2" data-checks={problems.length ? "problems" : "passed"}>
      {problems.length === 0 ? (
        <p className="m-0 rounded-xl border border-mint/50 bg-mint/10 px-3 py-2 text-[13px]">{p.checks.passed}</p>
      ) : (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-[13.5px] text-red-900">
          <p className="m-0 font-semibold">{p.checks.problems}</p>
          <ul className="mt-1 mb-0 ps-5">
            {[...new Set(problems.map((x) => x.kind))].map((k) => (
              <li key={k}>{p.problems[k]}</li>
            ))}
          </ul>
        </div>
      )}
      {findings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13.5px] text-amber-950" data-findings>
          <p className="m-0 font-semibold">{p.checks.findings}</p>
          <ul className="mt-1 mb-0 ps-5">
            {findings.map((f, i) => (
              <li key={i} data-finding={f.kind}>
                {p.findings[f.kind]}
                {"count" in f ? p.findingCount(f.count) : ""}
                {"section" in f ? sectionName(f.section) : ""}
                {f.kind === "placeholder" || f.kind === "hand_design" ? ` ${p.checks.blocks}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const template = (format: (i: number) => string) => format(0).replace("1", "{n}");

function editorLabels(t: AdminMessages, locale: Lang, help: string): EditorLabels {
  const e = t.pack.editor;
  return {
    sections: { ...SECTION_LABELS[locale] },
    fields: e.fields,
    problems: t.pack.problems,
    row: template(e.row),
    screen: template(e.screen),
    screenItem: template(e.screenItem),
    phases: e.phases,
    choose: e.choose,
    noPattern: e.noPattern,
    help,
    save: e.save,
    failed: e.failed,
  };
}

function editorOptions(t: AdminMessages, locale: Lang, projectType: string | null, pattern: string | null): EditorOptions {
  const label = (source: OptionSource, v: string): string => {
    switch (source) {
      case "basis":
        return t.pack.editor.basis[v as "client_fact" | "assumption"];
      case "bank":
        return DISCOVERY_BANKS[v as DiscoveryBankId][locale];
      case "pattern":
        return PATTERNS[v as PatternId][locale];
      case "proposal_pattern":
        return PROPOSAL_PATTERNS[v as ProposalPatternId][locale];
      case "template":
        return TEMPLATE_LABELS[locale][v as TemplateId];
      case "screen":
        return t.pack.editor.screen(Number(v.slice(1)) - 1);
    }
  };
  const sources: OptionSource[] = ["basis", "bank", "pattern", "proposal_pattern", "template", "screen"];
  return Object.fromEntries(sources.map((s) => [s, optionValues(s, projectType, pattern).map((v) => ({ value: v, label: label(s, v) }))])) as EditorOptions;
}

function ArtifactArea({
  inquiryId,
  kind,
  versions,
  me,
  t,
  locale,
  nameOf,
  ctx,
  projectType,
  nextVersion,
}: {
  inquiryId: string;
  kind: ArtifactKind;
  versions: DraftRow[];
  me: string;
  t: AdminMessages;
  locale: Lang;
  nameOf: (email: string) => string;
  ctx: PackContext;
  projectType: string | null;
  nextVersion: number;
}) {
  const p = t.lead.detail.pack;
  const q = t.pack;
  const latest = versions[0] ?? null;
  const previous = versions[1] ?? null;
  const earlier = versions.slice(1);
  const design = kind === "design" && latest ? renderableDesign(latest.content) : null;
  const current = latest && ARTIFACT_SCHEMAS[kind].safeParse(latest.content).success ? latest.content : null;
  const who = (email: string) => (email === "automation" ? "" : nameOf(email));
  const change = latest && previous ? compareVersions(kind, previous.content, latest.content, locale) : null;
  const pattern = current && kind === "design" ? ((current as { blueprint: { pattern: string | null } }).blueprint.pattern ?? null) : null;

  return (
    <section aria-labelledby={`artifact-${kind}-title`} id={`artifact-${kind}`} className={`${card} p-5 sm:p-6`} data-artifact={kind}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`artifact-${kind}-title`} className="m-0 text-[17px] font-bold tracking-[-0.01em] rtl:tracking-normal">
          {ARTIFACT_NAMES[locale][kind]}
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

      {kind === "proposal" && (
        <p className="m-0 mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13.5px] font-semibold text-amber-950" data-proposal-label>
          {p.proposalLabel}
        </p>
      )}

      {latest ? (
        <article data-version={latest.version}>
          <p className="m-0 mb-3 flex flex-wrap gap-x-2 text-[12.5px] text-ink-soft">
            <span data-source={latest.source}>{t.lead.sources[latest.source] ?? latest.source}</span>
            <span aria-hidden>·</span>
            <span>{who(latest.created_by) ? q.meta.author(who(latest.created_by)) : q.meta.automated}</span>
            <span aria-hidden>·</span>
            <span>{formatDate(latest.created_at, true, locale)}</span>
            {latest.model ? <span dir="ltr">· {latest.model}</span> : null}
            {latest.reviewed_by && latest.reviewed_at && (
              <>
                <span aria-hidden>·</span>
                <span data-reviewer>{q.meta.reviewed(nameOf(latest.reviewed_by), formatDate(latest.reviewed_at, true, locale))}</span>
              </>
            )}
          </p>
          <Checks kind={kind} content={latest.content} ctx={ctx} t={t} locale={locale} />
          {design && (
            <p className="m-0 mb-3">
              <Link href={designPath(inquiryId, latest.version)} className={primary} data-open-preview>
                {p.openPreview}
              </Link>
            </p>
          )}
          <VersionBody kind={kind} content={latest.content} locale={locale} />

          {change && previous && (
            <details className="group mt-3 rounded-xl border border-line p-3" data-changes>
              <summary className={summaryClass}>{q.changes.title(previous.version)}</summary>
              {change.added.length + change.removed.length === 0 ? (
                <p className="mt-2 mb-0 text-[13px] text-ink-soft">{q.changes.none}</p>
              ) : (
                <div className="mt-2 grid gap-3 text-[13px] sm:grid-cols-2">
                  <div>
                    <p className="m-0 mb-1 font-semibold text-mint-deep">{q.changes.added}</p>
                    <ul className="m-0 ps-5" data-added>
                      {change.added.map((l, i) => (
                        <li key={i} dir="auto">
                          {l}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="m-0 mb-1 font-semibold text-red-800">{q.changes.removed}</p>
                    <ul className="m-0 ps-5" data-removed>
                      {change.removed.map((l, i) => (
                        <li key={i} dir="auto" className="line-through decoration-red-300">
                          {l}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </details>
          )}

          <div className="mt-4 flex flex-wrap items-start gap-2">
            {latest.review_status === "draft" && (
              <form action={packReviewAction}>
                <Hidden values={{ inquiryId, artifact: kind, version: latest.version, to: "in_review" }} />
                <SubmitButton className={primary}>{p.markReady}</SubmitButton>
              </form>
            )}
            {latest.review_status === "in_review" && (
              <>
                {mayApproveArtifact(latest, me) ? (
                  <form action={packReviewAction} className="w-full rounded-xl border border-line p-3" data-approve-form>
                    <Hidden values={{ inquiryId, artifact: kind, version: latest.version, to: "approved" }} />
                    <p className="m-0 mb-1 text-[13px] font-semibold">{q.approve.checklist}</p>
                    <ul className="m-0 mb-2 ps-5 text-[13px] text-ink-soft" data-checklist>
                      {APPROVAL_CHECKLIST.map((c) => (
                        <li key={c.id}>{c[locale]}</li>
                      ))}
                    </ul>
                    <label className="mb-3 flex items-center gap-2 text-[13.5px] font-semibold">
                      <input type="checkbox" name="checked" value="1" required className="size-4" />
                      {q.approve.confirm}
                    </label>
                    <SubmitButton className={primary}>{p.approve}</SubmitButton>
                  </form>
                ) : (
                  <p data-waiting-for-teammate className="m-0 self-center rounded-xl bg-surface-2/70 px-3 py-2 text-[13.5px] text-ink-soft">
                    {p.waitingForTeammate}
                  </p>
                )}
                <form action={packReviewAction}>
                  <Hidden values={{ inquiryId, artifact: kind, version: latest.version, to: "draft" }} />
                  <SubmitButton className={button}>{p.sendBack}</SubmitButton>
                </form>
              </>
            )}
            {latest.review_status === "approved" && (
              <form action={packReviewAction}>
                <Hidden values={{ inquiryId, artifact: kind, version: latest.version, to: "draft" }} />
                <SubmitButton className={button}>{p.withdraw}</SubmitButton>
              </form>
            )}
          </div>
        </article>
      ) : (
        <p className="m-0 rounded-xl border border-dashed border-ink/20 p-4 text-[14px] text-ink-soft">{p.empty}</p>
      )}

      <details className="group mt-4 border-t border-line pt-4" data-edit>
        <summary className={summaryClass}>{latest ? q.editor.open : q.editor.write}</summary>
        <ArtifactEditor
          action={packEditAction}
          inquiryId={inquiryId}
          kind={kind}
          source={latest ? "edited" : "manual"}
          spec={EDITOR[kind]}
          phases={PHASE_ROWS}
          screens={SCREEN_FIELDS}
          initial={current ? fieldsFrom(kind, current) : {}}
          labels={editorLabels(t, locale, q.editor.help(nextVersion))}
          options={editorOptions(t, locale, projectType, pattern)}
        />
      </details>

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
                  {kind === "design" && renderableDesign(v.content) && (
                    <Link href={designPath(inquiryId, v.version)} className="font-semibold underline decoration-mint decoration-2 underline-offset-4">
                      {p.openPreview}
                    </Link>
                  )}
                </span>
                <details className="mt-1">
                  <summary className="cursor-pointer text-[12.5px] text-ink-soft">{p.version(v.version)}</summary>
                  <div className="mt-2">
                    <VersionBody kind={kind} content={v.content} locale={locale} />
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

function DirectionPackCard({ inquiryId, drafts, ctx, t, locale }: { inquiryId: string; drafts: DraftRow[]; ctx: PackContext; t: AdminMessages; locale: Lang }) {
  const d = t.pack.direction;
  const parts = drafts.filter((x) => x.artifact && x.artifact !== "note");
  const approved = directionPack(parts, ctx, "approved");
  const preview = directionPack(parts, ctx, "preview");
  return (
    <section aria-labelledby="direction-pack-title" id="direction-pack" className={`${card} mb-5 p-5 sm:p-6`} data-direction-pack-card={approved.ok ? "ready" : "not-ready"}>
      <h2 id="direction-pack-title" className="m-0 text-[17px] font-bold tracking-[-0.01em] rtl:tracking-normal">
        {d.title}
      </h2>
      <p className="mt-2 mb-3 text-[13.5px] text-ink-soft">{d.intro}</p>
      {approved.ok ? (
        <>
          <p className="m-0 font-semibold text-mint-deep">{d.ready}</p>
          <p className="mt-1 mb-0 text-[13.5px]">{d.readyBody(approved.source.versions.design, approved.source.versions.proposal, approved.source.versions.discovery)}</p>
          {approved.source.newerDraft && <p className="mt-1 mb-0 text-[13px] text-amber-900">{d.newerDraft}</p>}
        </>
      ) : (
        <>
          <p className="m-0 font-semibold">{d.notReady}</p>
          <ul className="mt-1 mb-0 ps-5 text-[13.5px]" data-blockers>
            {approved.blockers.map((b) => (
              <li key={`${b.part}-${b.reason}`} data-blocker={b.reason}>
                {d.reasons[b.reason](ARTIFACT_NAMES[locale][b.part])}
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {approved.ok && (
          <Link href={presentPath(inquiryId)} className={primary} data-present>
            {d.present}
          </Link>
        )}
        {preview.ok ? (
          <Link href={presentPath(inquiryId, true)} className={button} data-preview title={d.previewHelp}>
            {d.preview}
          </Link>
        ) : (
          <span className="text-[13px] text-ink-soft">{d.noPreview}</span>
        )}
      </div>
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
  // The manual prompt carries the brief only, with the client's contact details removed.
  const input = packInput(detail.inquiry, lead.budget_currency);
  const ctx = packContext(input);
  const prompt = manualPackPrompt(input);
  const byArtifact = (a: ArtifactKind) => detail.drafts.filter((d) => d.artifact === a);
  const notes = detail.drafts.filter((d) => !d.artifact || d.artifact === "note");
  // Versions are numbered per lead, across the three parts.
  const nextVersion = Math.max(0, ...detail.drafts.map((d) => d.version)) + 1;
  const review = lead.review_action;
  const working = job === "running";
  const canPrepare = auto.enabled && !auto.paused && !working && job !== null && ["waiting_booking", "queued", "retry_scheduled", "failed", "paused", "manual"].includes(job) && !PACK_PARTS.some((a) => lead.pack_latest[a]);
  const canHandOver = job !== null && ["waiting_booking", "queued", "retry_scheduled", "failed", "paused"].includes(job);
  const problems = String(sp.p ?? "")
    .split(",")
    .filter((k): k is keyof typeof t.pack.problems => k in t.pack.problems);
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
            <li key={k}>{t.pack.problems[k]}</li>
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

      <DirectionPackCard inquiryId={id} drafts={detail.drafts} ctx={ctx} t={t} locale={locale} />

      <div className="flex flex-col gap-5">
        {PACK_PARTS.map((a) => (
          <ArtifactArea key={a} inquiryId={id} kind={a} versions={byArtifact(a)} me={me.email} t={t} locale={locale} nameOf={who.ofEmail} ctx={ctx} projectType={input.projectType} nextVersion={nextVersion} />
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

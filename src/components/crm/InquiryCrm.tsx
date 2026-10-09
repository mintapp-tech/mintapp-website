import Link from "next/link";
import SubmitButton from "@/components/dashboard/SubmitButton";
import { Chip, button, field, formatDate, formatDay, primary, type ChipTone } from "@/components/dashboard/ui";
import type { AdminLocale, AdminMessages } from "@/lib/admin/messages";
import type { TeamMember } from "@/lib/admin/auth/config";
import { people } from "@/lib/admin/people";
import {
  convertAction,
  createFromInquiryAction,
  linkCompanyAction,
  proposalMoveAction,
  reviseProposalAction,
  saveDetailsAction,
  saveProposalAction,
  setStageAction,
  startProposalAction,
} from "@/app/(admin)/(workspace)/inquiries/crm-actions";
import { CURRENCIES, FIT_TIERS, LEAD_ORIGINS, LOSS_REASONS, STAGES, type CompanyRow, type InquiryExtra, type Proposal } from "@/lib/crm/types";
import { Empty, Panel, StageChip, linkClass, smallMuted } from "./parts";
import { ScoreFields, SelectField, TextAreaField, TextField, optionsOf } from "./Fields";

// The CRM sections of an inquiry's page. Each is a server component whose
// forms post to a server action that re-checks the signed-in member.

interface Ctx {
  inquiryId: string;
  extra: InquiryExtra;
  t: AdminMessages;
  locale: AdminLocale;
  members: TeamMember[];
  me: TeamMember;
}

function Hidden({ values }: { values: Record<string, string> }) {
  return (
    <>
      {Object.entries(values).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </>
  );
}

const summaryClass = "flex cursor-pointer list-none items-center gap-2 text-[14px] font-semibold [&::-webkit-details-marker]:hidden";

// ----- Stage

export function StagePanel({ inquiryId, extra, t, locale, members }: Pick<Ctx, "inquiryId" | "extra" | "t" | "locale" | "members">) {
  const s = t.crm.stage;
  const q = extra.qualification;
  const who = people(members);
  return (
    <Panel title={s.title} id="stage" aside={<StageChip stage={extra.stage} t={t.crm} />}>
      <p className="mt-0 mb-3 text-[13px] text-ink-soft">{s.help}</p>
      <p className="m-0 mb-4 text-[13px] text-ink-soft" data-stage-facts>
        {s.since(formatDate(extra.stage_changed_at, false, locale))}
        {extra.stage === "lost" && q.loss_reason ? ` · ${s.lostBecause(t.crm.lossReasons[q.loss_reason] ?? q.loss_reason)}` : ""}
        {extra.stage === "paused" && q.paused_until ? ` · ${s.pausedTill(formatDay(q.paused_until, locale))}` : ""}
        {extra.stage === "won" && q.won_at ? ` · ${s.wonOn(formatDate(q.won_at, false, locale))}` : ""}
      </p>
      <form action={setStageAction} className="flex flex-col gap-3">
        <Hidden values={{ inquiryId }} />
        <SelectField id="stage-select" name="stage" text={s.change} defaultValue={extra.stage} options={STAGES.map((v) => ({ value: v, label: t.crm.stages[v] }))} required />
        <SelectField id="stage-reason" name="reason" text={s.lossReason} blank={s.chooseReason} defaultValue={q.loss_reason} options={LOSS_REASONS.map((v) => ({ value: v, label: t.crm.lossReasons[v] }))} />
        <TextField id="stage-note" name="note" text={s.note} placeholder={s.notePlaceholder} maxLength={500} defaultValue={q.loss_note} />
        <TextField id="stage-paused" name="pausedUntil" type="date" text={s.pausedUntil} defaultValue={q.paused_until} />
        <SubmitButton className={`${primary} self-start`}>{s.submit}</SubmitButton>
      </form>
      <details className="group mt-4 border-t border-line pt-3">
        <summary className={summaryClass}>{s.history}</summary>
        {extra.stage_history.length === 0 ? (
          <p className="mt-2 mb-0 text-[13px] text-ink-faint">{s.noHistory}</p>
        ) : (
          <ul className="mt-2 mb-0 list-none p-0 text-[13px]" data-stage-history>
            {extra.stage_history.map((h) => (
              <li key={`${h.at}-${h.to}`} className="border-t border-line py-2 first:border-t-0">
                <span className="font-semibold">{s.changed(h.from ? (t.crm.stages[h.from as keyof typeof t.crm.stages] ?? h.from) : "–", t.crm.stages[h.to as keyof typeof t.crm.stages] ?? h.to)}</span>
                <span className="block text-[12px] text-ink-faint">
                  {who.ofEmail(h.by)} · {formatDate(h.at, true, locale)}
                  {h.reason ? ` · ${t.crm.lossReasons[h.reason as keyof typeof t.crm.lossReasons] ?? h.reason}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </details>
    </Panel>
  );
}

// ----- Source and qualification

export function SourcePanel({ inquiryId, extra, t }: Pick<Ctx, "inquiryId" | "extra" | "t">) {
  const s = t.crm.source;
  const src = extra.source;
  const q = extra.qualification;
  const received: [string, string | null][] = [
    [s.channel, src.utm_source],
    [s.medium, src.utm_medium],
    [s.campaign, src.utm_campaign],
    [s.content, src.utm_content],
    [s.referral, src.referral_source],
    [s.page, src.source_page],
  ];
  const any = received.some(([, v]) => v);
  return (
    <Panel title={s.title} id="source" aside={q.lead_score !== null ? <Chip tone={q.lead_score >= 10 ? "ok" : "neutral"}>{t.crm.score.total(q.lead_score)}</Chip> : null}>
      <p className="mt-0 mb-3 text-[13px] text-ink-soft">{s.help}</p>
      <h3 className="m-0 text-[11.5px] font-bold tracking-[0.08em] text-ink-faint uppercase rtl:text-[12.5px] rtl:tracking-normal">{s.received}</h3>
      {any ? (
        <dl className="mt-2 mb-4 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1 text-[13.5px]" data-tracked-source>
          {received
            .filter(([, v]) => v)
            .map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-ink-soft">{label}</dt>
                <dd className="m-0 font-medium break-words" dir="ltr">
                  {value}
                </dd>
              </div>
            ))}
        </dl>
      ) : (
        <p className="mt-2 mb-4 text-[13.5px] text-ink-soft">{s.direct}</p>
      )}
      <form action={saveDetailsAction} className="flex flex-col gap-3">
        <Hidden values={{ inquiryId }} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelectField id="src-origin" name="lead_origin" text={s.origin} defaultValue={src.lead_origin} options={optionsOf(t.crm.origins, LEAD_ORIGINS)} />
          <SelectField id="src-fit" name="fit_tier" text={s.fit} defaultValue={q.fit_tier} blank={s.unknown} options={optionsOf(t.crm.fitTiers, FIT_TIERS)} />
        </div>
        <TextField id="src-partner" name="referral_partner" text={s.partner} hint={s.partnerHelp} defaultValue={src.referral_partner} maxLength={120} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField id="src-campaign" name="campaign" text={s.campaignOverride} defaultValue={src.campaign} maxLength={120} ltr />
          <TextField id="src-content" name="content_id" text={s.contentOverride} defaultValue={src.content_id} maxLength={120} ltr />
        </div>
        <TextField id="src-trigger" name="trigger_note" text={s.trigger} hint={s.triggerHelp} defaultValue={q.trigger_note} maxLength={500} />
        <TextAreaField id="src-research" name="research_note" text={s.research} defaultValue={q.research_note} rows={3} maxLength={2000} />
        <ScoreFields idPrefix="src-score" score={q.score} t={t.crm.score} />
        <SubmitButton className={`${primary} self-start`}>{s.submit}</SubmitButton>
      </form>
    </Panel>
  );
}

// ----- Company and contact

export function LinkPanel({ inquiryId, extra, t, companies, hasCompanyName }: Pick<Ctx, "inquiryId" | "extra" | "t"> & { companies: CompanyRow[]; hasCompanyName: boolean }) {
  const l = t.crm.linkCard;
  const d = extra.duplicates;
  const duplicates = d.contacts.length + d.companies.length + d.inquiries.length;
  const companyOptions = companies.map((c) => ({ value: c.id, label: c.name }));
  return (
    <Panel title={l.title} id="company">
      <p className="mt-0 mb-3 text-[13px] text-ink-soft">{l.help}</p>
      <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-[14px]">
        <dt className="text-ink-soft">{l.company}</dt>
        <dd className="m-0" data-linked-company>
          {extra.company ? (
            <Link href={`/companies/${extra.company.id}`} className={linkClass}>
              <bdi>{extra.company.name}</bdi>
            </Link>
          ) : (
            <span className="text-ink-faint">{l.none}</span>
          )}
        </dd>
        <dt className="text-ink-soft">{l.contact}</dt>
        <dd className="m-0" data-linked-contact>
          {extra.contact ? (
            <span className="flex flex-wrap items-center gap-2">
              <Link href={`/contacts/${extra.contact.id}`} className={linkClass}>
                <bdi>{extra.contact.name}</bdi>
              </Link>
              <span className={smallMuted}>{l.consent(t.crm.consent[extra.contact.consent_status])}</span>
              {extra.contact.do_not_contact && <Chip tone="attention">{l.doNotContact}</Chip>}
            </span>
          ) : (
            <span className="text-ink-faint">{l.none}</span>
          )}
        </dd>
      </dl>

      {!extra.contact && (
        <form action={createFromInquiryAction} className="mt-4 flex flex-col gap-3 rounded-xl bg-surface-2/60 p-3.5">
          <Hidden values={{ inquiryId }} />
          <p className="m-0 text-[13px] text-ink-soft">{l.createHelp}</p>
          <SelectField
            id="create-mode"
            name="companyMode"
            text={l.company}
            defaultValue={hasCompanyName ? "new" : "none"}
            options={[
              { value: "none", label: l.noCompany },
              ...(hasCompanyName ? [{ value: "new", label: l.withCompany }] : []),
              ...(companyOptions.length ? [{ value: "existing", label: l.existingCompany }] : []),
            ]}
          />
          {companyOptions.length > 0 && <SelectField id="create-company" name="companyId" text={l.existingCompany} blank={l.chooseCompany} options={companyOptions} />}
          <SubmitButton className={`${primary} self-start`}>{l.create}</SubmitButton>
        </form>
      )}

      {extra.contact && companyOptions.length > 0 && (
        <form action={linkCompanyAction} className="mt-4 flex flex-wrap items-end gap-3">
          <Hidden values={{ inquiryId }} />
          <div className="min-w-[14rem] flex-1">
            <SelectField id="link-company" name="companyId" text={l.linkExisting} defaultValue={extra.company?.id ?? ""} blank={l.noCompany} options={companyOptions} />
          </div>
          <SubmitButton className={button}>{l.linkSubmit}</SubmitButton>
        </form>
      )}

      {duplicates > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-[13.5px] text-amber-950" data-duplicates>
          <p className="m-0 font-semibold">{l.possibleDuplicates}</p>
          <p className="m-0 mt-1 text-[12.5px]">{l.duplicatesHelp}</p>
          <ul className="mt-2 mb-0 list-none p-0">
            {d.contacts.map((c) => (
              <li key={c.id}>
                {l.sameContact}:{" "}
                <Link href={`/contacts/${c.id}`} className={linkClass}>
                  <bdi>{c.name}</bdi>
                </Link>
                {c.company ? ` · ${c.company}` : ""}
              </li>
            ))}
            {d.companies.map((c) => (
              <li key={c.id}>
                {l.sameCompany}:{" "}
                <Link href={`/companies/${c.id}`} className={linkClass}>
                  <bdi>{c.name}</bdi>
                </Link>
              </li>
            ))}
            {d.inquiries.map((i) => (
              <li key={i.id}>
                {l.sameClient}:{" "}
                <Link href={`/leads/${i.id}`} className={linkClass}>
                  <bdi>{i.client_name}</bdi>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

// ----- Proposal and scope

function ProposalFields({ p, prefix, t }: { p: Partial<Proposal> | null; prefix: string; t: AdminMessages }) {
  const f = t.crm.proposals.fields;
  return (
    <div className="flex flex-col gap-3">
      <TextAreaField id={`${prefix}-summary`} name="summary" text={f.summary} defaultValue={p?.summary} rows={2} maxLength={2000} />
      <TextAreaField id={`${prefix}-scope`} name="recommended_scope" text={f.recommended_scope} defaultValue={p?.recommended_scope} rows={4} maxLength={6000} />
      <TextAreaField id={`${prefix}-deliverables`} name="deliverables" text={f.deliverables} defaultValue={p?.deliverables} rows={3} maxLength={4000} />
      <TextAreaField id={`${prefix}-exclusions`} name="exclusions" text={f.exclusions} defaultValue={p?.exclusions} rows={3} maxLength={4000} />
      <TextAreaField id={`${prefix}-assumptions`} name="assumptions" text={f.assumptions} defaultValue={p?.assumptions} rows={3} maxLength={4000} />
      <div className="grid grid-cols-2 gap-3">
        <TextField id={`${prefix}-wmin`} name="timeline_weeks_min" text={f.timelineMin} type="number" min={1} defaultValue={p?.timeline_weeks_min} />
        <TextField id={`${prefix}-wmax`} name="timeline_weeks_max" text={f.timelineMax} type="number" min={1} defaultValue={p?.timeline_weeks_max} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <TextField id={`${prefix}-pmin`} name="price_min" text={f.priceMin} type="number" min={0} defaultValue={p?.price_min} ltr />
        <TextField id={`${prefix}-pmax`} name="price_max" text={f.priceMax} type="number" min={0} defaultValue={p?.price_max} ltr />
        <SelectField id={`${prefix}-currency`} name="currency" text={f.currency} blank="–" defaultValue={p?.currency} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
      </div>
      <TextAreaField id={`${prefix}-pricenotes`} name="price_notes" text={f.priceNotes} defaultValue={p?.price_notes} rows={2} maxLength={1000} />
    </div>
  );
}

const PROPOSAL_TONES: Record<string, ChipTone> = { draft: "neutral", internal_review: "info", approved: "ok", sent: "info", accepted: "ok", rejected: "attention", withdrawn: "neutral", superseded: "neutral" };

function ProposalView({ p, t, locale }: { p: Proposal; t: AdminMessages; locale: AdminLocale }) {
  const f = t.crm.proposals.fields;
  const money = (n: number | string | null) => (n === null ? null : new Intl.NumberFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { maximumFractionDigits: 2 }).format(Number(n)));
  const price = p.price_min !== null || p.price_max !== null ? [money(p.price_min), money(p.price_max)].filter(Boolean).join(" – ") + (p.currency ? ` ${p.currency}` : "") : null;
  const rows: [string, string | null][] = [
    [f.summary, p.summary],
    [f.recommended_scope, p.recommended_scope],
    [f.deliverables, p.deliverables],
    [f.exclusions, p.exclusions],
    [f.assumptions, p.assumptions],
    [f.timeline, p.timeline_weeks_min || p.timeline_weeks_max ? t.crm.proposals.weeks(p.timeline_weeks_min, p.timeline_weeks_max) : null],
    [f.price, price],
    [f.priceNotes, p.price_notes],
  ];
  return (
    <dl className="m-0 grid grid-cols-1 gap-3 text-[14px]">
      {rows
        .filter(([, v]) => v)
        .map(([label, value]) => (
          <div key={label}>
            <dt className="text-[12.5px] font-semibold text-ink-soft">{label}</dt>
            <dd dir="auto" className="m-0 mt-0.5 leading-relaxed whitespace-pre-wrap">
              {value}
            </dd>
          </div>
        ))}
    </dl>
  );
}

function MoveButton({ inquiryId, proposalId, to, label, tone = "button", note }: { inquiryId: string; proposalId: string; to: string; label: string; tone?: "button" | "primary"; note?: boolean }) {
  return (
    <form action={proposalMoveAction} className="flex flex-wrap items-end gap-2">
      <Hidden values={{ inquiryId, proposalId, to }} />
      {note && (
        <div className="min-w-[12rem]">
          <input name="note" maxLength={1000} dir="auto" aria-label="Note" className={field} />
        </div>
      )}
      <SubmitButton className={tone === "primary" ? primary : button}>{label}</SubmitButton>
    </form>
  );
}

export function ProposalPanel({ inquiryId, extra, t, locale, members, me }: Ctx) {
  const pt = t.crm.proposals;
  const who = people(members);
  const live = extra.proposals.find((p) => p.status !== "superseded") ?? null;
  const earlier = extra.proposals.filter((p) => p !== live);
  const canApprove = live ? live.status === "internal_review" && live.created_by.toLowerCase() !== me.email.toLowerCase() && live.updated_by.toLowerCase() !== me.email.toLowerCase() : false;
  const when = (iso: string) => formatDate(iso, true, locale);

  return (
    <Panel title={pt.title} id="proposal" aside={live ? <Chip tone={PROPOSAL_TONES[live.status]} data-proposal-status={live.status}>{t.crm.proposalStatuses[live.status]}</Chip> : null}>
      <p className="mt-0 mb-4 text-[13px] text-ink-soft">{pt.help}</p>

      {!live ? (
        <>
          <Empty>{pt.none}</Empty>
          <details className="group mt-4">
            <summary className={summaryClass}>{pt.start}</summary>
            <form action={startProposalAction} className="mt-3 flex flex-col gap-3">
              <Hidden values={{ inquiryId }} />
              <ProposalFields p={null} prefix="new-proposal" t={t} />
              <SubmitButton className={`${primary} self-start`}>{pt.saveDraft}</SubmitButton>
            </form>
          </details>
        </>
      ) : (
        <article data-proposal-version={live.version}>
          <p className="m-0 mb-3 text-[13px] text-ink-soft">
            {pt.version(live.version)} · {t.crm.common.by(who.ofEmail(live.updated_by))} · {when(live.updated_at)}
          </p>

          {live.status === "draft" ? (
            <form action={saveProposalAction} className="flex flex-col gap-3">
              <Hidden values={{ inquiryId, proposalId: live.id }} />
              <ProposalFields p={live} prefix="edit-proposal" t={t} />
              <SubmitButton className={`${button} self-start`}>{pt.saveEdits}</SubmitButton>
            </form>
          ) : (
            <ProposalView p={live} t={t} locale={locale} />
          )}

          {live.approved_by && live.approved_at && <p className="mt-3 mb-0 text-[13px] text-ink-soft">{pt.approvedBy(who.ofEmail(live.approved_by), when(live.approved_at))}</p>}
          {live.sent_by && live.sent_at && <p className="mt-1 mb-0 text-[13px] text-ink-soft">{pt.sentBy(who.ofEmail(live.sent_by), when(live.sent_at))}</p>}
          {live.decided_by && live.decided_at && (
            <p className="mt-1 mb-0 text-[13px] text-ink-soft">
              {pt.decided(who.ofEmail(live.decided_by), when(live.decided_at))}
              {live.decision_note ? ` · ${live.decision_note}` : ""}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-end gap-2">
            {live.status === "draft" && (
              <>
                <MoveButton inquiryId={inquiryId} proposalId={live.id} to="internal_review" label={pt.submitReview} tone="primary" />
                <MoveButton inquiryId={inquiryId} proposalId={live.id} to="withdrawn" label={pt.withdraw} />
              </>
            )}
            {live.status === "internal_review" && (
              <>
                {canApprove ? (
                  <MoveButton inquiryId={inquiryId} proposalId={live.id} to="approved" label={pt.approve} tone="primary" />
                ) : (
                  <p data-waiting-for-teammate className="m-0 self-center rounded-xl bg-surface-2/70 px-3 py-2 text-[13.5px] text-ink-soft">
                    {pt.needsTeammate}
                  </p>
                )}
                <MoveButton inquiryId={inquiryId} proposalId={live.id} to="draft" label={pt.sendBack} />
                <MoveButton inquiryId={inquiryId} proposalId={live.id} to="withdrawn" label={pt.withdraw} />
              </>
            )}
            {live.status === "approved" && (
              <>
                <div className="flex flex-col gap-1">
                  <MoveButton inquiryId={inquiryId} proposalId={live.id} to="sent" label={pt.markSent} tone="primary" />
                  <p className="m-0 text-[12.5px] text-ink-faint">{pt.markSentHelp}</p>
                </div>
                <MoveButton inquiryId={inquiryId} proposalId={live.id} to="withdrawn" label={pt.withdraw} />
              </>
            )}
            {live.status === "sent" && (
              <>
                <MoveButton inquiryId={inquiryId} proposalId={live.id} to="accepted" label={pt.accept} tone="primary" note />
                <MoveButton inquiryId={inquiryId} proposalId={live.id} to="rejected" label={pt.reject} note />
                <MoveButton inquiryId={inquiryId} proposalId={live.id} to="withdrawn" label={pt.withdraw} />
              </>
            )}
          </div>

          {live.status !== "draft" && (
            <details className="group mt-4 border-t border-line pt-3">
              <summary className={summaryClass}>{pt.revise}</summary>
              <form action={reviseProposalAction} className="mt-3 flex flex-col gap-3">
                <Hidden values={{ inquiryId }} />
                <p className="m-0 text-[13px] text-ink-soft">{pt.reviseHelp}</p>
                <ProposalFields p={live} prefix="revise-proposal" t={t} />
                <SubmitButton className={`${button} self-start`}>{pt.revise}</SubmitButton>
              </form>
            </details>
          )}
        </article>
      )}

      {earlier.length > 0 && (
        <details className="group mt-4 border-t border-line pt-3">
          <summary className={summaryClass}>{pt.history(earlier.length)}</summary>
          <ul className="mt-2 mb-0 list-none p-0 text-[13px]">
            {earlier.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 border-t border-line py-2 first:border-t-0">
                <Chip>{pt.version(p.version)}</Chip>
                <Chip tone={PROPOSAL_TONES[p.status]}>{t.crm.proposalStatuses[p.status]}</Chip>
                <span className="text-ink-soft">
                  {who.ofEmail(p.created_by)} · {when(p.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Panel>
  );
}

// ----- Conversion to a project

export function ConversionPanel({ inquiryId, extra, t }: Pick<Ctx, "inquiryId" | "extra" | "t">) {
  const c = t.crm.conversion;
  return (
    <Panel title={c.title} id="conversion">
      <p className="mt-0 mb-3 text-[13px] text-ink-soft">{c.help}</p>
      {extra.project ? (
        <p className="m-0 flex flex-wrap items-center gap-2 text-[14px]" data-project>
          <Chip tone="ok">{c.exists}</Chip>
          <Link href={`/projects/${extra.project.id}`} className={linkClass}>
            <bdi>{extra.project.name}</bdi>
          </Link>
        </p>
      ) : extra.stage === "won" ? (
        <form action={convertAction} className="flex flex-col gap-3">
          <Hidden values={{ inquiryId }} />
          <TextField id="project-name" name="name" text={c.name} placeholder={c.namePlaceholder} maxLength={160} />
          <SubmitButton className={`${primary} self-start`}>{c.create}</SubmitButton>
        </form>
      ) : (
        <p className="m-0 text-[13.5px] text-ink-faint">{c.notWon}</p>
      )}
    </Panel>
  );
}

// ----- Activity

export function ActivityPanel({ extra, t, locale, members }: Pick<Ctx, "extra" | "t" | "locale" | "members">) {
  const who = people(members);
  const a = t.crm.activity;
  return (
    <Panel title={a.title} id="activity">
      {extra.activity.length === 0 ? (
        <p className="m-0 text-[13px] text-ink-faint">{a.none}</p>
      ) : (
        <ul className="m-0 list-none p-0 text-[13.5px]" data-activity>
          {extra.activity.map((e, i) => {
            const system = e.actor === "cal.com" || e.actor === "system";
            const detail = e.detail as Record<string, unknown>;
            const extraText =
              e.action === "stage_changed"
                ? ` ${a.detailStage(t.crm.stages[detail.from as keyof typeof t.crm.stages] ?? String(detail.from), t.crm.stages[detail.to as keyof typeof t.crm.stages] ?? String(detail.to))}`
                : "";
            return (
              <li key={`${e.at}-${i}`} className="border-t border-line py-2 first:border-t-0 first:pt-0">
                <p className="m-0">
                  {system ? null : <span className="font-semibold">{who.ofEmail(e.actor)} </span>}
                  {t.crm.actions[e.action] ?? e.action.replaceAll("_", " ")}
                  {extraText}
                </p>
                <p className="m-0 text-[12px] text-ink-faint">{formatDate(e.at, true, locale)}</p>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}


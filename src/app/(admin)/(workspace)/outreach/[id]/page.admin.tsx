import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Notice from "@/components/crm/Notice";
import { ProspectForm } from "@/components/crm/ProspectForm";
import { SelectField, TextAreaField, TextField, optionsOf } from "@/components/crm/Fields";
import { Empty, Panel, linkClass, smallMuted } from "@/components/crm/parts";
import SubmitButton from "@/components/dashboard/SubmitButton";
import { Chip, button, formatDate, formatDay, primary, todayInCairo, type ChipTone } from "@/components/dashboard/ui";
import { teamMembers } from "@/lib/admin/auth/config";
import { requireAdmin } from "@/lib/admin/auth/state";
import { adminText } from "@/lib/admin/locale";
import { people } from "@/lib/admin/people";
import { nextTouchWindow } from "@/lib/crm/cadence";
import { inquiryList, prospectGet } from "@/lib/crm/data";
import { CONTACT_CHANNELS, PROSPECT_STAGES, TOUCH_KINDS } from "@/lib/crm/types";
import { linkProspectAction, logTouchAction, prospectFollowUpAction, prospectStageAction, saveProspectAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Prospect" };

const TONES: Record<string, ChipTone> = { identified: "neutral", researched: "neutral", contacted: "info", replied: "info", qualified: "ok", inquiry_submitted: "ok", not_now: "warn", disqualified: "neutral" };

export default async function ProspectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detail = await prospectGet(id);
  if (!detail) notFound();
  const { locale, t } = await adminText();
  const o = t.crm.outreach;
  const members = teamMembers();
  const who = people(members);
  const sp = await searchParams;
  const { prospect: p, touches, inquiry, activity } = detail;
  const today = todayInCairo();
  const closed = ["not_now", "disqualified", "inquiry_submitted"].includes(p.stage);
  const outbound = touches.filter((x) => x.kind === "outbound" && x.touch_no);
  const lastOutbound = outbound.sort((a, b) => b.occurred_on.localeCompare(a.occurred_on) || (b.touch_no ?? 0) - (a.touch_no ?? 0))[0];
  const window = lastOutbound ? nextTouchWindow(lastOutbound.touch_no ?? 0, lastOutbound.occurred_on) : null;
  const nextTouchNo = lastOutbound ? Math.min((lastOutbound.touch_no ?? 0) + 1, 4) : 1;
  const suggested = window?.earliest ?? null;
  const memberOptions = members.map((m) => ({ value: m.id, label: m.name }));
  const linkable = inquiry ? [] : (await inquiryList()).filter((r) => !["won", "lost"].includes(r.lead_status));

  return (
    <>
      <Link href="/outreach" className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-soft hover:text-ink">
        <span aria-hidden className="rtl:-scale-x-100">←</span> {t.crm.nav.outreach}
      </Link>
      <header className="mt-4 mb-6">
        <p className="m-0 flex flex-wrap items-center gap-2">
          <Chip tone={TONES[p.stage]}>{t.crm.prospectStages[p.stage]}</Chip>
          {p.lead_score !== null && <Chip tone={p.lead_score >= 10 ? "ok" : "neutral"}>{t.crm.score.total(p.lead_score)}</Chip>}
          {p.do_not_contact && <Chip tone="attention">{o.doNotContact}</Chip>}
        </p>
        <h1 className="m-0 mt-2 text-[28px] leading-tight font-bold tracking-[-0.02em] sm:text-[32px] rtl:tracking-normal">
          <bdi>{p.company_name}</bdi>
        </h1>
        <p className="mt-1 mb-0 text-[13.5px] text-ink-soft">
          {[p.country, p.pool ? t.crm.pools[p.pool] : null, who.ofId(p.owner)].filter(Boolean).join(" · ")}
        </p>
      </header>
      <Notice n={sp.n} e={sp.e} t={t.crm} />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <Panel title={o.sourceTitle} id="research">
            <form action={saveProspectAction} className="flex flex-col gap-4">
              <input type="hidden" name="prospectId" value={p.id} />
              <ProspectForm prefix="edit" t={t} members={members} prospect={p} />
              <SubmitButton className={`${primary} self-start`}>{o.save}</SubmitButton>
            </form>
          </Panel>

          <Panel title={o.timeline} id="touches" aside={<span className={smallMuted}>{touches.length}</span>}>
            {touches.length === 0 ? (
              <Empty>{o.noTouches}</Empty>
            ) : (
              <ol className="m-0 list-none p-0 text-[14px]" data-touches>
                {touches.map((x) => (
                  <li key={x.id} className="border-t border-line py-3 first:border-t-0 first:pt-0">
                    <p className="m-0 flex flex-wrap items-center gap-2">
                      <Chip tone={x.kind === "reply" ? "ok" : "neutral"}>{x.touch_no ? `${t.crm.outreach.touchNo} ${x.touch_no}` : t.crm.touchKinds[x.kind]}</Chip>
                      <span className="font-semibold">{formatDay(x.occurred_on, locale)}</span>
                      {x.channel && <span className={smallMuted}>{t.crm.channels[x.channel]}</span>}
                    </p>
                    <p dir="auto" className="m-0 mt-1 leading-relaxed">
                      {x.summary}
                    </p>
                    <p className={`m-0 mt-0.5 ${smallMuted}`}>{who.ofEmail(x.by)}</p>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          <Panel title={o.stageTitle} id="stage">
            <p className="mt-0 mb-3 text-[13px] text-ink-soft">{o.stageHelp}</p>
            {p.follow_up_due_on && (
              <p className="m-0 mb-4 rounded-xl bg-surface-2/60 p-3 text-[13.5px]" data-next-action>
                <span dir="auto" className="block font-medium">
                  {p.follow_up_action}
                </span>
                <span className={`block text-[12.5px] ${p.follow_up_due_on < today ? "font-semibold text-red-700" : "text-ink-soft"}`}>
                  {who.ofId(p.follow_up_owner ?? "")} · {p.follow_up_due_on < today ? `${o.overdue} · ` : ""}
                  {formatDay(p.follow_up_due_on, locale)}
                </span>
              </p>
            )}
            <form action={prospectStageAction} className="flex flex-col gap-3">
              <input type="hidden" name="prospectId" value={p.id} />
              <SelectField id="ps-stage" name="stage" text={o.moveTo} defaultValue={p.stage} required options={optionsOf(t.crm.prospectStages, PROSPECT_STAGES)} />
              <TextField id="ps-action" name="action" text={o.nextAction} placeholder={o.nextActionPlaceholder} maxLength={500} defaultValue={p.follow_up_action} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <SelectField id="ps-owner" name="owner" text={o.responsible} defaultValue={p.follow_up_owner ?? p.owner} blank={o.choose} options={memberOptions} />
                <TextField id="ps-due" name="dueOn" type="date" text={o.due} defaultValue={p.follow_up_due_on ?? suggested} />
              </div>
              <TextField id="ps-reason" name="reason" text={o.reason} maxLength={300} defaultValue={p.closed_reason} />
              <SubmitButton className={`${primary} self-start`}>{o.move}</SubmitButton>
            </form>
            {!closed && p.follow_up_due_on && (
              <details className="group mt-4 border-t border-line pt-3">
                <summary className="cursor-pointer text-[14px] font-semibold">{o.setFollowUp}</summary>
                <form action={prospectFollowUpAction} className="mt-3 flex flex-col gap-3">
                  <input type="hidden" name="prospectId" value={p.id} />
                  <TextField id="pf-action" name="action" text={o.nextAction} maxLength={500} required defaultValue={p.follow_up_action} />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <SelectField id="pf-owner" name="owner" text={o.responsible} required defaultValue={p.follow_up_owner} blank={o.choose} options={memberOptions} />
                    <TextField id="pf-due" name="dueOn" type="date" text={o.due} required defaultValue={p.follow_up_due_on} />
                  </div>
                  <SubmitButton className={`${button} self-start`}>{o.setFollowUp}</SubmitButton>
                </form>
              </details>
            )}
          </Panel>

          {!closed && (
            <Panel title={o.touchTitle} id="touch">
              <p className="mt-0 mb-3 text-[13px] text-ink-soft">{o.touchHelp}</p>
              {suggested && <p className="mt-0 mb-3 text-[13px] font-semibold">{o.suggested(formatDay(suggested, locale))}</p>}
              <form action={logTouchAction} className="flex flex-col gap-3">
                <input type="hidden" name="prospectId" value={p.id} />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <SelectField id="t-kind" name="kind" text={o.touchKind} defaultValue="outbound" required options={TOUCH_KINDS.map((k) => ({ value: k, label: t.crm.touchKinds[k] }))} />
                  <SelectField
                    id="t-no"
                    name="touchNo"
                    text={o.touchNo}
                    defaultValue={String(nextTouchNo)}
                    blank={o.touchNoNone}
                    options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: `${o.touchNo} ${n}` }))}
                  />
                  <TextField id="t-date" name="occurredOn" type="date" text={o.touchDate} required defaultValue={today} />
                  <SelectField id="t-channel" name="channel" text={o.fields.channel} defaultValue={p.contact_channel} blank={o.choose} options={optionsOf(t.crm.channels, CONTACT_CHANNELS)} />
                </div>
                <TextAreaField id="t-summary" name="summary" text={o.touchSummary} placeholder={o.touchSummaryPlaceholder} rows={2} maxLength={500} required />
                <fieldset className="m-0 rounded-xl border border-line p-3.5">
                  <legend className="px-1 text-[13px] font-semibold">{o.nextAction}</legend>
                  <div className="flex flex-col gap-3">
                    <TextField id="t-next" name="action" text={o.nextAction} placeholder={o.nextActionPlaceholder} maxLength={500} />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <SelectField id="t-owner" name="owner" text={o.responsible} defaultValue={p.owner} blank={o.choose} options={memberOptions} />
                      <TextField id="t-due" name="dueOn" type="date" text={o.due} min={today} defaultValue={suggested} />
                    </div>
                  </div>
                </fieldset>
                <SubmitButton className={`${primary} self-start`}>{o.touchLog}</SubmitButton>
              </form>
            </Panel>
          )}

          <Panel title={o.linkTitle} id="link">
            {inquiry ? (
              <p className="m-0 text-[14px]" data-linked-inquiry>
                {o.linked}:{" "}
                <Link href={`/inquiries/${inquiry.id}`} className={linkClass}>
                  <bdi>{inquiry.client_name}</bdi>
                </Link>{" "}
                <Chip>{t.crm.stages[inquiry.stage]}</Chip>
              </p>
            ) : (
              <>
                <p className="mt-0 mb-3 text-[13px] text-ink-soft">{o.linkHelp}</p>
                {linkable.length === 0 ? (
                  <p className="m-0 text-[13px] text-ink-faint">{t.crm.pipeline.empty}</p>
                ) : (
                  <form action={linkProspectAction} className="flex flex-col gap-3">
                    <input type="hidden" name="prospectId" value={p.id} />
                    <SelectField
                      id="link-inquiry"
                      name="inquiryId"
                      text={o.linkChoose}
                      required
                      blank={o.choose}
                      options={linkable.map((r) => ({ value: r.id, label: `${r.client_name}${r.company_name ? ` · ${r.company_name}` : ""} · ${formatDate(r.created_at, false, locale)}` }))}
                    />
                    <SubmitButton className={`${button} self-start`}>{o.linkSubmit}</SubmitButton>
                  </form>
                )}
              </>
            )}
          </Panel>

          <Panel title={o.activity} id="activity">
            {activity.length === 0 ? (
              <p className="m-0 text-[13px] text-ink-faint">{t.crm.activity.none}</p>
            ) : (
              <ul className="m-0 list-none p-0 text-[13.5px]">
                {activity.map((a, i) => (
                  <li key={`${a.at}-${i}`} className="border-t border-line py-2 first:border-t-0 first:pt-0">
                    <p className="m-0">
                      <span className="font-semibold">{who.ofEmail(a.actor)}</span> {t.crm.actions[a.action] ?? a.action.replaceAll("_", " ")}
                    </p>
                    <p className="m-0 text-[12px] text-ink-faint">{formatDate(a.at, true, locale)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

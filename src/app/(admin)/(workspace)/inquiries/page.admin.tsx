import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth/state";
import { ownersLabel, teamMembers, type TeamMember } from "@/lib/admin/auth/config";
import { adminText } from "@/lib/admin/locale";
import type { AdminLocale, AdminMessages } from "@/lib/admin/messages";
import { inquiryList } from "@/lib/crm/data";
import { attentionReasons, type AttentionReason } from "@/lib/crm/attention";
import { inquiryFiltersSchema } from "@/lib/crm/schemas";
import type { InquiryListRow } from "@/lib/crm/types";
import Notice from "@/components/crm/Notice";
import { SelectField, TextField, optionsOf } from "@/components/crm/Fields";
import SubmitButton from "@/components/dashboard/SubmitButton";
import { clientProjectType } from "@/lib/dashboard/project-type";
import { needsApprovalBeforeMeeting } from "@/lib/dashboard/approval";
import { selectGenerator } from "@/lib/preparation/config";
import { excerpt, label, labelsFor } from "@/lib/dashboard/status";
import { Chip, MEETING_TONES, REVIEW_TONES, button, card, eyebrow, formatDate, formatDay, primary, todayInCairo, type ChipTone } from "@/components/dashboard/ui";
import { LogoMark } from "@/components/Logo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Inquiries" };

const STUCK = new Set(["failed", "paused"]);

interface Row extends InquiryListRow {
  attention: boolean;
  reasons: AttentionReason[];
  needsApproval: boolean;
  owner: string;
  followUp: { action: string; who: string; due: string; overdue: boolean } | null;
  review: { text: string; tone: ChipTone; approved: boolean; inReview: boolean };
}

interface Ctx {
  locale: AdminLocale;
  t: AdminMessages;
  labels: ReturnType<typeof labelsFor>;
}

const MeetingChip = ({ r, c }: { r: Row; c: Ctx }) => <Chip tone={MEETING_TONES[r.booking_status] ?? "neutral"}>{label(c.labels.meeting, r.booking_status)}</Chip>;
const meetingTime = (r: Row, c: Ctx) => (r.meeting_start_at && r.booking_status === "booked" ? formatDate(r.meeting_start_at, true, c.locale) : null);

// The sales stage is its own state, separate from the meeting, the preparation and the review.
const SalesChip = ({ r, c, prefixed = false }: { r: Row; c: Ctx; prefixed?: boolean }) => {
  const stage = label(c.labels.lead, r.lead_status);
  return (
    <Chip tone="neutral" data-status="sales">
      {prefixed ? c.t.list.sales(stage) : stage}
    </Chip>
  );
};

const ApprovalFlag = ({ r, c }: { r: Row; c: Ctx }) =>
  r.needsApproval ? (
    <Chip tone="warn" data-flag="needs-approval">
      {c.t.list.needsApproval}
    </Chip>
  ) : null;

const PreparationChip = ({ r, c }: { r: Row; c: Ctx }) =>
  r.attention ? (
    <Chip tone="attention">{c.t.list.needsAttention}</Chip>
  ) : (
    <Chip tone={r.preparation_status === "succeeded" || r.preparation_status === "manual" ? "ok" : "info"}>{label(c.labels.preparation, r.preparation_status, c.t.detail.none)}</Chip>
  );

// Where the lead came from and how well it fits, only when there is something to say.
function SourceLine({ r, c }: { r: Row; c: Ctx }) {
  const bits: string[] = [];
  if (r.lead_origin !== "inbound") bits.push(c.t.crm.origins[r.lead_origin]);
  if (r.campaign) bits.push(r.campaign);
  if (r.fit_tier) bits.push(c.t.crm.fitTiers[r.fit_tier].split(":")[0]);
  if (r.lead_score !== null) bits.push(c.t.crm.score.total(r.lead_score));
  if (bits.length === 0) return null;
  return (
    <p className="m-0 mt-1.5 flex flex-wrap gap-1.5 text-[12px]" data-source-line>
      {bits.map((b) => (
        <Chip key={b}>
          <bdi>{b}</bdi>
        </Chip>
      ))}
    </p>
  );
}

function Client({ r, c }: { r: Row; c: Ctx }) {
  return (
    <>
      <Link href={`/inquiries/${r.id}`} className="font-semibold text-ink decoration-mint decoration-2 underline-offset-4 hover:underline">
        <bdi>{r.client_name}</bdi>
        {r.company_name ? (
          <span className="font-normal text-ink-soft">
            {" · "}
            <bdi>{r.company_name}</bdi>
          </span>
        ) : null}
      </Link>
      <div className="mt-0.5 text-[12.5px] text-ink-faint">
        {c.t.list.typeLabel}: {label(c.labels.projectType, clientProjectType(r.project_type), c.t.list.notProvided)} · {c.t.languages[r.language] ?? r.language}
      </div>
      <p dir="auto" className="mt-1.5 mb-0 max-w-[60ch] text-[13.5px] leading-relaxed text-ink-soft">
        {excerpt(r.summary)}
      </p>
      <SourceLine r={r} c={c} />
    </>
  );
}

// The next open follow-up: who and when on one line, the action on its own
// line in its own direction, so English and Arabic mix cleanly.
function FollowUpLine({ f, c, className }: { f: NonNullable<Row["followUp"]>; c: Ctx; className: string }) {
  return (
    <div className={`text-[12.5px] ${className}`} data-next-follow-up>
      <p className={`m-0 ${f.overdue ? "font-semibold text-red-700" : "text-ink-faint"}`}>
        {c.t.list.nextLabel} <bdi>{f.who}</bdi> · <bdi>{f.due}</bdi>
        {f.overdue && <span className="ms-1">· {c.t.detail.followUps.overdue}</span>}
      </p>
      <p dir="auto" className="m-0 text-ink-soft">
        {f.action}
      </p>
    </div>
  );
}

function Stat({ value, title, tone }: { value: number; title: string; tone?: "attention" }) {
  return (
    <div className={`${card} flex flex-col-reverse px-4 py-3.5`}>
      <dt className="mt-1.5 text-[12.5px] font-semibold text-ink-soft">{title}</dt>
      <dd className={`m-0 text-[26px] leading-none font-bold tracking-[-0.02em] ${tone === "attention" && value > 0 ? "text-red-700" : ""}`}>{value}</dd>
    </div>
  );
}

export default async function InquiriesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const { locale, t } = await adminText();
  const c: Ctx = { locale, t, labels: labelsFor(locale) };
  const sp = await searchParams;
  const filters = inquiryFiltersSchema.parse(Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const narrowed = Boolean(filters.q || filters.owner || filters.stage || filters.meeting || filters.preparation || filters.origin || filters.campaign);
  const [everything, generator] = [await inquiryList(), selectGenerator()];
  const raw = narrowed ? await inquiryList(filters) : everything;
  const automationLabel = generator.enabled ? `on (${generator.generator.id})` : generator.reason === "off" ? t.list.automationOff : `${t.list.automationOff} (${generator.reason.replaceAll("_", " ")})`;
  const members: TeamMember[] = teamMembers();
  const today = todayInCairo();
  const now = new Date();

  const rows: Row[] = raw.map((r) => {
    const waiting = (r.preparation_status === "queued" || r.preparation_status === "retry_scheduled") && !generator.enabled;
    const latest = r.latest_draft;
    return {
      ...r,
      reasons: attentionReasons(r, { today, automationEnabled: generator.enabled, now }),
      attention: STUCK.has(r.preparation_status ?? "") || waiting || !r.preparation_status,
      needsApproval: needsApprovalBeforeMeeting(r, now),
      owner: ownersLabel(r.owners, members, t.list.unassigned),
      followUp: r.next_follow_up
        ? {
            action: r.next_follow_up.action,
            who: ownersLabel([r.next_follow_up.owner], members, "?"),
            due: formatDay(r.next_follow_up.due_on, locale),
            overdue: r.next_follow_up.due_on < today,
          }
        : null,
      review: r.approved_version
        ? { text: t.list.approved(r.approved_version), tone: "ok", approved: true, inReview: false }
        : latest
          ? { text: `${c.labels.review[latest.review_status]} · ${t.list.versionShort(latest.version)}`, tone: REVIEW_TONES[latest.review_status] ?? "neutral", approved: false, inReview: latest.review_status === "in_review" }
          : { text: t.list.noDraft, tone: "neutral", approved: false, inReview: false },
    };
  });

  const visible = filters.attention ? rows.filter((r) => r.reasons.length > 0) : rows;
  const filtered = narrowed || Boolean(filters.attention);
  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className={eyebrow}>{t.list.eyebrow}</p>
          <h1 className="m-0 mt-1 text-[28px] font-bold tracking-[-0.02em] sm:text-[32px] rtl:tracking-normal">{t.list.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="m-0 text-[13px] text-ink-soft">{t.list.automation(automationLabel)}</p>
          <form action="/export/inquiries" method="post">
            <button type="submit" className={button}>
              {t.crm.common.export}
            </button>
          </form>
        </div>
      </div>
      <Notice n={sp.n} e={sp.e} t={t.crm} />

      <form method="get" action="/inquiries" role="search" aria-label={t.crm.filters.title} className={`${card} mb-6 grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4`}>
        <div className="sm:col-span-2">
          <TextField id="f-q" name="q" text={t.crm.filters.search} defaultValue={filters.q} placeholder={t.crm.filters.searchPlaceholder} maxLength={120} />
        </div>
        <SelectField
          id="f-owner"
          name="owner"
          text={t.crm.filters.owner}
          defaultValue={filters.owner}
          blank={t.crm.common.all}
          options={[{ value: "unassigned", label: t.crm.common.unassigned }, ...members.map((m) => ({ value: m.id, label: m.name }))]}
        />
        <SelectField id="f-stage" name="stage" text={t.crm.filters.stage} defaultValue={filters.stage} blank={t.crm.common.all} options={optionsOf(t.crm.stages, Object.keys(t.crm.stages))} />
        <SelectField id="f-meeting" name="meeting" text={t.crm.filters.meeting} defaultValue={filters.meeting} blank={t.crm.common.all} options={optionsOf(c.labels.meeting, Object.keys(c.labels.meeting))} />
        <SelectField
          id="f-prep"
          name="preparation"
          text={t.crm.filters.preparation}
          defaultValue={filters.preparation}
          blank={t.crm.common.all}
          options={[{ value: "none", label: t.crm.filters.noPreparation }, ...optionsOf(c.labels.preparation, Object.keys(c.labels.preparation))]}
        />
        <SelectField id="f-origin" name="origin" text={t.crm.filters.origin} defaultValue={filters.origin} blank={t.crm.common.all} options={optionsOf(t.crm.origins, Object.keys(t.crm.origins))} />
        <TextField id="f-campaign" name="campaign" text={t.crm.filters.campaign} defaultValue={filters.campaign} maxLength={120} ltr />
        <div className="flex items-end">
          <label htmlFor="f-attention" className="inline-flex items-center gap-2.5 py-2.5 text-[14px] font-semibold">
            <input id="f-attention" name="attention" type="checkbox" value="1" defaultChecked={filters.attention === "1"} className="size-4 accent-mint-deep" />
            {t.crm.filters.attentionOnly}
          </label>
        </div>
        <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-4">
          <SubmitButton className={primary}>{t.crm.common.apply}</SubmitButton>
          {filtered && (
            <Link href="/inquiries" className={button}>
              {t.crm.common.clear}
            </Link>
          )}
          {filtered && (
            <span className="ms-auto text-[13px] text-ink-soft" role="status">
              {t.crm.filters.showing(visible.length, everything.length)}
            </span>
          )}
        </div>
      </form>

      {visible.length === 0 && filtered ? (
        <div className={`${card} px-6 py-12 text-center`}>
          <p className="m-0 text-[15px] text-ink-soft">{t.crm.filters.noMatches}</p>
        </div>
      ) : visible.length === 0 ? (
        <div className={`${card} flex flex-col items-center px-6 py-16 text-center`}>
          <LogoMark size={40} />
          <h2 className="mt-5 mb-0 text-[19px] font-semibold">{t.list.emptyTitle}</h2>
          <p className="mt-2 mb-0 max-w-[46ch] text-[14px] leading-relaxed text-ink-soft">{t.list.emptyBody}</p>
        </div>
      ) : (
        <>
          <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" data-summary>
            <Stat value={visible.filter((r) => r.attention).length} title={t.list.stats.attention} tone="attention" />
            <Stat value={visible.filter((r) => r.followUp?.overdue).length} title={t.list.stats.overdue} tone="attention" />
            <Stat value={visible.filter((r) => r.booking_status === "booked").length} title={t.list.stats.booked} />
            <Stat value={visible.filter((r) => r.needsApproval).length} title={t.list.stats.unapproved} tone="attention" />
            <Stat value={visible.filter((r) => r.review.inReview).length} title={t.list.stats.review} />
            <Stat value={visible.filter((r) => r.review.approved).length} title={t.list.stats.approved} />
          </dl>

          {/* Tablet and desktop: a table. */}
          <div className={`${card} hidden overflow-hidden lg:block`}>
            <table className="w-full border-collapse text-start text-[14px]">
              <caption className="sr-only">{t.list.caption}</caption>
              <thead className="border-b border-line bg-surface-2/60">
                <tr className="text-start text-[11.5px] font-bold tracking-[0.08em] text-ink-faint uppercase rtl:text-[12.5px] rtl:tracking-normal">
                  <th scope="col" className="py-3 ps-5 pe-4 text-start">
                    {t.list.columns.client}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start">
                    {t.list.columns.received}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start">
                    {t.list.columns.meeting}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start">
                    {t.list.columns.preparation}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start">
                    {t.list.columns.review}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start">
                    {t.list.columns.sales}
                  </th>
                  <th scope="col" className="py-3 ps-4 pe-5 text-start">
                    {t.list.columns.owner}
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id} data-attention={r.attention ? "true" : undefined} className="border-t border-line align-top first:border-t-0 hover:bg-canvas/70">
                    <td className={`py-4 ps-5 pe-4 ${r.attention ? "shadow-[inset_3px_0_0_#dc2626] rtl:shadow-[inset_-3px_0_0_#dc2626]" : ""}`}>
                      <Client r={r} c={c} />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-ink-soft">{formatDate(r.created_at, false, locale)}</td>
                    <td className="px-4 py-4">
                      <MeetingChip r={r} c={c} />
                      {meetingTime(r, c) && <div className="mt-1 text-[12.5px] whitespace-nowrap text-ink-soft">{meetingTime(r, c)}</div>}
                    </td>
                    <td className="px-4 py-4">
                      <PreparationChip r={r} c={c} />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col items-start gap-1">
                        <Chip tone={r.review.tone}>{r.review.text}</Chip>
                        <ApprovalFlag r={r} c={c} />
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <SalesChip r={r} c={c} />
                    </td>
                    <td className="py-4 ps-4 pe-5">
                      <span className={`whitespace-nowrap ${r.owners.length ? "" : "text-ink-faint"}`}>{r.owner}</span>
                      {r.followUp && <FollowUpLine f={r.followUp} c={c} className="mt-1 max-w-[26ch]" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phones: one card per inquiry. */}
          <ul className="m-0 flex list-none flex-col gap-3 p-0 lg:hidden" aria-label={t.list.caption}>
            {visible.map((r) => (
              <li key={r.id} className={`${card} p-4 ${r.attention ? "border-s-4 border-s-red-600" : ""}`}>
                <div className="mb-2 flex items-center justify-between gap-3 text-[12.5px] text-ink-faint">
                  <span>{formatDate(r.created_at, false, locale)}</span>
                  <span>{r.owner}</span>
                </div>
                <Client r={r} c={c} />
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <MeetingChip r={r} c={c} />
                  <PreparationChip r={r} c={c} />
                  <Chip tone={r.review.tone}>{r.review.text}</Chip>
                  <SalesChip r={r} c={c} prefixed />
                  <ApprovalFlag r={r} c={c} />
                </div>
                {meetingTime(r, c) && <p className="mt-2 mb-0 text-[12.5px] text-ink-soft">{t.list.meetingAt(meetingTime(r, c)!)}</p>}
                {r.followUp && <FollowUpLine f={r.followUp} c={c} className="mt-1" />}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

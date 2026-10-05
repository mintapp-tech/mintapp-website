import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth/state";
import { teamMembers } from "@/lib/admin/auth/config";
import { adminText } from "@/lib/admin/locale";
import type { AdminLocale, AdminMessages } from "@/lib/admin/messages";
import { listInquiries, type InquiryRow } from "@/lib/dashboard/data";
import { selectGenerator } from "@/lib/preparation/config";
import { excerpt, label, labelsFor } from "@/lib/dashboard/status";
import { Chip, MEETING_TONES, REVIEW_TONES, card, eyebrow, formatDate, type ChipTone } from "@/components/dashboard/ui";
import { LogoMark } from "@/components/Logo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Inquiries" };

const STUCK = new Set(["failed", "paused"]);

interface Row extends InquiryRow {
  attention: boolean;
  owner: string;
  review: { text: string; tone: ChipTone; approved: boolean; inReview: boolean };
}

interface Ctx {
  locale: AdminLocale;
  t: AdminMessages;
  labels: ReturnType<typeof labelsFor>;
}

const MeetingChip = ({ r, c }: { r: Row; c: Ctx }) => <Chip tone={MEETING_TONES[r.booking_status] ?? "neutral"}>{label(c.labels.meeting, r.booking_status)}</Chip>;
const meetingTime = (r: Row, c: Ctx) => (r.meeting_start_at && r.booking_status === "booked" ? formatDate(r.meeting_start_at, true, c.locale) : null);

const PreparationChip = ({ r, c }: { r: Row; c: Ctx }) =>
  r.attention ? (
    <Chip tone="attention">{c.t.list.needsAttention}</Chip>
  ) : (
    <Chip tone={r.preparation_status === "succeeded" || r.preparation_status === "manual" ? "ok" : "info"}>{label(c.labels.preparation, r.preparation_status, c.t.detail.none)}</Chip>
  );

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
        {label(c.labels.projectType, r.project_type, c.t.list.typeNotStated)} · {c.t.languages[r.language] ?? r.language}
      </div>
      <p dir="auto" className="mt-1.5 mb-0 max-w-[60ch] text-[13.5px] leading-relaxed text-ink-soft">
        {excerpt(r.summary)}
      </p>
    </>
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

export default async function InquiriesPage() {
  await requireAdmin();
  const { locale, t } = await adminText();
  const c: Ctx = { locale, t, labels: labelsFor(locale) };
  const [raw, generator] = [await listInquiries(), selectGenerator()];
  const automationLabel = generator.enabled ? `on (${generator.generator.id})` : generator.reason === "off" ? t.list.automationOff : `${t.list.automationOff} (${generator.reason.replaceAll("_", " ")})`;
  const names = new Map(teamMembers().map((m) => [m.email, m.name]));

  const rows: Row[] = raw.map((r) => {
    const waiting = (r.preparation_status === "queued" || r.preparation_status === "retry_scheduled") && !generator.enabled;
    const latest = r.latest_draft;
    return {
      ...r,
      attention: STUCK.has(r.preparation_status ?? "") || waiting || !r.preparation_status,
      owner: r.assigned_to ? (names.get(r.assigned_to) ?? r.assigned_to) : t.list.unassigned,
      review: r.approved_version
        ? { text: t.list.approved(r.approved_version), tone: "ok", approved: true, inReview: false }
        : latest
          ? { text: `${c.labels.review[latest.review_status]} · ${t.list.versionShort(latest.version)}`, tone: REVIEW_TONES[latest.review_status] ?? "neutral", approved: false, inReview: latest.review_status === "in_review" }
          : { text: t.list.noDraft, tone: "neutral", approved: false, inReview: false },
    };
  });

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className={eyebrow}>{t.list.eyebrow}</p>
          <h1 className="m-0 mt-1 text-[28px] font-bold tracking-[-0.02em] sm:text-[32px] rtl:tracking-normal">{t.list.title}</h1>
        </div>
        <p className="m-0 text-[13px] text-ink-soft">{t.list.automation(automationLabel)}</p>
      </div>

      {rows.length === 0 ? (
        <div className={`${card} flex flex-col items-center px-6 py-16 text-center`}>
          <LogoMark size={40} />
          <h2 className="mt-5 mb-0 text-[19px] font-semibold">{t.list.emptyTitle}</h2>
          <p className="mt-2 mb-0 max-w-[46ch] text-[14px] leading-relaxed text-ink-soft">{t.list.emptyBody}</p>
        </div>
      ) : (
        <>
          <dl className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat value={rows.filter((r) => r.attention).length} title={t.list.stats.attention} tone="attention" />
            <Stat value={rows.filter((r) => r.booking_status === "booked").length} title={t.list.stats.booked} />
            <Stat value={rows.filter((r) => r.review.inReview).length} title={t.list.stats.review} />
            <Stat value={rows.filter((r) => r.review.approved).length} title={t.list.stats.approved} />
          </dl>

          {/* Tablet and desktop: a table. */}
          <div className={`${card} hidden overflow-hidden md:block`}>
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
                  <th scope="col" className="py-3 ps-4 pe-5 text-start">
                    {t.list.columns.owner}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
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
                      <Chip tone={r.review.tone}>{r.review.text}</Chip>
                    </td>
                    <td className="py-4 ps-4 pe-5">
                      <span className={`whitespace-nowrap ${r.assigned_to ? "" : "text-ink-faint"}`}>{r.owner}</span>
                      {r.next_action && (
                        <div dir="auto" className="mt-1 max-w-[24ch] text-[12.5px] text-ink-soft">
                          {r.next_action}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phones: one card per inquiry. */}
          <ul className="m-0 flex list-none flex-col gap-3 p-0 md:hidden" aria-label={t.list.caption}>
            {rows.map((r) => (
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
                </div>
                {meetingTime(r, c) && <p className="mt-2 mb-0 text-[12.5px] text-ink-soft">{t.list.meetingAt(meetingTime(r, c)!)}</p>}
                {r.next_action && (
                  <p dir="auto" className="mt-1 mb-0 text-[12.5px] text-ink-soft">
                    {t.list.next(r.next_action)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

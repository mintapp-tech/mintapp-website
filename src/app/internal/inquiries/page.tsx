import type { Metadata } from "next";
import Link from "next/link";
import { requireTeamMember } from "@/lib/team-auth/guard";
import { teamAccounts } from "@/lib/team-auth/accounts";
import { listInquiries, type InquiryRow } from "@/lib/dashboard/data";
import { selectGenerator } from "@/lib/preparation/config";
import { MEETING_LABELS, PREPARATION_LABELS, PROJECT_TYPE_LABELS, REVIEW_LABELS, excerpt, label } from "@/lib/dashboard/status";
import { Chip, MEETING_TONES, REVIEW_TONES, card, eyebrow, formatDate, type ChipTone } from "@/components/dashboard/ui";
import { LogoMark } from "@/components/Logo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Inquiries · Mintapp team", robots: { index: false, follow: false, nocache: true } };

const STUCK = new Set(["failed", "paused"]);

interface Row extends InquiryRow {
  attention: boolean;
  owner: string;
  review: { text: string; tone: ChipTone; approved: boolean; inReview: boolean };
}

const MeetingChip = ({ r }: { r: Row }) => <Chip tone={MEETING_TONES[r.booking_status] ?? "neutral"}>{label(MEETING_LABELS, r.booking_status)}</Chip>;
const meetingTime = (r: Row) => (r.meeting_start_at && r.booking_status === "booked" ? formatDate(r.meeting_start_at) : null);

const PreparationChip = ({ r }: { r: Row }) =>
  r.attention ? (
    <Chip tone="attention">Needs attention</Chip>
  ) : (
    <Chip tone={r.preparation_status === "succeeded" || r.preparation_status === "manual" ? "ok" : "info"}>{label(PREPARATION_LABELS, r.preparation_status)}</Chip>
  );

function Client({ r }: { r: Row }) {
  return (
    <>
      <Link href={`/internal/inquiries/${r.id}`} className="font-semibold text-ink decoration-mint decoration-2 underline-offset-4 hover:underline">
        <span dir="auto">{r.client_name}</span>
        {r.company_name ? <span className="font-normal text-ink-soft"> · {r.company_name}</span> : null}
      </Link>
      <div className="mt-0.5 text-[12.5px] text-ink-faint">
        {label(PROJECT_TYPE_LABELS, r.project_type, "Type not stated")} · {r.language === "ar" ? "Arabic" : "English"}
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
  await requireTeamMember();
  const [raw, generator] = [await listInquiries(), selectGenerator()];
  const automationLabel = generator.enabled ? `on (${generator.generator.id})` : generator.reason === "off" ? "off" : `off (${generator.reason.replaceAll("_", " ")})`;
  const names = new Map(teamAccounts().map((a) => [a.email, a.name]));

  const rows: Row[] = raw.map((r) => {
    const waiting = (r.preparation_status === "queued" || r.preparation_status === "retry_scheduled") && !generator.enabled;
    const latest = r.latest_draft;
    return {
      ...r,
      attention: STUCK.has(r.preparation_status ?? "") || waiting || !r.preparation_status,
      owner: r.assigned_to ? (names.get(r.assigned_to) ?? r.assigned_to) : "Unassigned",
      review: r.approved_version
        ? { text: `Approved · v${r.approved_version}`, tone: "ok", approved: true, inReview: false }
        : latest
          ? { text: `${REVIEW_LABELS[latest.review_status]} · v${latest.version}`, tone: REVIEW_TONES[latest.review_status] ?? "neutral", approved: false, inReview: latest.review_status === "in_review" }
          : { text: "No draft", tone: "neutral", approved: false, inReview: false },
    };
  });

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className={eyebrow}>Meeting preparation</p>
          <h1 className="m-0 mt-1 text-[28px] font-bold tracking-[-0.02em] sm:text-[32px]">Inquiries</h1>
        </div>
        <p className="m-0 text-[13px] text-ink-soft">Automated preparation: {automationLabel}</p>
      </div>

      {rows.length === 0 ? (
        <div className={`${card} flex flex-col items-center px-6 py-16 text-center`}>
          <LogoMark size={40} />
          <h2 className="mt-5 mb-0 text-[19px] font-semibold">No inquiries yet</h2>
          <p className="mt-2 mb-0 max-w-[46ch] text-[14px] leading-relaxed text-ink-soft">
            Inquiries sent through the website appear here as soon as they arrive, each with a brief ready to prepare for the first meeting.
          </p>
        </div>
      ) : (
        <>
          <dl className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat value={rows.filter((r) => r.attention).length} title="Need attention" tone="attention" />
            <Stat value={rows.filter((r) => r.booking_status === "booked").length} title="Meetings booked" />
            <Stat value={rows.filter((r) => r.review.inReview).length} title="Ready for review" />
            <Stat value={rows.filter((r) => r.review.approved).length} title="Approved for a meeting" />
          </dl>

          {/* Tablet and desktop: a table. */}
          <div className={`${card} hidden overflow-hidden md:block`}>
            <table className="w-full border-collapse text-left text-[14px]">
              <caption className="sr-only">Inquiries, newest first</caption>
              <thead className="border-b border-line bg-surface-2/60">
                <tr className="text-[11.5px] font-bold tracking-[0.08em] text-ink-faint uppercase">
                  <th scope="col" className="py-3 ps-5 pe-4">
                    Client and project
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Received
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Meeting
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Preparation
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Review
                  </th>
                  <th scope="col" className="py-3 ps-4 pe-5">
                    Owner
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} data-attention={r.attention ? "true" : undefined} className="border-t border-line align-top first:border-t-0 hover:bg-canvas/70">
                    <td className={`py-4 ps-5 pe-4 ${r.attention ? "shadow-[inset_3px_0_0_#dc2626]" : ""}`}>
                      <Client r={r} />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-ink-soft">{formatDate(r.created_at, false)}</td>
                    <td className="px-4 py-4">
                      <MeetingChip r={r} />
                      {meetingTime(r) && <div className="mt-1 text-[12.5px] whitespace-nowrap text-ink-soft">{meetingTime(r)}</div>}
                    </td>
                    <td className="px-4 py-4">
                      <PreparationChip r={r} />
                    </td>
                    <td className="px-4 py-4">
                      <Chip tone={r.review.tone}>{r.review.text}</Chip>
                    </td>
                    <td className="py-4 ps-4 pe-5">
                      <span className={`whitespace-nowrap ${r.assigned_to ? "" : "text-ink-faint"}`}>{r.owner}</span>
                      {r.next_action && <div className="mt-1 max-w-[24ch] text-[12.5px] text-ink-soft">{r.next_action}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phones: one card per inquiry. */}
          <ul className="m-0 flex list-none flex-col gap-3 p-0 md:hidden" aria-label="Inquiries, newest first">
            {rows.map((r) => (
              <li key={r.id} className={`${card} p-4 ${r.attention ? "border-s-4 border-s-red-600" : ""}`}>
                <div className="mb-2 flex items-center justify-between gap-3 text-[12.5px] text-ink-faint">
                  <span>{formatDate(r.created_at, false)}</span>
                  <span>{r.owner}</span>
                </div>
                <Client r={r} />
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <MeetingChip r={r} />
                  <PreparationChip r={r} />
                  <Chip tone={r.review.tone}>{r.review.text}</Chip>
                </div>
                {meetingTime(r) && <p className="mt-2 mb-0 text-[12.5px] text-ink-soft">Meeting: {meetingTime(r)}</p>}
                {r.next_action && <p className="mt-1 mb-0 text-[12.5px] text-ink-soft">Next: {r.next_action}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import Shell from "@/components/dashboard/Shell";
import { requireTeamMember } from "@/lib/team-auth/guard";
import { listInquiries } from "@/lib/dashboard/data";
import { isLocalDashboardDemo } from "@/lib/sql-gateway";
import { selectGenerator } from "@/lib/preparation/config";
import { MEETING_LABELS, REVIEW_LABELS } from "@/lib/dashboard/status";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Inquiries — Mintapp team", robots: { index: false, follow: false, nocache: true } };

const ATTENTION = new Set(["failed", "paused"]);

export default async function InquiriesPage() {
  const member = await requireTeamMember();
  const [rows, generator] = [await listInquiries(), selectGenerator()];
  const automationLabel = generator.enabled ? `on (${generator.generator.id})` : generator.reason === "off" ? "off" : `off (${generator.reason.replaceAll("_", " ")})`;

  return (
    <Shell member={member} demo={isLocalDashboardDemo()}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h1 className="m-0 text-[26px] font-semibold">Inquiries</h1>
        <p className="m-0 text-[13.5px] text-ink-soft">Automated preparation: {automationLabel}</p>
      </div>
      {rows.length === 0 ? (
        <p className="text-ink-soft">No inquiries yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-[18px] border border-ink/10 bg-surface">
          <table className="w-full border-collapse text-left text-[14px]">
            <thead className="bg-canvas text-[12px] tracking-wide text-ink-soft uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold">Received</th>
                <th className="px-4 py-3 font-semibold">Client / project</th>
                <th className="px-4 py-3 font-semibold">Meeting</th>
                <th className="px-4 py-3 font-semibold">Preparation</th>
                <th className="px-4 py-3 font-semibold">Review</th>
                <th className="px-4 py-3 font-semibold">Owner</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const waiting = (r.preparation_status === "queued" || r.preparation_status === "retry_scheduled") && !generator.enabled;
                const attention = ATTENTION.has(r.preparation_status ?? "") || waiting || !r.preparation_status;
                return (
                  <tr key={r.id} className="border-t border-ink/10 align-top" data-attention={attention ? "true" : undefined}>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-soft">{new Date(r.created_at).toISOString().slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/internal/inquiries/${r.id}`} className="font-semibold underline decoration-mint underline-offset-4">
                        {r.client_name}
                        {r.company_name ? ` · ${r.company_name}` : ""}
                      </Link>
                      <div dir="auto" className="mt-1 max-w-[46ch] text-ink-soft">
                        {r.summary}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{MEETING_LABELS[r.booking_status] ?? r.booking_status}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {attention ? <span className="rounded-full bg-red-100 px-2.5 py-1 text-[12.5px] font-semibold text-red-800">Needs attention</span> : (r.preparation_status ?? "none").replaceAll("_", " ")}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{r.approved_version ? `Approved (v${r.approved_version})` : r.latest_draft ? `${REVIEW_LABELS[r.latest_draft.review_status]} (v${r.latest_draft.version})` : "No draft"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{r.assigned_to ?? "Unassigned"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}

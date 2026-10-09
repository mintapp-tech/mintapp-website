import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { eyebrow, formatDate } from "@/components/dashboard/ui";
import LeadTabs from "@/components/crm/LeadTabs";
import { PausedChip, PositionChip, PriorityChip } from "@/components/crm/LeadParts";
import { requireAdmin } from "@/lib/admin/auth/state";
import { adminText } from "@/lib/admin/locale";
import { isLeadId, loadExtra, loadInquiry, loadLead } from "@/lib/crm/lead-load";
import { LEAD_TABS } from "@/lib/crm/lead-path";
import { clientProjectType } from "@/lib/dashboard/project-type";
import { label, labelsFor } from "@/lib/dashboard/status";

// Every tab of a lead shares this header: who the client is, where the deal
// stands, and the four sections.
export default async function LeadLayout({ params, children }: { params: Promise<{ id: string }>; children: ReactNode }) {
  await requireAdmin();
  const { id } = await params;
  if (!isLeadId(id)) notFound();
  const [detail, extra, lead] = await Promise.all([loadInquiry(id), loadExtra(id), loadLead(id)]);
  if (!detail || !extra || !lead) notFound();
  const { locale, t } = await adminText();
  const L = labelsFor(locale);
  const i = detail.inquiry;
  const base = `/leads/${id}`;

  return (
    <>
      <Link href="/leads" className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-soft hover:text-ink">
        <span aria-hidden className="rtl:-scale-x-100">←</span> {t.lead.common.back}
      </Link>
      <header className="mt-4 mb-5">
        <p className={eyebrow}>
          {label(L.projectType, clientProjectType(i.project_type), t.lead.common.notProvided)} · {t.languages[i.language as keyof typeof t.languages] ?? i.language}
        </p>
        <h1 className="m-0 mt-1.5 text-[26px] leading-tight font-bold tracking-[-0.02em] sm:text-[32px] rtl:tracking-normal">
          <bdi>{i.company_name || i.client_name}</bdi>
          {i.company_name ? (
            <span className="font-semibold text-ink-soft">
              {" · "}
              <bdi>{i.client_name}</bdi>
            </span>
          ) : null}
        </h1>
        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[13.5px]">
          <PositionChip stage={extra.stage} t={t} />
          <PriorityChip priority={lead.priority} t={t} />
          <PausedChip until={lead.paused_until} t={t} locale={locale} />
          <span className="text-ink-soft">{t.lead.detail.received(formatDate(i.created_at, true, locale))}</span>
        </div>
      </header>
      <LeadTabs base={base} label={t.lead.detail.tabsLabel} items={LEAD_TABS.map((tab) => ({ tab, label: t.lead.detail.tabs[tab] }))} />
      {children}
    </>
  );
}

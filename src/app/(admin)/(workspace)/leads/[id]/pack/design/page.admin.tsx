import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Chip, card } from "@/components/dashboard/ui";
import DesignPreview from "@/components/pack/DesignPreview";
import { requireAdmin } from "@/lib/admin/auth/state";
import { adminText } from "@/lib/admin/locale";
import { isLeadId, loadInquiry } from "@/lib/crm/lead-load";
import { leadPath } from "@/lib/crm/lead-path";
import { renderableDesign } from "@/lib/pack/schema";

export const dynamic = "force-dynamic";
// Internal only: never indexed, never cached by a shared cache.
export const metadata: Metadata = { title: "Initial design", robots: { index: false, follow: false } };

// The internal preview of one version of the initial design. Only a version that
// passes the library check again is drawn, by trusted templates, as text.
export default async function DesignPreviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const { id } = await params;
  if (!isLeadId(id)) notFound();
  const v = Number((await searchParams).v);
  const detail = await loadInquiry(id);
  if (!detail || !Number.isInteger(v) || v < 1) notFound();
  const draft = detail.drafts.find((d) => d.version === v && d.artifact === "design");
  if (!draft) notFound();
  const { locale, t } = await adminText();
  const d = t.lead.detail.design;
  const design = renderableDesign(draft.content);

  return (
    <section aria-labelledby="design-title" className={`${card} p-5 sm:p-6`} data-design-page>
      <Link href={`${leadPath(id, "pack")}#artifact-design`} className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-soft hover:text-ink">
        <span aria-hidden className="rtl:-scale-x-100">←</span> {d.back}
      </Link>
      <div className="mt-3 mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="design-title" className="m-0 text-[20px] font-bold tracking-[-0.01em] rtl:tracking-normal">
          {d.title}
        </h2>
        <span className="flex flex-wrap gap-1.5">
          <Chip>{t.lead.detail.pack.version(draft.version)}</Chip>
          <Chip tone={draft.review_status === "approved" ? "ok" : "neutral"}>{t.lead.reviewStatus[draft.review_status]}</Chip>
        </span>
      </div>
      {design ? (
        <DesignPreview design={design} labels={{ ...d.labels, screen: d.screen }} locale={locale} />
      ) : (
        <p className="m-0 rounded-xl border border-amber-200 bg-amber-50 p-4 text-[14px] text-amber-950">{d.notRenderable}</p>
      )}
    </section>
  );
}

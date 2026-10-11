import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import DirectionPack from "@/components/pack/DirectionPack";
import { requireAdmin } from "@/lib/admin/auth/state";
import { adminText } from "@/lib/admin/locale";
import { isLeadId, loadInquiry, loadLead } from "@/lib/crm/lead-load";
import { leadPath } from "@/lib/crm/lead-path";
import { packContext, packInput } from "@/lib/crm/pack-input";
import { ARTIFACT_NAMES } from "@/lib/pack/labels";
import { directionPack } from "@/lib/pack/presentation";

export const dynamic = "force-dynamic";
// Private: signed-in founders only, never indexed, never stored by any cache
// (the admin proxy also sends "private, no-store" and "noindex").
export const metadata: Metadata = { title: "Direction Pack", robots: { index: false, follow: false, nocache: true } };

// The Direction Pack for one lead, full screen. By default only the approved
// versions are shown (and can be exported); ?mode=preview shows the latest versions
// to the founders, marked as not approved and never exportable.
export default async function PresentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const { id } = await params;
  if (!isLeadId(id)) notFound();
  const [detail, lead] = await Promise.all([loadInquiry(id), loadLead(id)]);
  if (!detail || !lead) notFound();
  const { locale, t } = await adminText();
  const mode = (await searchParams).mode === "preview" ? "preview" : "approved";
  const input = packInput(detail.inquiry, lead.budget_currency);
  const result = directionPack(
    detail.drafts.filter((d) => d.artifact && d.artifact !== "note"),
    packContext(input),
    mode,
  );
  const back = `${leadPath(id, "pack")}#direction-pack`;
  const p = t.pack;

  if (!result.ok) {
    return (
      <main className="mx-auto max-w-[720px] px-4 py-12" data-direction-pack-blocked>
        <h1 className="m-0 text-[22px] font-bold">{p.present.notReady}</h1>
        <ul className="mt-4 mb-6 ps-5 text-[15px] leading-relaxed">
          {result.blockers.map((b) => (
            <li key={`${b.part}-${b.reason}`}>{p.direction.reasons[b.reason](ARTIFACT_NAMES[locale][b.part])}</li>
          ))}
        </ul>
        <Link href={back} className="font-semibold underline decoration-mint decoration-2 underline-offset-4">
          {p.present.back}
        </Link>
      </main>
    );
  }

  const lang = result.source.pack.language;
  const day = result.source.approvedAt ? new Intl.DateTimeFormat(lang === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Cairo" }).format(new Date(result.source.approvedAt)) : null;

  return (
    <DirectionPack
      source={result.source}
      cover={{ name: detail.inquiry.company_name || detail.inquiry.client_name, projectType: detail.inquiry.project_type, approvedDay: day }}
      ui={{
        back: p.present.back,
        backHref: back,
        previous: p.present.previous,
        next: p.present.next,
        fullscreen: p.present.fullscreen,
        slideOf: p.present.slideOf,
        exportSlides: p.present.exportSlides,
        exportA4: p.present.exportA4,
        printHelp: p.present.printHelp,
        keys: p.present.keys,
        previewBanner: p.present.previewBanner,
        printBlocked: p.present.printBlocked,
      }}
    />
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActivityPanel } from "@/components/crm/InquiryCrm";
import { requireAdmin } from "@/lib/admin/auth/state";
import { teamMembers } from "@/lib/admin/auth/config";
import { adminText } from "@/lib/admin/locale";
import { isLeadId, loadExtra } from "@/lib/crm/lead-load";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Activity" };

export default async function LeadActivity({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!isLeadId(id)) notFound();
  const extra = await loadExtra(id);
  if (!extra) notFound();
  const { locale, t } = await adminText();
  return <ActivityPanel extra={extra} t={t} locale={locale} members={teamMembers()} />;
}

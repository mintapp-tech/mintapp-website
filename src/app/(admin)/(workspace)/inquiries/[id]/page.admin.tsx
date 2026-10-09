import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth/state";
import { isLeadId } from "@/lib/crm/lead-load";

// An inquiry's page is now its lead page. Old links and bookmarks land there.
export default async function InquiryMoved({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!isLeadId(id)) notFound();
  redirect(`/leads/${id}`);
}

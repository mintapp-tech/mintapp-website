import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth/state";

// Inquiries now live in Leads & Clients. Old links and bookmarks land there.
export default async function InquiriesMoved() {
  await requireAdmin();
  redirect("/leads");
}

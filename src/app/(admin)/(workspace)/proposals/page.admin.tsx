import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth/state";

// Proposals live on each lead's Deal tab; the list is Leads & Clients at the Proposal step.
export default async function ProposalsMoved() {
  await requireAdmin();
  redirect("/leads?stage=proposal");
}

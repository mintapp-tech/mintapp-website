import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth/state";

// The pipeline is now the position filter on Leads & Clients.
export default async function PipelineMoved() {
  await requireAdmin();
  redirect("/leads");
}

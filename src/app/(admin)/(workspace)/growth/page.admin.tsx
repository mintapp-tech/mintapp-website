import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth/state";

// Growth: until its own page is built, the prospect list.
export default async function GrowthPage() {
  await requireAdmin();
  redirect("/outreach");
}

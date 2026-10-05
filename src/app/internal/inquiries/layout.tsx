import type { ReactNode } from "react";
import Shell from "@/components/dashboard/Shell";
import { requireTeamMember } from "@/lib/team-auth/guard";
import { isLocalDashboardDemo } from "@/lib/sql-gateway";

// Chrome for every inquiries page, so loading, error and not-found states
// render inside it. Each page and action still checks the session itself:
// layouts are not re-run on client-side navigation.
export default async function InquiriesLayout({ children }: { children: ReactNode }) {
  const member = await requireTeamMember();
  return (
    <Shell member={member} demo={isLocalDashboardDemo()}>
      {children}
    </Shell>
  );
}

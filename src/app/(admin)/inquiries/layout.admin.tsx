import type { ReactNode } from "react";
import Shell from "@/components/dashboard/Shell";
import { requireAdmin } from "@/lib/admin/auth/state";
import { adminText } from "@/lib/admin/locale";
import { isLocalDashboardDemo } from "@/lib/sql-gateway";

// Chrome for every inquiries page, so loading, error and not-found states
// render inside it. Each page and action still checks the session itself:
// layouts are not re-run on client-side navigation.
export default async function InquiriesLayout({ children }: { children: ReactNode }) {
  const member = await requireAdmin();
  const { locale, t } = await adminText();
  return (
    <Shell member={member} demo={isLocalDashboardDemo()} locale={locale} t={t}>
      {children}
    </Shell>
  );
}

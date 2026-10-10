import Link from "next/link";
import { card, primary } from "@/components/dashboard/ui";
import { adminText } from "@/lib/admin/locale";

// An unknown lead (a mistyped or removed link): inside the workspace, never indexed.
export default async function LeadNotFound() {
  const { t } = await adminText();
  return (
    <div className={`${card} mx-auto mt-6 max-w-[520px] px-6 py-12 text-center`}>
      <h1 className="m-0 text-[22px] font-bold tracking-[-0.02em] rtl:tracking-normal">{t.states.notFoundTitle}</h1>
      <p className="mt-2 mb-6 text-[14px] leading-relaxed text-ink-soft">{t.states.notFoundBody}</p>
      <Link href="/leads" className={primary}>
        {t.states.back}
      </Link>
    </div>
  );
}

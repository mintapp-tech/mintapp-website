import Link from "next/link";
import { card, primary } from "@/components/dashboard/ui";
import { adminText } from "@/lib/admin/locale";

export default async function WorkspaceNotFound() {
  const { t } = await adminText();
  return (
    <div className={`${card} mx-auto mt-6 max-w-[520px] px-6 py-12 text-center`}>
      <h1 className="m-0 text-[22px] font-bold tracking-[-0.02em] rtl:tracking-normal">{t.crm.notFound.title}</h1>
      <p className="mt-2 mb-6 text-[14px] leading-relaxed text-ink-soft">{t.crm.notFound.body}</p>
      <Link href="/dashboard" className={primary}>
        {t.crm.notFound.back}
      </Link>
    </div>
  );
}

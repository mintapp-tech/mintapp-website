"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { button, card, primary } from "@/components/dashboard/ui";
import { isAdminLocale, messagesFor } from "@/lib/admin/messages";

// Shown when loading a page or running an action fails. The underlying error
// is logged on the server; only its opaque digest is shown here.
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // The interface language is on <html lang>, set by the admin layout.
  const current = useSyncExternalStore(
    () => () => {},
    () => document.documentElement.lang,
    () => "en",
  );
  const lang = isAdminLocale(current) ? current : "en";
  const t = messagesFor(lang).states;
  return (
    <div role="alert" className={`${card} mx-auto mt-6 max-w-[560px] px-6 py-12 text-center`}>
      <h1 className="m-0 text-[22px] font-bold tracking-[-0.02em] rtl:tracking-normal">{t.errorTitle}</h1>
      <p className="mt-2 mb-6 text-[14px] leading-relaxed text-ink-soft">{t.errorBody}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={reset} className={primary}>
          {t.tryAgain}
        </button>
        <Link href="/dashboard" className={button}>
          {messagesFor(lang).crm.nav.dashboard}
        </Link>
      </div>
      {error.digest && <p className="mt-6 mb-0 text-[12px] text-ink-faint">{t.reference(error.digest)}</p>}
    </div>
  );
}

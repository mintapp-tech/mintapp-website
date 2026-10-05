"use client";

import Link from "next/link";
import { useEffect } from "react";
import { button, card, primary } from "@/components/dashboard/ui";

// Shown when loading a page or running an action fails. The underlying error
// is logged on the server; only its opaque digest is shown here.
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    document.title = "Something went wrong · Mintapp team";
  }, []);
  return (
    <div role="alert" className={`${card} mx-auto mt-6 max-w-[560px] px-6 py-12 text-center`}>
      <h1 className="m-0 text-[22px] font-bold tracking-[-0.02em]">This page could not be loaded</h1>
      <p className="mt-2 mb-6 text-[14px] leading-relaxed text-ink-soft">
        The dashboard could not reach its data, or the last action did not finish. If you were saving something, check whether it was saved before trying again.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={reset} className={primary}>
          Try again
        </button>
        <Link href="/internal/inquiries" className={button}>
          All inquiries
        </Link>
      </div>
      {error.digest && <p className="mt-6 mb-0 text-[12px] text-ink-faint">Reference: {error.digest}</p>}
    </div>
  );
}

"use client";

import { useLanguage } from "@/lib/language-context";

// Every page's <main> carries this id (and tabIndex={-1} so it can receive focus).
const MAIN_CONTENT_ID = "main-content";

export function SkipLink() {
  const { t } = useLanguage();
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="sr-only rounded-full bg-ink px-5 py-3 text-[15px] font-semibold text-white focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[100] focus:text-white"
    >
      {t.nav.skip}
    </a>
  );
}

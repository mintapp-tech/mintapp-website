"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { ar } from "@/lib/i18n/ar";
import { en } from "@/lib/i18n/en";
import type { Lang, HomeContent } from "@/lib/i18n/types";
import { SUPPORTED_LOCALES } from "@/lib/locales";

interface LanguageContextValue {
  lang: Lang;
  dir: "rtl" | "ltr";
  t: HomeContent;
  arrow: string;
  backArrow: string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const LOCALE_COOKIE = "mintapp_locale";

// The same page in another locale: /en/work/jameel -> /ar/work/jameel.
export function localizedPath(pathname: string, locale: Lang): string {
  const segments = pathname.split("/").filter(Boolean);
  const rest = SUPPORTED_LOCALES.includes(segments[0] as Lang) ? segments.slice(1) : segments;
  return rest.length ? `/${locale}/${rest.join("/")}` : `/${locale}`;
}

export function rememberLocale(locale: Lang) {
  try {
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  } catch {
    // cookies unavailable
  }
}

/**
 * The locale is authoritative from the URL (set server-side by [locale]/layout.tsx
 * via `locale`), not client state — this provider just exposes it through the same
 * `useLanguage()` shape the rest of the app already depends on.
 */
export function LanguageProvider({ children, locale }: { children: ReactNode; locale: Lang }) {
  useEffect(() => {
    // Defensive: the server already renders the correct lang/dir for this route;
    // this just keeps them in sync across client-side locale-to-locale navigations.
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  const isAr = locale === "ar";
  const value: LanguageContextValue = {
    lang: locale,
    dir: isAr ? "rtl" : "ltr",
    t: isAr ? ar : en,
    arrow: isAr ? "←" : "→",
    backArrow: isAr ? "→" : "←",
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}

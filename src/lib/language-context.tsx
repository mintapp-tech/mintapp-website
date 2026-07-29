"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ar } from "@/lib/i18n/ar";
import { en } from "@/lib/i18n/en";
import type { Lang, HomeContent } from "@/lib/i18n/types";

interface LanguageContextValue {
  lang: Lang;
  dir: "rtl" | "ltr";
  t: HomeContent;
  arrow: string;
  backArrow: string;
  toggleLang: () => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = "mintapp.lang";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("ar");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      // Intentional: first render must match the server's "ar" default to avoid
      // a hydration mismatch, so the stored preference is only applied post-mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored === "ar" || stored === "en") setLang(stored);
    } catch {
      // localStorage unavailable
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const toggleLang = () => {
    setLang((prev) => {
      const next = prev === "ar" ? "en" : "ar";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // localStorage unavailable
      }
      return next;
    });
  };

  const value = useMemo<LanguageContextValue>(() => {
    const isAr = lang === "ar";
    return {
      lang,
      dir: isAr ? "rtl" : "ltr",
      t: isAr ? ar : en,
      arrow: isAr ? "←" : "→",
      backArrow: isAr ? "→" : "←",
      toggleLang,
    };
  }, [lang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}

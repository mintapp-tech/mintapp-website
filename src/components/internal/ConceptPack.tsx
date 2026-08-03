"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ar } from "@/lib/i18n/ar";
import { en } from "@/lib/i18n/en";
import type { Lang } from "@/lib/i18n/types";
import { LogoMark } from "@/components/Logo";

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-ink/[.09] bg-surface p-5">
      <div className="mb-3 font-manrope text-[11px] font-bold tracking-[.12em] text-ink-faint uppercase">
        {title}
      </div>
      {children}
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <Block title={title}>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-2.5 text-[14.5px] leading-[1.65] text-ink">
            <span className="mt-2 block h-[4px] w-[4px] flex-none rounded-full bg-ink-faint" />
            {item}
          </div>
        ))}
      </div>
    </Block>
  );
}

const STORAGE_KEY = "mintapp.internal.lang";

export default function ConceptPack() {
  // Deliberately independent of the public site's URL-based locale system —
  // this route lives outside /[locale] on purpose (see src/app/internal/layout.tsx).
  const [lang, setLang] = useState<Lang>("ar");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
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
      const next: Lang = prev === "ar" ? "en" : "ar";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // localStorage unavailable
      }
      return next;
    });
  };

  const t = lang === "ar" ? ar : en;
  const intern = t.intern;

  return (
    <div className="min-h-screen bg-canvas">
      <div className="border-b-2 border-[#D8BE78] bg-[#FFF9EC]">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="block h-2 w-2 flex-none rounded-full bg-[#D8BE78]" />
            <span className="text-[13.5px] font-semibold text-ink">{intern.warn}</span>
          </div>
          <button
            onClick={toggleLang}
            className="cursor-pointer rounded-full border border-ink/[.16] bg-transparent px-3.5 py-1.5 font-manrope text-[12px] font-bold tracking-[.08em] text-ink transition-colors hover:border-ink/30"
          >
            {t.nav.lang}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-[1100px] px-5 pt-7 pb-16 sm:px-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark size={24} />
            <span className="font-manrope text-[15px] font-bold tracking-[-0.02em] text-ink-soft">mintapp</span>
          </Link>
          <span className="font-manrope text-[12px] font-medium text-ink-faint">/internal</span>
        </div>

        <h1 className="m-0 text-[clamp(22px,2.6vw,30px)] font-semibold tracking-[-0.01em]">{intern.label}</h1>

        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-ink/[.09] bg-surface px-5 py-4">
          <span className="rounded-full bg-dark px-3 py-1 text-[13px] font-semibold text-mint">{intern.lead}</span>
          {intern.meta.map((m) => (
            <span key={m.k} className="text-[13.5px] text-ink-soft">
              <span className="font-medium text-ink">{m.k}:</span> {m.v}
            </span>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Block title={intern.s.summary}>
            <p className="m-0 text-[14.5px] leading-[1.75] text-ink">{intern.summary}</p>
          </Block>
          <Block title={intern.s.platform}>
            <p className="m-0 text-[14.5px] leading-[1.75] text-ink">{intern.platform}</p>
          </Block>

          <ListBlock title={intern.s.assumptions} items={intern.assumptions} />
          <ListBlock title={intern.s.users} items={intern.users} />

          <ListBlock title={intern.s.features} items={intern.features} />
          <Block title={intern.s.flow}>
            <div className="flex flex-wrap items-center gap-1.5">
              {intern.flow.map((step, i) => (
                <span key={step} className="flex items-center gap-1.5">
                  <span className="rounded-full bg-canvas px-3 py-1.5 text-[13px] font-medium text-ink">{step}</span>
                  {i < intern.flow.length - 1 && <span className="text-ink-faint">→</span>}
                </span>
              ))}
            </div>
          </Block>

          <Block title={intern.s.visual}>
            <p className="m-0 text-[14.5px] leading-[1.75] text-ink">{intern.visual}</p>
          </Block>
          <ListBlock title={intern.s.screens} items={intern.screens} />

          <Block title={intern.s.phases}>
            <div className="flex flex-col gap-2.5">
              {intern.phases.map((phase) => (
                <div key={phase.t} className="flex items-baseline gap-2.5 text-[14.5px]">
                  <span className="font-semibold text-ink">{phase.t}</span>
                  <span className="text-ink-soft">{phase.d}</span>
                </div>
              ))}
            </div>
          </Block>
          <ListBlock title={intern.s.questions} items={intern.questions} />

          <ListBlock title={intern.s.risks} items={intern.risks} />
          <ListBlock title={intern.s.tech} items={intern.tech} />
        </div>
      </div>
    </div>
  );
}

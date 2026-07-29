"use client";

import { useLanguage } from "@/lib/language-context";
import { Reveal, RevealGroup, RevealItem } from "./Reveal";

export default function InsightsSection() {
  const { t, arrow } = useLanguage();

  return (
    <section id="insights" className="mx-auto max-w-[1280px] scroll-mt-24 px-5 pt-[clamp(56px,8vw,116px)] sm:px-6">
      <Reveal className="mb-[clamp(26px,3.4vw,44px)] flex flex-wrap items-end justify-between gap-4.5">
        <h2 className="m-0 text-[clamp(27px,3.4vw,44px)] leading-[1.2] font-semibold tracking-[-0.02em]">
          {t.ins.title}
        </h2>
        <button className="flex items-center gap-2 border-0 border-b-[1.5px] border-mint bg-transparent pb-1 text-[15.5px] font-semibold text-dark transition-all hover:gap-3.5">
          {t.ins.all} <span className="block">{arrow}</span>
        </button>
      </Reveal>
      <RevealGroup className="grid grid-cols-1 gap-[clamp(16px,2.2vw,24px)] sm:grid-cols-2 lg:grid-cols-3">
        {t.ins.items.map((item) => (
          <RevealItem key={item.title}>
            <button className="flex h-full w-full flex-col gap-3.5 rounded-[18px] border border-ink/[.09] bg-canvas p-[clamp(22px,2.4vw,30px)] text-start transition-all duration-500 hover:-translate-y-1 hover:border-ink/20">
              <span className="font-manrope text-[11.5px] font-bold tracking-[.12em] text-mint-deep uppercase">
                {item.cat}
              </span>
              <span className="text-[clamp(19px,1.9vw,22px)] leading-[1.4] font-semibold tracking-[-0.01em] text-ink">
                {item.title}
              </span>
              <span className="text-[15px] leading-[1.8] text-ink-soft">{item.blurb}</span>
              <span className="mt-auto flex items-center gap-2 pt-2 text-[14.5px] font-semibold text-dark">
                {t.ins.read} <span className="block">{arrow}</span>
              </span>
            </button>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}

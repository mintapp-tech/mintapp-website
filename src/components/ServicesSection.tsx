"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/language-context";
import { Reveal, RevealGroup, RevealItem } from "./Reveal";
import { SplitReveal } from "./motion/SplitReveal";

// One glyph per service area, drawn from the same simple shapes the site already uses.
const ICONS = [
  <span key="web" className="block h-[13px] w-[19px] rounded-[3px] border-2 border-mint" />,
  <span key="app" className="relative block h-[15px] w-[19px] rounded-[3px] border-2 border-mint">
    <span className="absolute inset-y-0 start-[5px] block w-[2px] bg-mint" />
  </span>,
  <span key="mobile" className="block h-[19px] w-3 rounded-[4px] border-2 border-mint" />,
];

export default function ServicesSection() {
  const { t, lang, arrow } = useLanguage();
  const servicesHref = `/${lang}/services`;

  return (
    <section id="services" className="mx-auto max-w-[1280px] scroll-mt-24 px-5 pt-[clamp(56px,8vw,116px)] sm:px-6">
      <Reveal className="mb-3.5 font-manrope text-[12.5px] font-bold tracking-[.14em] text-mint-deep uppercase">
        {t.svc.eyebrow}
      </Reveal>
      <SplitReveal
        as="h2"
        text={t.svc.title}
        className="mb-[clamp(30px,4vw,52px)] max-w-[24ch] text-[clamp(29px,3.7vw,50px)] leading-[1.2] font-semibold tracking-[-0.02em] text-balance"
      />

      <RevealGroup className="grid grid-cols-1 gap-[clamp(18px,2.4vw,24px)] md:grid-cols-3">
        {t.svc.items.map((item, i) => (
          <RevealItem
            key={item.title}
            className="flex flex-col gap-4 rounded-[20px] border border-ink/[.09] bg-surface p-[clamp(24px,2.6vw,34px)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_30px_60px_-46px_rgba(7,27,22,.5)]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-dark">{ICONS[i % ICONS.length]}</span>
            <h3 className="m-0 text-[clamp(21px,2vw,26px)] font-semibold tracking-[-0.01em]">{item.title}</h3>
            <div className="border-s-2 border-mint ps-3.5">
              <div className="font-manrope text-[11.5px] font-bold tracking-[.1em] text-ink-faint uppercase rtl:text-[13px]">{t.svc.needLabel}</div>
              <p className="m-0 mt-1 text-[15px] leading-[1.7] text-ink">{item.need}</p>
            </div>
            <p className="m-0 text-[15.5px] leading-[1.8] text-ink-soft">{item.desc}</p>
            <ul className="m-0 mt-auto flex list-none flex-col gap-2.5 p-0">
              {item.points.map((point) => (
                <li key={point} className="flex items-center gap-2.5 border-t border-ink/[.08] pt-2.5 text-[14.5px] text-ink">
                  <span aria-hidden className="block h-[5px] w-[5px] flex-none rounded-full bg-mint-deep" />
                  {point}
                </li>
              ))}
            </ul>
          </RevealItem>
        ))}
      </RevealGroup>

      <Reveal className="mt-[clamp(20px,2.6vw,28px)] flex flex-wrap items-center gap-[clamp(14px,2vw,22px)] rounded-[20px] border border-ink/[.09] p-[clamp(22px,3vw,30px)]">
        <div className="max-w-[20ch] shrink-0 text-[14.5px] leading-[1.7] text-ink-soft">{t.svc.stripLabel}</div>
        <div className="group relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
          <div className="flex w-max items-center gap-2.5 animate-marquee group-hover:[animation-play-state:paused]">
            {[...t.svc.strip, ...t.svc.strip].map((s, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span className="block whitespace-nowrap rounded-full bg-canvas px-4 py-2.5 text-[14.5px] font-medium text-ink">{s}</span>
                <span className="block text-[13px] text-ink/[.28]">{arrow}</span>
              </div>
            ))}
          </div>
        </div>
        <Link
          href={servicesHref}
          className="flex shrink-0 items-center gap-2 border-0 border-b-[1.5px] border-mint bg-transparent pb-1 text-[15.5px] font-semibold text-dark transition-all hover:gap-3.5"
        >
          {t.svc.more} <span className="block">{arrow}</span>
        </Link>
      </Reveal>
    </section>
  );
}

"use client";

import { useLanguage } from "@/lib/language-context";
import { Reveal, RevealGroup, RevealItem } from "./Reveal";
import { SplitReveal } from "./motion/SplitReveal";

function ServiceCard({
  icon,
  title,
  desc,
  items,
  more,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  items: string[];
  more: string;
}) {
  return (
    <RevealItem className="flex flex-col gap-4 rounded-[20px] border border-ink/[.09] bg-surface p-[clamp(26px,3vw,40px)]">
      <span className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-dark">{icon}</span>
      <h3 className="m-0 text-[clamp(22px,2.2vw,28px)] font-semibold tracking-[-0.01em]">{title}</h3>
      <p className="m-0 max-w-[40ch] text-[16.5px] leading-[1.85] text-ink-soft">{desc}</p>
      <div className="mt-1.5 flex flex-col gap-2.5">
        {items.map((it) => (
          <div key={it} className="flex items-center gap-2.5 border-t border-ink/[.08] pt-2.5 text-[15px] text-ink">
            <span className="block h-[5px] w-[5px] rounded-full bg-mint-deep" />
            {it}
          </div>
        ))}
      </div>
      <button className="mt-2.5 flex items-center gap-2 self-start border-0 border-b-[1.5px] border-mint bg-transparent pb-1 text-[15.5px] font-semibold text-dark transition-all hover:gap-3.5">
        {more}
      </button>
    </RevealItem>
  );
}

export default function ServicesSection() {
  const { t, arrow } = useLanguage();

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

      <RevealGroup className="grid grid-cols-1 gap-[clamp(18px,2.4vw,26px)] sm:grid-cols-2">
        <ServiceCard
          icon={<span className="block h-[14px] w-[18px] rounded-[3px] border-2 border-mint" />}
          title={t.svc.s1.title}
          desc={t.svc.s1.desc}
          items={t.svc.s1.items}
          more={t.svc.more}
        />
        <ServiceCard
          icon={<span className="block h-[19px] w-3 rounded-[4px] border-2 border-mint" />}
          title={t.svc.s2.title}
          desc={t.svc.s2.desc}
          items={t.svc.s2.items}
          more={t.svc.more}
        />
      </RevealGroup>

      <Reveal className="mt-[clamp(20px,2.6vw,28px)] flex flex-wrap items-center gap-[clamp(14px,2vw,22px)] rounded-[20px] border border-ink/[.09] p-[clamp(24px,3vw,34px)]">
        <div className="max-w-[20ch] shrink-0 text-[14.5px] leading-[1.7] text-ink-soft">{t.svc.stripLabel}</div>
        <div className="group relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
          <div className="flex w-max items-center gap-2.5 animate-marquee group-hover:[animation-play-state:paused]">
            {[...t.svc.strip, ...t.svc.strip].map((s, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span className="block whitespace-nowrap rounded-full bg-canvas px-4 py-2.5 text-[14.5px] font-medium text-ink">
                  {s}
                </span>
                <span className="block text-[13px] text-ink/[.28]">{arrow}</span>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

"use client";

import Image from "next/image";
import { useLanguage } from "@/lib/language-context";
import { TEAM } from "@/content/team";
import { Reveal, RevealGroup, RevealItem } from "./Reveal";
import { SplitReveal } from "./motion/SplitReveal";

// "Built by": who Mintapp is. Used on the homepage and the About page.
export default function TeamSection({ className = "pt-[clamp(56px,8vw,116px)]" }: { className?: string }) {
  const { t, lang } = useLanguage();
  return (
    <section id="team" className={`mx-auto max-w-[1280px] scroll-mt-24 px-5 sm:px-6 ${className}`}>
      <Reveal className="mb-3.5 font-manrope text-[12.5px] font-bold tracking-[.14em] text-mint-deep uppercase">{t.team.eyebrow}</Reveal>
      <SplitReveal
        as="h2"
        text={t.team.title}
        className="mb-4 max-w-[22ch] text-[clamp(29px,3.7vw,50px)] leading-[1.2] font-semibold tracking-[-0.02em] text-balance rtl:tracking-normal"
      />
      <Reveal className="m-0 mb-[clamp(28px,3.6vw,46px)] max-w-[56ch] text-[clamp(16px,1.3vw,18px)] leading-[1.75] text-ink-soft">
        {t.team.sub}
      </Reveal>

      <RevealGroup className="grid grid-cols-1 gap-[clamp(16px,2.2vw,24px)] md:grid-cols-2">
        {TEAM.map((m) => (
          <RevealItem key={m.id} className="h-full">
            <article className="flex h-full flex-col gap-5 rounded-[20px] border border-ink/[.09] bg-surface p-[clamp(22px,2.6vw,32px)] sm:flex-row sm:items-start">
              <Image src={m.photo} alt={m.name} width={112} height={112} className="h-[104px] w-[104px] flex-none rounded-[18px] object-cover" />
              <div className="min-w-0">
                <h3 className="m-0 text-[clamp(19px,1.6vw,22px)] font-semibold text-ink">
                  <bdi>{m.name}</bdi>
                </h3>
                <p className="m-0 mt-1 text-[15px] font-semibold text-mint-deep">{m.role[lang]}</p>
                <p className="m-0 mt-3 text-[15.5px] leading-[1.7] text-ink-soft text-pretty">{m.bio[lang]}</p>
              </div>
            </article>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}

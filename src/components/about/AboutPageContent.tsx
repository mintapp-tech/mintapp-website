"use client";

import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/language-context";
import { Reveal, RevealGroup, RevealItem } from "@/components/Reveal";
import { SplitReveal } from "@/components/motion/SplitReveal";
import { Magnetic } from "@/components/motion/Magnetic";

export default function AboutPageContent() {
  const { t } = useLanguage();
  const router = useRouter();
  const about = t.about;

  return (
    <>
      <section className="mx-auto max-w-[1280px] px-5 pt-[clamp(34px,5vw,68px)] sm:px-6">
        <SplitReveal
          as="h1"
          text={about.title}
          className="m-0 max-w-[20ch] text-[clamp(32px,4.6vw,58px)] font-semibold leading-[1.16] tracking-[-0.02em] text-balance"
        />
        <Reveal delay={0.1} className="mt-5 max-w-[60ch] text-[17px] leading-[1.9] text-ink-soft">
          {about.sub}
        </Reveal>
      </section>

      <section className="mx-auto mt-[clamp(48px,6vw,80px)] max-w-[1280px] px-5 sm:px-6">
        <div className="grid grid-cols-1 gap-[clamp(30px,4vw,56px)] lg:grid-cols-2">
          <Reveal as="div">
            <div className="mb-3 font-manrope text-[12.5px] font-bold tracking-[.14em] text-mint-deep uppercase">
              {about.purposeTitle}
            </div>
            <p className="m-0 text-[17px] leading-[1.9] text-ink-soft">{about.purposeCopy}</p>
          </Reveal>
          <Reveal as="div" delay={0.1}>
            <div className="mb-3 font-manrope text-[12.5px] font-bold tracking-[.14em] text-mint-deep uppercase">
              {about.approachTitle}
            </div>
            <p className="m-0 text-[17px] leading-[1.9] text-ink-soft">{about.approachCopy}</p>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto mt-[clamp(56px,7vw,96px)] max-w-[1280px] px-5 sm:px-6">
        <SplitReveal
          as="h2"
          text={about.valuesTitle}
          className="m-0 mb-[clamp(24px,3vw,36px)] text-[clamp(26px,3.2vw,40px)] font-semibold tracking-[-0.02em]"
        />
        <RevealGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {about.values.map((value) => (
            <RevealItem key={value.t} className="rounded-2xl border border-ink/[.08] bg-surface p-6">
              <div className="mb-2 text-[17px] font-semibold">{value.t}</div>
              <div className="text-[14.5px] leading-[1.75] text-ink-soft">{value.d}</div>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      <section className="mx-auto mt-[clamp(56px,7vw,96px)] max-w-[1280px] px-5 sm:px-6">
        <Reveal className="rounded-[24px] border border-ink/[.08] bg-surface p-[clamp(26px,4vw,54px)]">
          <h2 className="m-0 mb-[clamp(20px,2.6vw,28px)] text-[clamp(24px,2.8vw,34px)] font-semibold tracking-[-0.01em]">
            {about.modelTitle}
          </h2>
          <div className="flex flex-col gap-3">
            {about.model.map((item, i) => (
              <div
                key={item.t}
                className="flex items-start gap-4 rounded-2xl border border-ink/[.08] bg-canvas p-5 py-[18px]"
              >
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-[9px] bg-dark font-manrope text-[13px] font-bold text-mint">
                  {i + 1}
                </span>
                <div>
                  <div className="mb-1.5 text-[16px] font-semibold">{item.t}</div>
                  <div className="text-[14.5px] leading-[1.7] text-ink-soft">{item.d}</div>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      <section className="mx-auto mt-[clamp(56px,7vw,96px)] max-w-[1280px] px-5 sm:px-6">
        <Reveal className="grid grid-cols-1 items-center gap-[clamp(24px,3vw,40px)] rounded-[24px] bg-canvas p-[clamp(26px,4vw,50px)] lg:grid-cols-[1.2fr_1fr]">
          <div>
            <div className="mb-3 font-manrope text-[12.5px] font-bold tracking-[.14em] text-mint-deep uppercase">
              {about.regionTitle}
            </div>
            <p className="m-0 max-w-[52ch] text-[16.5px] leading-[1.85] text-ink-soft">{about.regionCopy}</p>
          </div>
          <div className="flex flex-wrap gap-2.5 lg:justify-end">
            <span className="rounded-full border border-ink/[.12] bg-surface px-5 py-2.5 text-[14px] font-medium text-ink">
              {t.footer.region}
            </span>
          </div>
        </Reveal>
      </section>

      <section className="mx-auto mt-[clamp(56px,7vw,96px)] max-w-[1280px] px-5 pb-[clamp(60px,8vw,100px)] sm:px-6">
        <Reveal className="relative overflow-hidden rounded-[24px] bg-dark p-[clamp(32px,6vw,70px)] text-center text-canvas">
          <span className="absolute -end-[80px] -top-[80px] block h-[260px] w-[260px] rounded-full bg-mint/10" />
          <h2 className="relative m-0 text-[clamp(26px,3.4vw,42px)] font-semibold tracking-[-0.02em] text-balance">
            {about.ctaTitle}
          </h2>
          <div className="relative mt-6 flex justify-center">
            <Magnetic className="inline-block">
              <button
                onClick={() => router.push("/start")}
                className="cursor-pointer rounded-full border-0 bg-mint px-8 py-[16px] text-[16px] font-bold text-dark transition-colors hover:bg-mint-soft"
              >
                {about.ctaBtn}
              </button>
            </Magnetic>
          </div>
        </Reveal>
      </section>
    </>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/language-context";
import { Reveal, RevealGroup, RevealItem } from "@/components/Reveal";
import { SplitReveal } from "@/components/motion/SplitReveal";
import { Magnetic } from "@/components/motion/Magnetic";
import { scrollToSection } from "@/lib/scroll";

export default function NazarihCaseStudy() {
  const { t, lang, arrow, backArrow } = useLanguage();
  const router = useRouter();
  const cs = t.csNazarih;

  const goWork = () => {
    if (window.location.pathname === `/${lang}`) scrollToSection("work");
    else router.push(`/${lang}#work`);
  };

  return (
    <>
      <section className="mx-auto max-w-[1280px] px-5 pt-[clamp(34px,5vw,68px)] sm:px-6">
        <button
          onClick={goWork}
          className="mb-[clamp(26px,4vw,44px)] flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-[14.5px] text-ink-soft transition-colors hover:text-ink"
        >
          <span className="block">{backArrow}</span> {cs.back}
        </button>

        <Reveal className="mb-4 flex items-center gap-3">
          <span className="font-manrope text-[12.5px] font-bold tracking-[.14em] text-mint-deep uppercase">
            {cs.eyebrow}
          </span>
        </Reveal>

        <SplitReveal
          as="h1"
          text={cs.title}
          delay={0.05}
          className="m-0 max-w-[24ch] text-[clamp(32px,4.6vw,58px)] leading-[1.16] font-semibold tracking-[-0.02em] text-balance"
        />
        <Reveal delay={0.1} className="mt-5 flex items-baseline gap-3">
          <span className="text-[22px] font-semibold">{cs.name}</span>
          <span className="text-[15px] text-ink-soft">{cs.category}</span>
        </Reveal>
        <Reveal delay={0.15} className="mt-4 max-w-[60ch] text-[17px] leading-[1.9] text-ink-soft">
          {cs.sub}
        </Reveal>

        <RevealGroup className="mt-[clamp(32px,4.4vw,52px)] grid grid-cols-2 gap-x-6 gap-y-6 border-t border-ink/[.09] pt-[clamp(24px,3vw,34px)] sm:grid-cols-4">
          {cs.meta.map((m) => (
            <RevealItem key={m.k}>
              <div className="mb-1.5 font-manrope text-[11.5px] font-bold tracking-[.12em] text-ink-faint uppercase">
                {m.k}
              </div>
              <div className="text-[15.5px] font-medium text-ink">{m.v}</div>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      <section className="mx-auto mt-[clamp(50px,7vw,90px)] max-w-[1280px] px-5 sm:px-6">
        <Reveal className="relative overflow-hidden rounded-[24px] bg-nazarih-bg p-[clamp(24px,5vw,60px)]">
          <span className="absolute -end-[70px] -top-[70px] block h-[260px] w-[260px] rounded-full bg-nazarih/[.2]" />
          <div className="relative flex flex-wrap items-center justify-center gap-6 py-[clamp(20px,4vw,50px)]">
            <div
              className="w-[min(30%,190px)] -translate-y-3 -rotate-6 rounded-[30px] bg-[#0A0D0C] p-2 shadow-[0_40px_70px_-30px_rgba(0,0,0,.6)]"
              style={{ aspectRatio: "9 / 18.6" }}
            >
              <div className="flex h-full flex-col gap-2.5 rounded-[22px] bg-canvas p-3.5">
                <span className="mx-auto block h-1 w-8 rounded-full bg-ink/[.18]" />
                <div className="grid grid-cols-3 gap-1.5">
                  {["bg-nazarih-2", "bg-surface", "bg-surface"].map((c, i) => (
                    <span key={i} className={`block h-[18px] rounded-full ${c}`} />
                  ))}
                </div>
                <div className="h-[90px] rounded-[14px] bg-nazarih-2" />
                <span className="block h-1.5 w-[60%] rounded bg-dark" />
                <span className="block h-1.5 w-[35%] rounded bg-nazarih" />
              </div>
            </div>
            <div
              className="w-[min(34%,214px)] translate-y-4 rounded-[32px] bg-[#0A0D0C] p-2 shadow-[0_44px_80px_-30px_rgba(0,0,0,.65)]"
              style={{ aspectRatio: "9 / 18.6" }}
            >
              <div className="flex h-full flex-col overflow-hidden rounded-[24px] bg-canvas">
                <div className="flex flex-col gap-2 px-3.5 pb-2 pt-4">
                  <span className="block h-2.5 w-[55%] rounded bg-dark" />
                  <span className="block h-1.5 w-[75%] rounded bg-ink/[.16]" />
                </div>
                <div className="flex-1 p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-[70px] rounded-xl bg-nazarih" />
                    <div className="h-[70px] rounded-xl bg-surface" />
                  </div>
                  <span className="mt-2 block h-1.5 w-[80%] rounded bg-ink/[.12]" />
                  <span className="mt-1 block h-1.5 w-[40%] rounded bg-nazarih" />
                </div>
                <div className="p-3.5">
                  <div className="flex h-9 items-center justify-center rounded-full bg-dark">
                    <span className="block h-1.5 w-[38%] rounded-sm bg-nazarih-2" />
                  </div>
                </div>
              </div>
            </div>
            <div
              className="w-[min(30%,190px)] -translate-y-2 rotate-6 rounded-[30px] bg-[#0A0D0C] p-2 shadow-[0_40px_70px_-30px_rgba(0,0,0,.6)]"
              style={{ aspectRatio: "9 / 18.6" }}
            >
              <div className="flex h-full flex-col gap-2.5 rounded-[22px] bg-canvas p-3.5">
                <span className="mx-auto block h-1 w-8 rounded-full bg-ink/[.18]" />
                <span className="block h-2.5 w-[45%] rounded bg-dark" />
                <div className="flex flex-1 flex-col gap-2">
                  <div className="h-11 rounded-xl border border-ink/[.08] bg-surface" />
                  <div className="h-11 rounded-xl bg-nazarih-2" />
                  <div className="h-11 rounded-xl border border-ink/[.08] bg-surface" />
                </div>
                <div className="flex h-9 items-center justify-center rounded-full bg-nazarih">
                  <span className="block h-1.5 w-[40%] rounded-sm bg-white/90" />
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="mx-auto mt-[clamp(56px,8vw,110px)] max-w-[1280px] px-5 sm:px-6">
        <div className="grid grid-cols-1 gap-[clamp(30px,4vw,56px)] lg:grid-cols-2">
          <Reveal as="div">
            <div className="mb-3 font-manrope text-[12.5px] font-bold tracking-[.14em] text-mint-deep uppercase">
              {cs.challengeTitle}
            </div>
            <p className="m-0 text-[17px] leading-[1.9] text-ink-soft">{cs.challengeCopy}</p>
          </Reveal>
          <Reveal as="div" delay={0.1}>
            <div className="mb-3 font-manrope text-[12.5px] font-bold tracking-[.14em] text-mint-deep uppercase">
              {cs.approachTitle}
            </div>
            <p className="m-0 text-[17px] leading-[1.9] text-ink-soft">{cs.approachCopy}</p>
          </Reveal>
        </div>

        <RevealGroup className="mt-[clamp(24px,3vw,36px)] grid grid-cols-1 gap-4 sm:grid-cols-3">
          {cs.approachPoints.map((p) => (
            <RevealItem key={p.t} className="rounded-2xl border border-ink/[.08] bg-surface p-6">
              <div className="mb-2 text-[16px] font-semibold">{p.t}</div>
              <div className="text-[14.5px] leading-[1.75] text-ink-soft">{p.d}</div>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      <section className="mx-auto mt-[clamp(56px,8vw,110px)] max-w-[1280px] px-5 sm:px-6">
        <SplitReveal
          as="h2"
          text={cs.uxTitle}
          className="m-0 mb-[clamp(24px,3vw,36px)] text-[clamp(26px,3.2vw,40px)] font-semibold tracking-[-0.02em]"
        />
        <RevealGroup className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {cs.uxPoints.map((p) => (
            <RevealItem key={p.t} className="rounded-2xl border border-ink/[.08] bg-canvas p-6">
              <div className="mb-2 text-[16px] font-semibold">{p.t}</div>
              <div className="text-[14.5px] leading-[1.75] text-ink-soft">{p.d}</div>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      <section className="mx-auto mt-[clamp(56px,8vw,110px)] max-w-[1280px] px-5 sm:px-6">
        <Reveal className="mb-3 font-manrope text-[12.5px] font-bold tracking-[.14em] text-mint-deep uppercase">
          {cs.screensTitle}
        </Reveal>
        <Reveal delay={0.05} className="mb-[clamp(24px,3vw,36px)] max-w-[60ch] text-[16px] leading-[1.85] text-ink-soft">
          {cs.screensCopy}
        </Reveal>
        <RevealGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { bg: "bg-nazarih-bg", accent: "bg-nazarih" },
            { bg: "bg-canvas", accent: "bg-dark" },
            { bg: "bg-nazarih-bg", accent: "bg-nazarih-2" },
            { bg: "bg-canvas", accent: "bg-nazarih" },
          ].map((screen, i) => (
            <RevealItem
              key={i}
              className={`flex aspect-[3/4] items-center justify-center rounded-2xl border border-ink/[.08] ${screen.bg} p-6`}
            >
              <div className="flex w-full flex-col gap-2.5">
                <span className="block h-2 w-[50%] rounded bg-dark/80" />
                <div className={`h-16 rounded-lg ${screen.accent}`} />
                <span className="block h-1.5 w-[70%] rounded bg-ink/[.14]" />
                <span className="block h-1.5 w-[40%] rounded bg-ink/[.14]" />
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      <section className="mx-auto mt-[clamp(56px,8vw,110px)] max-w-[1280px] px-5 sm:px-6">
        <Reveal className="grid grid-cols-1 items-center gap-[clamp(28px,4vw,50px)] rounded-[24px] border border-ink/[.08] bg-surface p-[clamp(26px,4vw,50px)] lg:grid-cols-2">
          <div>
            <div className="mb-3 font-manrope text-[12.5px] font-bold tracking-[.14em] text-mint-deep uppercase">
              {cs.dsTitle}
            </div>
            <p className="m-0 max-w-[46ch] text-[16px] leading-[1.85] text-ink-soft">{cs.dsCopy}</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span className="block h-14 w-14 rounded-2xl bg-nazarih" />
            <span className="block h-14 w-14 rounded-2xl bg-nazarih-2" />
            <span className="block h-14 w-14 rounded-2xl bg-dark" />
            <div className="flex flex-1 flex-col gap-2">
              <span className="block h-3 w-[70%] rounded bg-dark" />
              <span className="block h-2 w-[50%] rounded bg-ink/[.14]" />
              <span className="block h-2 w-[35%] rounded bg-ink/[.14]" />
            </div>
          </div>
        </Reveal>
      </section>

      <section className="mx-auto mt-[clamp(56px,8vw,110px)] max-w-[1280px] px-5 sm:px-6">
        <Reveal className="mb-3 font-manrope text-[12.5px] font-bold tracking-[.14em] text-mint-deep uppercase">
          {cs.outcomeTitle}
        </Reveal>
        <Reveal delay={0.05} className="max-w-[60ch] text-[17px] leading-[1.9] text-ink-soft">
          {cs.outcomeCopy}
        </Reveal>
        <RevealGroup className="mt-[clamp(20px,2.6vw,28px)] flex flex-wrap gap-3">
          {cs.outcomePoints.map((point) => (
            <RevealItem
              key={point}
              className="rounded-full border border-ink/[.12] bg-canvas px-5 py-3 text-[14.5px] font-medium text-ink"
            >
              {point}
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      <section className="mx-auto mt-[clamp(56px,8vw,110px)] max-w-[1280px] px-5 sm:px-6">
        <Reveal className="mb-4 font-manrope text-[12.5px] font-bold tracking-[.14em] text-mint-deep uppercase">
          {cs.relatedTitle}
        </Reveal>
        <Reveal delay={0.05}>
          <button
            onClick={() => router.push(`/${lang}/work/taskaty`)}
            className="flex w-full flex-col gap-3 rounded-2xl border border-ink/[.09] bg-canvas p-[clamp(24px,3vw,34px)] text-start transition-all duration-500 hover:-translate-y-1 hover:border-ink/20 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="flex items-baseline gap-3">
                <span className="text-[20px] font-semibold">{t.work.p4.name}</span>
                <span className="text-[14px] text-ink-soft">{t.work.p4.category}</span>
              </div>
              <p className="mt-2 max-w-[50ch] text-[15px] leading-[1.8] text-ink-soft">{t.work.p4.desc}</p>
            </div>
            <span className="flex items-center gap-2 text-[14.5px] font-semibold text-dark">
              {t.work.cta} <span className="block">{arrow}</span>
            </span>
          </button>
        </Reveal>
      </section>

      <section className="mx-auto mt-[clamp(56px,8vw,110px)] max-w-[1280px] px-5 pb-[clamp(60px,8vw,100px)] sm:px-6">
        <Reveal className="relative overflow-hidden rounded-[24px] bg-dark p-[clamp(32px,6vw,70px)] text-center text-canvas">
          <span className="absolute -end-[80px] -top-[80px] block h-[260px] w-[260px] rounded-full bg-mint/10" />
          <h2 className="relative m-0 text-[clamp(26px,3.4vw,42px)] font-semibold tracking-[-0.02em] text-balance">
            {t.final.title}
          </h2>
          <div className="relative mt-6 flex justify-center">
            <Magnetic className="inline-block">
              <button
                onClick={() => router.push(`/${lang}/start`)}
                className="cursor-pointer rounded-full border-0 bg-mint px-8 py-[16px] text-[16px] font-bold text-dark transition-colors hover:bg-mint-soft"
              >
                {t.final.cta}
              </button>
            </Magnetic>
          </div>
        </Reveal>
      </section>
    </>
  );
}

"use client";

import { useLanguage } from "@/lib/language-context";
import { Reveal, RevealGroup, RevealItem } from "./Reveal";

export default function WorkSection() {
  const { t, arrow } = useLanguage();

  return (
    <section id="work" className="mx-auto max-w-[1280px] scroll-mt-24 px-5 pt-[clamp(56px,8vw,116px)] sm:px-6">
      <Reveal className="mb-[clamp(30px,4vw,52px)] flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="mb-3.5 font-manrope text-[12.5px] font-bold tracking-[.14em] text-mint-deep uppercase">
            {t.work.eyebrow}
          </div>
          <h2 className="m-0 max-w-[22ch] text-[clamp(29px,3.7vw,50px)] leading-[1.2] font-semibold tracking-[-0.02em] text-balance">
            {t.work.title}
          </h2>
        </div>
        <p className="m-0 max-w-[38ch] text-base leading-[1.8] text-ink-soft">{t.work.intro}</p>
      </Reveal>

      <Reveal
        as="div"
        className="grid grid-cols-1 overflow-hidden rounded-[20px] border border-ink/[.07] bg-surface transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_34px_70px_-46px_rgba(7,27,22,.5)] lg:grid-cols-2"
      >
        <div className="flex flex-col justify-center p-[clamp(28px,4vw,54px)]">
          <div className="flex items-baseline gap-3">
            <h3 className="m-0 text-[clamp(26px,3vw,38px)] font-semibold tracking-[-0.02em]">{t.work.p1.name}</h3>
            <span className="text-sm text-ink-soft">{t.work.p1.category}</span>
          </div>
          <p className="mt-4 max-w-[42ch] text-[16.5px] leading-[1.85] text-ink-soft">{t.work.p1.desc}</p>
          <div className="my-6 flex flex-wrap gap-2">
            {t.work.p1.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-ink/[.15] bg-canvas/60 px-[13px] py-1.5 text-[12.5px] text-ink"
              >
                {tag}
              </span>
            ))}
          </div>
          <button className="group flex items-center gap-2.5 self-start border-0 border-b-[1.5px] border-mint bg-transparent pb-1 text-base font-semibold text-dark transition-all hover:gap-4 hover:text-mint-deep">
            {t.work.cta} <span className="block">{arrow}</span>
          </button>
        </div>
        <div className="relative flex min-h-[300px] items-center justify-center gap-4 overflow-hidden bg-nura-bg p-9 sm:min-h-[420px]">
          <span className="absolute -end-[60px] -top-[60px] block h-[220px] w-[220px] rounded-full bg-nura/[.14]" />
          <div
            className="relative w-[min(38%,150px)] translate-y-3.5 -rotate-6 rounded-[24px] bg-[#0A0D0C] p-[7px] shadow-[0_30px_50px_-26px_rgba(0,0,0,.6)]"
            style={{ aspectRatio: "9 / 18.6" }}
          >
            <div className="flex h-full flex-col gap-2 rounded-[18px] bg-canvas p-3">
              <span className="block h-[7px] w-[52%] rounded bg-dark" />
              <div className="h-[70px] rounded-[10px] bg-nura-2" />
              <div className="grid grid-cols-2 gap-1.5">
                <div className="h-[46px] rounded-[9px] bg-surface" />
                <div className="h-[46px] rounded-[9px] bg-surface" />
              </div>
              <span className="block h-1.5 w-[70%] rounded bg-ink/[.14]" />
            </div>
          </div>
          <div
            className="relative w-[min(38%,150px)] -translate-y-4 rotate-6 rounded-[24px] bg-[#0A0D0C] p-[7px] shadow-[0_30px_50px_-26px_rgba(0,0,0,.6)]"
            style={{ aspectRatio: "9 / 18.6" }}
          >
            <div className="flex h-full flex-col gap-2 rounded-[18px] bg-nura p-3">
              <span className="block h-[7px] w-[40%] rounded bg-white/85" />
              <div className="flex-1 rounded-[10px] bg-canvas/10" />
              <div className="flex h-[30px] items-center justify-center rounded-full bg-white">
                <span className="block h-[5px] w-[40%] rounded-sm bg-nura" />
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      <RevealGroup className="mt-[clamp(18px,2.4vw,28px)] grid grid-cols-1 gap-[clamp(18px,2.4vw,28px)] sm:grid-cols-2">
        <RevealItem className="overflow-hidden rounded-[20px] border border-ink/[.09] bg-canvas transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_30px_60px_-46px_rgba(7,27,22,.5)]">
          <div className="flex min-h-[250px] items-center justify-center border-b border-ink/[.07] bg-axis-bg p-7">
            <div className="w-full max-w-[330px] overflow-hidden rounded-[14px] border border-ink/[.09] bg-canvas shadow-[0_20px_40px_-34px_rgba(7,27,22,.5)]">
              <div className="flex h-[30px] items-center gap-1.5 bg-axis px-3">
                <span className="block h-1.5 w-1.5 rounded-full bg-white" />
                <span className="block h-[5px] w-14 rounded-sm bg-white/40" />
              </div>
              <div className="grid min-h-[150px] grid-cols-[56px_1fr]">
                <div className="flex flex-col gap-2 border-e border-ink/[.07] bg-surface p-3">
                  <span className="block h-1.5 rounded-sm bg-ink/[.16]" />
                  <span className="block h-1.5 rounded-sm bg-axis" />
                  <span className="block h-1.5 rounded-sm bg-ink/[.12]" />
                  <span className="block h-1.5 rounded-sm bg-ink/[.12]" />
                </div>
                <div className="flex flex-col gap-2 p-3">
                  <span className="block h-[7px] w-[44%] rounded-sm bg-dark" />
                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="h-[34px] rounded-[7px] bg-surface" />
                    <div className="h-[34px] rounded-[7px] bg-surface" />
                    <div className="h-[34px] rounded-[7px] bg-axis-2" />
                  </div>
                  <div className="flex h-[46px] items-end gap-1 rounded-lg bg-surface p-2">
                    <span className="block h-[30%] flex-1 rounded-sm bg-ink/[.14]" />
                    <span className="block h-[64%] flex-1 rounded-sm bg-ink/[.14]" />
                    <span className="block h-[46%] flex-1 rounded-sm bg-ink/[.14]" />
                    <span className="block h-[86%] flex-1 rounded-sm bg-axis" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="p-[clamp(24px,2.6vw,32px)]">
            <div className="flex items-baseline gap-2.5">
              <h3 className="m-0 text-[26px] font-semibold tracking-[-0.02em]">{t.work.p2.name}</h3>
              <span className="text-[13.5px] text-ink-soft">{t.work.p2.category}</span>
            </div>
            <p className="mt-3 text-[15.5px] leading-[1.8] text-ink-soft">{t.work.p2.desc}</p>
            <div className="my-5 flex flex-wrap gap-1.5">
              {t.work.p2.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-ink/[.15] px-3 py-1 text-xs text-ink">
                  {tag}
                </span>
              ))}
            </div>
            <button className="flex items-center gap-2 border-0 border-b-[1.5px] border-mint bg-transparent pb-1 text-[15.5px] font-semibold text-dark transition-all hover:gap-3.5">
              {t.work.cta} <span className="block">{arrow}</span>
            </button>
          </div>
        </RevealItem>

        <RevealItem className="overflow-hidden rounded-[20px] border border-ink/[.09] bg-canvas transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_30px_60px_-46px_rgba(7,27,22,.5)]">
          <div className="relative flex min-h-[250px] items-center justify-center overflow-hidden bg-kora-bg p-7">
            <span className="absolute -start-10 -bottom-10 block h-[170px] w-[170px] rounded-[36px] bg-kora/35" />
            <div className="relative flex items-center gap-3.5">
              <div className="w-[112px] rounded-[20px] bg-[#0A0D0C] p-1.5" style={{ aspectRatio: "9 / 18" }}>
                <div className="flex h-full flex-col gap-1.5 rounded-[15px] bg-canvas p-2.5">
                  <span className="block h-1.5 w-[60%] rounded-sm bg-dark" />
                  <div className="h-[38px] rounded-lg bg-kora-2" />
                  <div className="h-[22px] rounded-md bg-surface" />
                  <div className="h-[22px] rounded-md bg-surface" />
                </div>
              </div>
              <div className="flex w-[min(200px,42vw)] flex-col gap-2.5 rounded-xl bg-canvas p-3.5 shadow-[0_22px_44px_-30px_rgba(0,0,0,.55)]">
                <span className="block h-[7px] w-1/2 rounded-sm bg-dark" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-[52px] rounded-[9px] bg-surface" />
                  <div className="h-[52px] rounded-[9px] bg-kora" />
                </div>
                <span className="block h-1.5 w-[76%] rounded-sm bg-ink/[.14]" />
              </div>
            </div>
          </div>
          <div className="p-[clamp(24px,2.6vw,32px)]">
            <div className="flex items-baseline gap-2.5">
              <h3 className="m-0 text-[26px] font-semibold tracking-[-0.02em]">{t.work.p3.name}</h3>
              <span className="text-[13.5px] text-ink-soft">{t.work.p3.category}</span>
            </div>
            <p className="mt-3 text-[15.5px] leading-[1.8] text-ink-soft">{t.work.p3.desc}</p>
            <div className="my-5 flex flex-wrap gap-1.5">
              {t.work.p3.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-ink/[.15] px-3 py-1 text-xs text-ink">
                  {tag}
                </span>
              ))}
            </div>
            <button className="flex items-center gap-2 border-0 border-b-[1.5px] border-mint bg-transparent pb-1 text-[15.5px] font-semibold text-dark transition-all hover:gap-3.5">
              {t.work.cta} <span className="block">{arrow}</span>
            </button>
          </div>
        </RevealItem>
      </RevealGroup>
    </section>
  );
}

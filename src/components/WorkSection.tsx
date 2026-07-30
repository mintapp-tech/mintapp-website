"use client";

import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/language-context";
import { Reveal, RevealGroup, RevealItem } from "./Reveal";
import { SplitReveal } from "./motion/SplitReveal";

export default function WorkSection() {
  const { t, arrow } = useLanguage();
  const router = useRouter();
  const goToArrentioCaseStudy = () => router.push("/work/arrentio");
  const goToNuraCaseStudy = () => router.push("/work/nura");
  const goToJameelCaseStudy = () => router.push("/work/jameel");
  const goToNazarihCaseStudy = () => router.push("/work/nazarih");
  const goToTaskatyCaseStudy = () => router.push("/work/taskaty");
  const goToTangleVibeCaseStudy = () => router.push("/work/tanglevibe");

  return (
    <section id="work" className="mx-auto max-w-[1280px] scroll-mt-24 px-5 pt-[clamp(56px,8vw,116px)] sm:px-6">
      <Reveal className="mb-[clamp(30px,4vw,52px)] flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="mb-3.5 font-manrope text-[12.5px] font-bold tracking-[.14em] text-mint-deep uppercase">
            {t.work.eyebrow}
          </div>
          <SplitReveal
            as="h2"
            text={t.work.title}
            className="m-0 max-w-[22ch] text-[clamp(29px,3.7vw,50px)] leading-[1.2] font-semibold tracking-[-0.02em] text-balance"
          />
        </div>
        <p className="m-0 max-w-[38ch] text-base leading-[1.8] text-ink-soft">{t.work.intro}</p>
      </Reveal>

      <Reveal
        as="div"
        className="grid grid-cols-1 overflow-hidden rounded-[20px] border border-ink/[.07] bg-surface transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_34px_70px_-46px_rgba(7,27,22,.5)] lg:grid-cols-2"
      >
        <div className="flex flex-col justify-center p-[clamp(28px,4vw,54px)]">
          <div className="flex items-baseline gap-3">
            <h3 className="m-0 text-[clamp(26px,3vw,38px)] font-semibold tracking-[-0.02em]">{t.work.featured.name}</h3>
            <span className="text-sm text-ink-soft">{t.work.featured.category}</span>
          </div>
          <p className="mt-4 max-w-[42ch] text-[16.5px] leading-[1.85] text-ink-soft">{t.work.featured.desc}</p>
          <div className="my-6 flex flex-wrap gap-2">
            {t.work.featured.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-ink/[.15] bg-canvas/60 px-[13px] py-1.5 text-[12.5px] text-ink"
              >
                {tag}
              </span>
            ))}
          </div>
          <button onClick={goToArrentioCaseStudy} className="group flex items-center gap-2.5 self-start border-0 border-b-[1.5px] border-mint bg-transparent pb-1 text-base font-semibold text-dark transition-all hover:gap-4 hover:text-mint-deep">
            {t.work.cta} <span className="block">{arrow}</span>
          </button>
        </div>
        <div className="relative flex min-h-[300px] items-center justify-center overflow-hidden bg-arrentio-bg p-9 sm:min-h-[420px]">
          <span className="absolute -end-[60px] -top-[60px] block h-[220px] w-[220px] rounded-full bg-arrentio/[.12]" />
          <div className="relative w-[min(92%,400px)] -rotate-2 overflow-hidden rounded-[16px] border border-ink/[.08] bg-canvas shadow-[0_30px_50px_-26px_rgba(11,20,32,.4)]">
            <div className="flex h-[30px] items-center gap-1.5 bg-arrentio-ink px-3">
              <span className="block h-1.5 w-1.5 rounded-full bg-white/90" />
              <span className="block h-1.5 w-1.5 rounded-full bg-white/30" />
              <span className="ms-2 block h-[6px] w-[88px] rounded-full bg-white/25" />
            </div>
            <div className="flex flex-col gap-2.5 p-4">
              <div className="flex h-[32px] items-center justify-between rounded-full bg-surface ps-3.5 pe-1.5">
                <span className="block h-1.5 w-[46%] rounded bg-ink/[.16]" />
                <span className="block h-[22px] w-[60px] rounded-full bg-arrentio" />
              </div>
              <div className="flex gap-1.5">
                <span className="block h-[18px] w-[52px] rounded-full bg-arrentio-bg" />
                <span className="block h-[18px] w-[44px] rounded-full bg-surface" />
                <span className="block h-[18px] w-[48px] rounded-full bg-surface" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex flex-col gap-1.5">
                    <div className={`h-[52px] rounded-[9px] ${i === 1 ? "bg-arrentio-2" : "bg-surface"}`} />
                    <span className="block h-1.5 w-[80%] rounded bg-ink/[.18]" />
                    <span className="block h-1.5 w-[45%] rounded bg-arrentio" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      <RevealGroup className="mt-[clamp(18px,2.4vw,28px)] grid grid-cols-1 gap-[clamp(18px,2.4vw,28px)] sm:grid-cols-2 lg:grid-cols-3">
        <RevealItem className="overflow-hidden rounded-[20px] border border-ink/[.09] bg-canvas transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_30px_60px_-46px_rgba(7,27,22,.5)]">
          <div className="relative flex min-h-[250px] items-center justify-center overflow-hidden border-b border-ink/[.07] bg-nura-bg p-7">
            <span className="absolute -end-10 -top-10 block h-[150px] w-[150px] rounded-full bg-nura/[.16]" />
            <div className="relative flex items-center gap-3.5">
              <div className="w-[92px] -rotate-6 rounded-[18px] bg-[#0A0D0C] p-1.5" style={{ aspectRatio: "9 / 18.6" }}>
                <div className="flex h-full flex-col gap-1.5 rounded-[13px] bg-canvas p-2.5">
                  <span className="block h-1.5 w-[52%] rounded bg-dark" />
                  <div className="h-[34px] rounded-lg bg-nura-2" />
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="h-[24px] rounded-md bg-surface" />
                    <div className="h-[24px] rounded-md bg-surface" />
                  </div>
                  <span className="block h-1 w-[70%] rounded bg-ink/[.14]" />
                </div>
              </div>
              <div className="w-[92px] translate-y-2 rotate-6 rounded-[18px] bg-[#0A0D0C] p-1.5" style={{ aspectRatio: "9 / 18.6" }}>
                <div className="flex h-full flex-col gap-1.5 rounded-[13px] bg-nura p-2.5">
                  <span className="block h-1.5 w-[40%] rounded bg-white/85" />
                  <div className="flex-1 rounded-md bg-canvas/10" />
                  <div className="flex h-[20px] items-center justify-center rounded-full bg-white">
                    <span className="block h-1 w-[40%] rounded-sm bg-nura" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="p-[clamp(24px,2.6vw,32px)]">
            <div className="flex items-baseline gap-2.5">
              <h3 className="m-0 text-[26px] font-semibold tracking-[-0.02em]">{t.work.p1.name}</h3>
              <span className="text-[13.5px] text-ink-soft">{t.work.p1.category}</span>
            </div>
            <p className="mt-3 text-[15.5px] leading-[1.8] text-ink-soft">{t.work.p1.desc}</p>
            <div className="my-5 flex flex-wrap gap-1.5">
              {t.work.p1.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-ink/[.15] px-3 py-1 text-xs text-ink">
                  {tag}
                </span>
              ))}
            </div>
            <button onClick={goToNuraCaseStudy} className="flex items-center gap-2 border-0 border-b-[1.5px] border-mint bg-transparent pb-1 text-[15.5px] font-semibold text-dark transition-all hover:gap-3.5">
              {t.work.cta} <span className="block">{arrow}</span>
            </button>
          </div>
        </RevealItem>

        <RevealItem className="overflow-hidden rounded-[20px] border border-ink/[.09] bg-canvas transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_30px_60px_-46px_rgba(7,27,22,.5)]">
          <div className="flex min-h-[250px] items-center justify-center border-b border-ink/[.07] bg-jameel-bg p-7">
            <div className="w-full max-w-[330px] overflow-hidden rounded-[14px] border border-ink/[.09] bg-canvas shadow-[0_20px_40px_-34px_rgba(7,27,22,.5)]">
              <div className="flex h-[30px] items-center gap-1.5 bg-jameel px-3">
                <span className="block h-1.5 w-1.5 rounded-full bg-white" />
                <span className="block h-[5px] w-14 rounded-sm bg-white/40" />
              </div>
              <div className="grid min-h-[150px] grid-cols-[56px_1fr]">
                <div className="flex flex-col gap-2 border-e border-ink/[.07] bg-surface p-3">
                  <span className="block h-1.5 rounded-sm bg-ink/[.16]" />
                  <span className="block h-1.5 rounded-sm bg-jameel" />
                  <span className="block h-1.5 rounded-sm bg-ink/[.12]" />
                  <span className="block h-1.5 rounded-sm bg-ink/[.12]" />
                </div>
                <div className="flex flex-col gap-2 p-3">
                  <span className="block h-[7px] w-[44%] rounded-sm bg-dark" />
                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="h-[34px] rounded-[7px] bg-surface" />
                    <div className="h-[34px] rounded-[7px] bg-surface" />
                    <div className="h-[34px] rounded-[7px] bg-jameel-2" />
                  </div>
                  <div className="flex h-[46px] items-end gap-1 rounded-lg bg-surface p-2">
                    <span className="block h-[30%] flex-1 rounded-sm bg-ink/[.14]" />
                    <span className="block h-[64%] flex-1 rounded-sm bg-ink/[.14]" />
                    <span className="block h-[46%] flex-1 rounded-sm bg-ink/[.14]" />
                    <span className="block h-[86%] flex-1 rounded-sm bg-jameel" />
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
            <button onClick={goToJameelCaseStudy} className="flex items-center gap-2 border-0 border-b-[1.5px] border-mint bg-transparent pb-1 text-[15.5px] font-semibold text-dark transition-all hover:gap-3.5">
              {t.work.cta} <span className="block">{arrow}</span>
            </button>
          </div>
        </RevealItem>

        <RevealItem className="overflow-hidden rounded-[20px] border border-ink/[.09] bg-canvas transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_30px_60px_-46px_rgba(7,27,22,.5)]">
          <div className="relative flex min-h-[250px] items-center justify-center overflow-hidden border-b border-ink/[.07] bg-nazarih-bg p-7">
            <span className="absolute -start-10 -bottom-10 block h-[170px] w-[170px] rounded-[36px] bg-nazarih/35" />
            <div className="relative flex items-center gap-3.5">
              <div className="w-[96px] rounded-[20px] bg-[#0A0D0C] p-1.5" style={{ aspectRatio: "9 / 18" }}>
                <div className="flex h-full flex-col gap-1.5 rounded-[15px] bg-canvas p-2.5">
                  <span className="block h-1.5 w-[60%] rounded-sm bg-dark" />
                  <div className="h-[38px] rounded-lg bg-nazarih-2" />
                  <div className="h-[22px] rounded-md bg-surface" />
                  <div className="h-[22px] rounded-md bg-surface" />
                </div>
              </div>
              <div className="flex w-[min(160px,36vw)] flex-col gap-2.5 rounded-xl bg-canvas p-3.5 shadow-[0_22px_44px_-30px_rgba(0,0,0,.55)]">
                <span className="block h-[7px] w-1/2 rounded-sm bg-dark" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-[46px] rounded-[9px] bg-surface" />
                  <div className="h-[46px] rounded-[9px] bg-nazarih" />
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
            <button onClick={goToNazarihCaseStudy} className="flex items-center gap-2 border-0 border-b-[1.5px] border-mint bg-transparent pb-1 text-[15.5px] font-semibold text-dark transition-all hover:gap-3.5">
              {t.work.cta} <span className="block">{arrow}</span>
            </button>
          </div>
        </RevealItem>

        <RevealItem className="overflow-hidden rounded-[20px] border border-ink/[.09] bg-canvas transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_30px_60px_-46px_rgba(7,27,22,.5)]">
          <div className="flex min-h-[250px] items-center justify-center border-b border-ink/[.07] bg-taskaty-bg p-7">
            <div className="w-[150px] rounded-[24px] bg-[#0A0D0C] p-1.5" style={{ aspectRatio: "9 / 18.6" }}>
              <div className="flex h-full flex-col gap-2 rounded-[18px] bg-canvas p-3">
                <span className="block h-1.5 w-[55%] rounded-sm bg-dark" />
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-1.5 rounded-lg bg-surface p-1.5">
                    <span className={`block h-3 w-3 rounded-[4px] ${i === 0 ? "bg-taskaty" : "bg-ink/[.14]"}`} />
                    <span className="block h-1.5 flex-1 rounded-sm bg-ink/[.16]" />
                  </div>
                ))}
                <div className="mt-auto flex h-8 items-center justify-center rounded-full bg-taskaty">
                  <span className="block h-1.5 w-[34%] rounded-sm bg-white/90" />
                </div>
              </div>
            </div>
          </div>
          <div className="p-[clamp(24px,2.6vw,32px)]">
            <div className="flex items-baseline gap-2.5">
              <h3 className="m-0 text-[26px] font-semibold tracking-[-0.02em]">{t.work.p4.name}</h3>
              <span className="text-[13.5px] text-ink-soft">{t.work.p4.category}</span>
            </div>
            <p className="mt-3 text-[15.5px] leading-[1.8] text-ink-soft">{t.work.p4.desc}</p>
            <div className="my-5 flex flex-wrap gap-1.5">
              {t.work.p4.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-ink/[.15] px-3 py-1 text-xs text-ink">
                  {tag}
                </span>
              ))}
            </div>
            <button onClick={goToTaskatyCaseStudy} className="flex items-center gap-2 border-0 border-b-[1.5px] border-mint bg-transparent pb-1 text-[15.5px] font-semibold text-dark transition-all hover:gap-3.5">
              {t.work.cta} <span className="block">{arrow}</span>
            </button>
          </div>
        </RevealItem>

        <RevealItem className="overflow-hidden rounded-[20px] border border-ink/[.09] bg-canvas transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_30px_60px_-46px_rgba(7,27,22,.5)]">
          <div className="relative flex min-h-[250px] items-center justify-center overflow-hidden border-b border-ink/[.07] bg-tanglevibe-bg p-7">
            <span className="absolute -end-10 -top-10 block h-[160px] w-[160px] rounded-full bg-tanglevibe/[.18]" />
            <div className="relative w-[150px] -rotate-3 overflow-hidden rounded-[24px] bg-[#0A0D0C] p-1.5 shadow-[0_26px_50px_-30px_rgba(0,0,0,.5)]" style={{ aspectRatio: "9 / 18.6" }}>
              <div className="flex h-full flex-col overflow-hidden rounded-[18px] bg-canvas">
                <div className="flex-1 bg-tanglevibe-2" />
                <div className="flex flex-col gap-1.5 p-2.5">
                  <span className="block h-1.5 w-[50%] rounded-sm bg-dark" />
                  <span className="block h-1 w-[70%] rounded-sm bg-ink/[.14]" />
                  <div className="mt-1 flex justify-center gap-2">
                    <span className="block h-6 w-6 rounded-full border border-ink/[.14] bg-surface" />
                    <span className="block h-6 w-6 rounded-full bg-tanglevibe" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="p-[clamp(24px,2.6vw,32px)]">
            <div className="flex items-baseline gap-2.5">
              <h3 className="m-0 text-[26px] font-semibold tracking-[-0.02em]">{t.work.p5.name}</h3>
              <span className="text-[13.5px] text-ink-soft">{t.work.p5.category}</span>
            </div>
            <p className="mt-3 text-[15.5px] leading-[1.8] text-ink-soft">{t.work.p5.desc}</p>
            <div className="my-5 flex flex-wrap gap-1.5">
              {t.work.p5.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-ink/[.15] px-3 py-1 text-xs text-ink">
                  {tag}
                </span>
              ))}
            </div>
            <button onClick={goToTangleVibeCaseStudy} className="flex items-center gap-2 border-0 border-b-[1.5px] border-mint bg-transparent pb-1 text-[15.5px] font-semibold text-dark transition-all hover:gap-3.5">
              {t.work.cta} <span className="block">{arrow}</span>
            </button>
          </div>
        </RevealItem>
      </RevealGroup>
    </section>
  );
}

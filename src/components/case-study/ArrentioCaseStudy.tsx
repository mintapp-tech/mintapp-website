"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/language-context";
import { Reveal, RevealGroup, RevealItem } from "@/components/Reveal";
import { SplitReveal } from "@/components/motion/SplitReveal";
import { Magnetic } from "@/components/motion/Magnetic";
import { scrollToSection } from "@/lib/scroll";

function ChromeBar() {
  return (
    <div className="flex h-[30px] items-center gap-1.5 bg-arrentio-ink px-3">
      <span className="block h-1.5 w-1.5 rounded-full bg-white/90" />
      <span className="block h-1.5 w-1.5 rounded-full bg-white/30" />
      <span className="ms-2 block h-[6px] w-[88px] rounded-full bg-white/25" />
    </div>
  );
}

export default function ArrentioCaseStudy() {
  const { t, lang, arrow, backArrow } = useLanguage();
  const router = useRouter();
  const cs = t.csArrentio;

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
        <Reveal delay={0.1} className="mt-5 flex flex-wrap items-center gap-3">
          <Image
            src="/work/arrentio/logo.png"
            alt="Arrentio logo"
            width={44}
            height={36}
            className="rounded-[10px]"
          />
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
        <Reveal className="relative overflow-hidden rounded-[24px] bg-arrentio-bg p-[clamp(24px,5vw,60px)]">
          <span className="absolute -end-[70px] -top-[70px] block h-[260px] w-[260px] rounded-full bg-arrentio/[.12]" />
          <div className="relative flex flex-wrap items-center justify-center gap-[clamp(18px,3vw,34px)] py-[clamp(20px,4vw,50px)]">
            <div className="w-[min(100%,620px)] -rotate-1 overflow-hidden rounded-[16px] border border-ink/[.08] bg-canvas shadow-[0_40px_70px_-30px_rgba(11,20,32,.35)]">
              <ChromeBar />
              <Image
                src="/work/arrentio/home.jpg"
                alt="Arrentio marketplace homepage"
                width={1600}
                height={1084}
                className="h-auto w-full"
                priority
              />
            </div>
            <div className="hidden w-[min(52%,250px)] rotate-2 overflow-hidden rounded-[16px] border border-ink/[.08] bg-canvas shadow-[0_36px_64px_-30px_rgba(11,20,32,.4)] sm:block">
              <ChromeBar />
              <Image
                src="/work/arrentio/car-detail.jpg"
                alt="Arrentio car detail and booking page"
                width={1200}
                height={2000}
                className="aspect-[3/4] w-full object-cover object-top"
              />
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

      {cs.featureGroups && (
        <section className="mx-auto mt-[clamp(56px,8vw,110px)] max-w-[1280px] px-5 sm:px-6">
          <SplitReveal
            as="h2"
            text={cs.featuresTitle ?? ""}
            className="m-0 mb-[clamp(24px,3vw,36px)] text-[clamp(26px,3.2vw,40px)] font-semibold tracking-[-0.02em]"
          />
          <RevealGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {cs.featureGroups.map((group) => (
              <RevealItem key={group.t} className="rounded-2xl border border-ink/[.08] bg-surface p-[clamp(22px,2.6vw,30px)]">
                <div className="mb-3.5 text-[16px] font-semibold">{group.t}</div>
                <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                  {group.items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-[14.5px] leading-[1.7] text-ink-soft">
                      <span className="mt-[7px] block h-1.5 w-1.5 shrink-0 rounded-full bg-arrentio" />
                      {item}
                    </li>
                  ))}
                </ul>
              </RevealItem>
            ))}
          </RevealGroup>
        </section>
      )}

      <section className="mx-auto mt-[clamp(56px,8vw,110px)] max-w-[1280px] px-5 sm:px-6">
        <Reveal className="mb-3 font-manrope text-[12.5px] font-bold tracking-[.14em] text-mint-deep uppercase">
          {cs.screensTitle}
        </Reveal>
        <Reveal delay={0.05} className="mb-[clamp(24px,3vw,36px)] max-w-[60ch] text-[16px] leading-[1.85] text-ink-soft">
          {cs.screensCopy}
        </Reveal>
        <RevealGroup className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="flex flex-col gap-4 lg:col-span-3">
            <RevealItem className="overflow-hidden rounded-2xl border border-ink/[.08] bg-canvas">
              <ChromeBar />
              <Image
                src="/work/arrentio/home.jpg"
                alt="Arrentio marketplace homepage"
                width={1600}
                height={1084}
                className="h-auto w-full"
              />
            </RevealItem>
            <RevealItem className="overflow-hidden rounded-2xl border border-ink/[.08] bg-canvas">
              <ChromeBar />
              <Image
                src="/work/arrentio/explore.jpg"
                alt="Arrentio explore page with filters and live inventory"
                width={1600}
                height={1084}
                className="h-auto w-full"
              />
            </RevealItem>
            <RevealItem className="overflow-hidden rounded-2xl border border-ink/[.08] bg-canvas">
              <ChromeBar />
              <Image
                src="/work/arrentio/list-your-car.jpg"
                alt="Arrentio provider onboarding page"
                width={1600}
                height={1021}
                className="h-auto w-full"
              />
            </RevealItem>
          </div>
          <RevealItem className="flex flex-col overflow-hidden rounded-2xl border border-ink/[.08] bg-canvas lg:col-span-2">
            <ChromeBar />
            <div className="relative min-h-[340px] flex-1">
              <Image
                src="/work/arrentio/car-detail.jpg"
                alt="Arrentio car detail and booking page"
                fill
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="object-cover object-top"
              />
            </div>
          </RevealItem>
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
            <span className="block h-14 w-14 rounded-2xl bg-arrentio" />
            <span className="block h-14 w-14 rounded-2xl bg-arrentio-2" />
            <span className="block h-14 w-14 rounded-2xl bg-arrentio-ink" />
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
            onClick={() => router.push(`/${lang}/work/rentop`)}
            className="flex w-full flex-col gap-3 rounded-2xl border border-ink/[.09] bg-canvas p-[clamp(24px,3vw,34px)] text-start transition-all duration-500 hover:-translate-y-1 hover:border-ink/20 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="flex items-baseline gap-3">
                <span className="text-[20px] font-semibold">{t.work.p1.name}</span>
                <span className="text-[14px] text-ink-soft">{t.work.p1.category}</span>
              </div>
              <p className="mt-2 max-w-[50ch] text-[15px] leading-[1.8] text-ink-soft">{t.work.p1.desc}</p>
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

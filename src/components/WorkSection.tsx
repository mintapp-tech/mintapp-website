"use client";

import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "@/lib/language-context";
import { localAlt } from "@/content/work-alt";
import { Reveal, RevealGroup, RevealItem } from "./Reveal";
import { SplitReveal } from "./motion/SplitReveal";
import { CardCover } from "./work/ScreenFrames";
import { BrowserMockup, PhoneMockup } from "./work/Mockups";

// Compact cards under the main grid; Tailwind needs the literal classes.
const MORE_WORK = [
  { slug: "whhr", bg: "bg-whhr-bg" },
  { slug: "budgetly", bg: "bg-budgetly-bg" },
  { slug: "pmps", bg: "bg-pmps-bg" },
  { slug: "circuitscraft", bg: "bg-circuitscraft-bg" },
] as const;

export default function WorkSection() {
  const { t, lang, arrow } = useLanguage();
  const caseStudy = (slug: string) => `/${lang}/work/${slug}`;
  const cardLink =
    "flex w-fit items-center gap-2 border-0 border-b-[1.5px] border-mint bg-transparent pb-1 text-[15.5px] font-semibold text-dark transition-all hover:gap-3.5";

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
          <Link href={caseStudy("arrentio")} className="group flex items-center gap-2.5 self-start border-0 border-b-[1.5px] border-mint bg-transparent pb-1 text-base font-semibold text-dark transition-all hover:gap-4 hover:text-mint-deep">
            {t.work.cta} <span className="block">{arrow}</span>
          </Link>
        </div>
        <div className="relative flex min-h-[300px] items-center justify-center overflow-hidden bg-arrentio-bg p-9 sm:min-h-[420px]">
          <span className="absolute -end-[60px] -top-[60px] block h-[220px] w-[220px] rounded-full bg-arrentio/[.12]" />
          <div style={{ "--mt-delay": "0.25s" } as React.CSSProperties} className="mt-settle relative w-[min(94%,430px)] -rotate-2">
            <BrowserMockup src="/work/arrentio/home.jpg" alt={localAlt("Arrentio marketplace homepage", lang)} width={1600} height={1084} sizes="430px" />
          </div>
          <Image
            src="/work/arrentio/logo.png"
            alt={localAlt("Arrentio logo", lang)}
            width={64}
            height={52}
            style={{ "--mt-delay": "0.65s" } as React.CSSProperties}
            className="mt-settle absolute bottom-7 start-7 rotate-3 rounded-[16px] shadow-[0_18px_36px_-16px_rgba(11,20,32,.5)]"
          />
        </div>
      </Reveal>

      <RevealGroup className="mt-[clamp(18px,2.4vw,28px)] grid grid-cols-1 gap-[clamp(18px,2.4vw,28px)] sm:grid-cols-2">
        <RevealItem className="overflow-hidden rounded-[20px] border border-ink/[.09] bg-canvas transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_30px_60px_-46px_rgba(7,27,22,.5)]">
          <div className="relative flex min-h-[250px] items-center justify-center overflow-hidden border-b border-ink/[.07] bg-rentop-bg p-7">
            <span className="absolute -end-10 -top-10 block h-[150px] w-[150px] rounded-full bg-rentop/[.16]" />
            <div className="relative w-[132px]">
              <PhoneMockup src="/work/rentop/home.jpg" alt={localAlt("Rentop home screen", lang)} width={1290} height={2796} sizes="132px" />
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
            <Link href={caseStudy("rentop")} className={cardLink}>
              {t.work.cta} <span className="block">{arrow}</span>
            </Link>
          </div>
        </RevealItem>

        <RevealItem className="overflow-hidden rounded-[20px] border border-ink/[.09] bg-canvas transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_30px_60px_-46px_rgba(7,27,22,.5)]">
          <div className="relative flex min-h-[250px] items-center justify-center overflow-hidden border-b border-ink/[.07] bg-jameel-bg p-7">
            <span className="absolute -end-10 -top-10 block h-[150px] w-[150px] rounded-full bg-jameel/[.16]" />
            <div className="relative w-[132px]">
              <PhoneMockup src="/work/jameel/home.png" alt={localAlt("Jameel home screen", lang)} width={375} height={812} sizes="132px" />
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
            <Link href={caseStudy("jameel")} className={cardLink}>
              {t.work.cta} <span className="block">{arrow}</span>
            </Link>
          </div>
        </RevealItem>


        <RevealItem className="overflow-hidden rounded-[20px] border border-ink/[.09] bg-canvas transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_30px_60px_-46px_rgba(7,27,22,.5)]">
          <div className="flex min-h-[250px] items-center justify-center border-b border-ink/[.07] bg-taskaty-bg p-7">
            <CardCover slug="taskaty">
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
            </CardCover>
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
            <Link href={caseStudy("taskaty")} className={cardLink}>
              {t.work.cta} <span className="block">{arrow}</span>
            </Link>
          </div>
        </RevealItem>


        <RevealItem className="overflow-hidden rounded-[20px] border border-ink/[.09] bg-canvas transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_30px_60px_-46px_rgba(7,27,22,.5)]">
          <div className="flex min-h-[250px] items-center justify-center border-b border-ink/[.07] bg-kwayes-bg p-7">
            <CardCover slug="kwayes">
              <div className="w-[132px] rounded-[22px] bg-[#0A0D0C] p-1.5" style={{ aspectRatio: "9 / 18.6" }}>
                <div className="flex h-full flex-col gap-1.5 rounded-[16px] bg-canvas p-2">
                  <span className="block h-1.5 w-[45%] rounded-sm bg-dark" />
                  <div className="grid flex-1 grid-cols-2 gap-1.5">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className={`rounded-md ${i % 2 === 0 ? "bg-kwayes-2" : "bg-surface"}`} />
                    ))}
                  </div>
                  <div className="relative flex h-7 items-center justify-around rounded-full bg-surface px-1.5">
                    <span className="block h-2 w-2 rounded-full border border-ink/[.16]" />
                    <span className="absolute start-1/2 top-1/2 block h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-kwayes" />
                    <span className="block h-2 w-2 rounded-full border border-ink/[.16]" />
                  </div>
                </div>
              </div>
            </CardCover>
          </div>
          <div className="p-[clamp(24px,2.6vw,32px)]">
            <div className="flex items-baseline gap-2.5">
              <h3 className="m-0 text-[26px] font-semibold tracking-[-0.02em]">{t.work.p6.name}</h3>
              <span className="text-[13.5px] text-ink-soft">{t.work.p6.category}</span>
            </div>
            <p className="mt-3 text-[15.5px] leading-[1.8] text-ink-soft">{t.work.p6.desc}</p>
            <div className="my-5 flex flex-wrap gap-1.5">
              {t.work.p6.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-ink/[.15] px-3 py-1 text-xs text-ink">
                  {tag}
                </span>
              ))}
            </div>
            <Link href={caseStudy("kwayes")} className={cardLink}>
              {t.work.cta} <span className="block">{arrow}</span>
            </Link>
          </div>
        </RevealItem>
      </RevealGroup>

      <RevealGroup className="mt-[clamp(18px,2.4vw,28px)] grid grid-cols-1 gap-[clamp(18px,2.4vw,28px)] sm:grid-cols-2 lg:grid-cols-4">
        {MORE_WORK.map(({ slug, bg }) => {
          const p = t.work.more[slug];
          return (
            <RevealItem key={slug} className="overflow-hidden rounded-[20px] border border-ink/[.09] bg-canvas transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_30px_60px_-46px_rgba(7,27,22,.5)]">
              <div className={`flex min-h-[220px] items-center justify-center border-b border-ink/[.07] ${bg} p-6`}>
                <CardCover slug={slug} />
              </div>
              <div className="p-6">
                <div className="flex flex-wrap items-baseline gap-x-2.5">
                  <h3 className="m-0 text-[22px] font-semibold tracking-[-0.02em]">{p.name}</h3>
                  <span className="text-[13px] text-ink-soft">{p.category}</span>
                </div>
                <p className="mt-2.5 mb-5 text-[14.5px] leading-[1.75] text-ink-soft">{p.desc}</p>
                <Link href={caseStudy(slug)} className={cardLink}>
                  {t.work.cta} <span className="block">{arrow}</span>
                </Link>
              </div>
            </RevealItem>
          );
        })}
      </RevealGroup>
    </section>
  );
}

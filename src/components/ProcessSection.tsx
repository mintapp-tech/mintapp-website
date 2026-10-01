"use client";

import { useLanguage } from "@/lib/language-context";
import { Reveal, RevealGroup } from "./Reveal";
import { SplitReveal } from "./motion/SplitReveal";

// "How it works": four steps on one path. Step two is where Mintapp differs (the
// preparation before the first call), so it carries the detail and the emphasis.
export default function ProcessSection() {
  const { t } = useLanguage();
  const proc = t.proc;

  return (
    <section id="process" className="mx-auto max-w-[1280px] scroll-mt-24 px-5 pt-[clamp(56px,8vw,116px)] sm:px-6">
      <Reveal className="mb-3.5 font-manrope text-[12.5px] font-bold tracking-[.14em] text-mint-deep uppercase">
        {proc.eyebrow}
      </Reveal>
      <SplitReveal
        as="h2"
        text={proc.title}
        className="mb-[clamp(30px,4vw,52px)] max-w-[22ch] text-[clamp(29px,3.7vw,50px)] leading-[1.2] font-semibold tracking-[-0.02em] text-balance"
      />

      <RevealGroup className="relative">
        {/* The path the steps sit on: vertical on small screens, horizontal from lg. */}
        <span aria-hidden className="absolute start-[19px] top-5 bottom-5 block w-[2px] rounded-full bg-ink/[.1] lg:hidden">
          <span className="mt-draw-y absolute inset-0 block rounded-full bg-mint" />
        </span>
        <span aria-hidden className="absolute inset-x-[20px] top-[19px] hidden h-[2px] rounded-full bg-ink/[.1] lg:block">
          <span className="mt-draw-x absolute inset-0 block rounded-full bg-mint" />
        </span>

        <ol className="relative m-0 grid list-none grid-cols-1 gap-[clamp(22px,3vw,28px)] p-0 lg:grid-cols-4 lg:gap-[clamp(14px,1.6vw,20px)]">
          {proc.steps.map((step, i) => {
            const featured = Boolean(step.points?.length);
            return (
              <li key={step.n} className="mt-reveal-item relative ps-[60px] lg:ps-0">
                <span
                  aria-hidden
                  style={{ "--mt-delay": `${(0.3 + i * 0.4).toFixed(2)}s` } as React.CSSProperties}
                  className={`mt-node absolute start-0 top-0 flex h-10 w-10 items-center justify-center rounded-full font-manrope text-[13px] font-bold lg:relative ${
                    featured ? "bg-dark text-mint ring-[6px] ring-mint/25" : "border-2 border-mint bg-canvas text-mint-deep"
                  }`}
                >
                  {i + 1}
                </span>
                <div className={featured ? "rounded-[20px] bg-dark p-[clamp(20px,2.2vw,26px)] text-canvas lg:mt-5" : "pt-1.5 lg:mt-5 lg:pt-0"}>
                  <div className={`font-manrope text-[12px] font-bold tracking-[.1em] ${featured ? "text-mint" : "text-mint-deep"}`}>{step.n}</div>
                  <h3 className="mt-2 mb-2.5 text-[clamp(20px,2vw,23px)] font-semibold tracking-[-0.01em]">{step.title}</h3>
                  <p className={`m-0 text-[15.5px] leading-[1.75] ${featured ? "text-canvas/75" : "text-ink-soft"}`}>{step.desc}</p>
                  {featured && (
                    <ul className="m-0 mt-4 flex list-none flex-col gap-2.5 p-0">
                      {step.points!.map((point) => (
                        <li key={point} className="flex items-start gap-2.5 text-[14.5px] leading-[1.6] text-canvas">
                          <span aria-hidden className="mt-[7px] block h-[6px] w-[6px] flex-none rounded-full bg-mint" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </RevealGroup>

      <Reveal className="mt-[clamp(22px,3vw,32px)] flex items-center gap-2.5 text-[14px] text-ink-soft">
        <span aria-hidden className="block h-[5px] w-[5px] flex-none rounded-full bg-mint-deep" />
        {proc.note}
      </Reveal>
    </section>
  );
}

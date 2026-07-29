"use client";

import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/language-context";
import { Reveal } from "./Reveal";
import { SplitReveal } from "./motion/SplitReveal";
import { Magnetic } from "./motion/Magnetic";

export default function DifferentiatorSection() {
  const { t } = useLanguage();
  const router = useRouter();

  return (
    <section
      id="differentiator"
      className="mx-auto mt-[clamp(56px,8vw,116px)] max-w-[1280px] scroll-mt-24 px-5 sm:px-6"
    >
      <Reveal className="grid grid-cols-1 items-center gap-[clamp(30px,4vw,56px)] rounded-[22px] border border-ink/[.08] bg-surface p-[clamp(28px,4.4vw,62px)] lg:grid-cols-2">
        <div>
          <div className="mb-4 font-manrope text-[12.5px] font-bold tracking-[.14em] text-mint-deep uppercase">
            {t.diff.eyebrow}
          </div>
          <SplitReveal
            as="h2"
            text={t.diff.title}
            className="m-0 max-w-[20ch] text-[clamp(27px,3.4vw,45px)] leading-[1.22] font-semibold tracking-[-0.02em] text-balance"
          />
          <p className="mt-5 mb-[30px] max-w-[44ch] text-[17px] leading-[1.85] text-ink-soft">{t.diff.copy}</p>
          <Magnetic className="inline-block">
            <button
              onClick={() => router.push("/start")}
              className="cursor-pointer rounded-full border-0 bg-ink px-[30px] py-[17px] text-[16.5px] font-semibold text-white transition-colors hover:bg-mint hover:text-dark"
            >
              {t.diff.cta}
            </button>
          </Magnetic>
        </div>
        <div className="flex flex-col gap-3">
          {t.diff.steps.map((step) => (
            <div
              key={step.n}
              className="flex items-start gap-4 rounded-2xl border border-ink/[.08] bg-canvas p-5 py-[18px]"
            >
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-[9px] bg-dark font-manrope text-[13px] font-bold text-mint">
                {step.n}
              </span>
              <div>
                <div className="mb-1.5 text-base font-semibold">{step.title}</div>
                <div className="text-[14.5px] leading-[1.7] text-ink-soft">{step.desc}</div>
              </div>
            </div>
          ))}
          <div className="ps-1 text-[13px] text-ink-soft">{t.diff.note}</div>
        </div>
      </Reveal>
    </section>
  );
}

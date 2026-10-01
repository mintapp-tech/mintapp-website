"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/language-context";
import { Reveal } from "./Reveal";
import { SplitReveal } from "./motion/SplitReveal";
import { Magnetic } from "./motion/Magnetic";

const SUPPORT_EMAIL = "hello@mintapp.tech";

// Loose points on the end side that line up into one path towards the CTA: the
// hero's "unclear idea to clear direction" motif, closing the page.
const CONVERGE: { top: string; sx: number; sy: number }[] = [
  { top: "18%", sx: -46, sy: -30 },
  { top: "34%", sx: 38, sy: 24 },
  { top: "50%", sx: -30, sy: 38 },
  { top: "66%", sx: 52, sy: -22 },
];

export default function FinalCta() {
  const { t, lang } = useLanguage();

  return (
    <section className="px-5 pt-[clamp(60px,8vw,120px)] sm:px-6">
      <Reveal className="relative mx-auto max-w-[1280px] overflow-hidden rounded-[24px] bg-dark p-[clamp(40px,7vw,110px)] px-[clamp(26px,5vw,80px)] text-canvas">
        <div aria-hidden className="pointer-events-none absolute inset-y-0 end-[clamp(28px,9vw,140px)] hidden w-[2px] md:block">
          <span className="absolute inset-y-[14%] start-0 block w-[2px] rounded-full bg-canvas/[.08]">
            <span className="mt-draw-y absolute inset-0 block rounded-full bg-mint/70" />
          </span>
          {CONVERGE.map((dot, i) => (
            <span
              key={dot.top}
              className="mt-converge absolute -start-[5px] block h-3 w-3 rounded-full border-2 border-mint bg-dark"
              style={{ top: dot.top, "--sx": `${dot.sx}px`, "--sy": `${dot.sy}px`, "--mt-delay": `${0.15 + i * 0.12}s` } as React.CSSProperties}
            />
          ))}
          <span className="mt-converge absolute bottom-[14%] -start-[9px] block h-5 w-5 rounded-full bg-mint shadow-[0_0_0_6px_theme(colors.mint/20%)]" style={{ "--mt-delay": "0.75s" } as React.CSSProperties} />
        </div>

        <div className="relative max-w-[46ch]">
          <SplitReveal
            as="h2"
            text={t.final.title}
            className="m-0 max-w-[20ch] text-[clamp(32px,4.6vw,62px)] leading-[1.14] font-semibold tracking-[-0.025em] text-canvas text-balance rtl:leading-[1.3] rtl:tracking-normal"
          />
          <p className="mt-[22px] mb-[34px] max-w-[44ch] text-[clamp(16.5px,1.4vw,19px)] leading-[1.85] text-canvas/72">{t.final.sub}</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
            <Magnetic className="inline-block">
              <Link
                href={`/${lang}/start`}
                className="inline-block cursor-pointer rounded-full border-0 bg-mint px-8 py-[17px] text-[16.5px] font-bold text-dark transition-colors hover:bg-mint-soft"
              >
                {t.final.cta}
              </Link>
            </Magnetic>
            <div className="text-[14px] leading-[1.6] text-canvas/65">
              {t.final.emailLabel}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="mt-0.5 block w-fit text-[16px] font-semibold text-canvas underline decoration-mint decoration-[1.5px] underline-offset-4 transition-colors hover:text-mint"
              >
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

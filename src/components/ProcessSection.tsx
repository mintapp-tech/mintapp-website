"use client";

import { motion } from "framer-motion";
import { useLanguage } from "@/lib/language-context";
import { Reveal, RevealGroup, RevealItem } from "./Reveal";
import { SplitReveal } from "./motion/SplitReveal";

const easeOut = [0.2, 0.7, 0.2, 1] as const;

export default function ProcessSection() {
  const { t } = useLanguage();

  return (
    <section id="process" className="mx-auto max-w-[1280px] scroll-mt-24 px-5 pt-[clamp(56px,8vw,116px)] sm:px-6">
      <Reveal className="mb-3.5 font-manrope text-[12.5px] font-bold tracking-[.14em] text-mint-deep uppercase">
        {t.proc.eyebrow}
      </Reveal>
      <SplitReveal
        as="h2"
        text={t.proc.title}
        className="mb-[clamp(30px,4vw,52px)] max-w-[22ch] text-[clamp(29px,3.7vw,50px)] leading-[1.2] font-semibold tracking-[-0.02em] text-balance"
      />

      <RevealGroup className="grid grid-cols-1 gap-[clamp(14px,2vw,20px)] sm:grid-cols-2 lg:grid-cols-4">
        {t.proc.steps.map((step) => (
          <RevealItem key={step.n} className="group relative px-1 pt-[22px]">
            <span className="absolute inset-x-0 top-0 block h-[2px] bg-ink/[.12]" />
            <motion.span
              className="absolute inset-x-0 top-0 block h-[2px] origin-left bg-mint transition-[height] duration-300 group-hover:h-[3px]"
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, ease: easeOut, delay: 0.2 }}
            />
            <div className="font-manrope text-[13px] font-bold tracking-[.1em] text-mint-deep">{step.n}</div>
            <h3 className="mt-3.5 mb-2.5 text-[clamp(20px,2vw,24px)] font-semibold tracking-[-0.01em]">
              {step.title}
            </h3>
            <p className="m-0 text-[15.5px] leading-[1.8] text-ink-soft">{step.desc}</p>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}

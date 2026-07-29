"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, useMotionValue, useSpring, useTransform, useScroll, useReducedMotion } from "framer-motion";
import { useLanguage } from "@/lib/language-context";
import { scrollToSection } from "@/lib/scroll";
import { SplitReveal } from "./motion/SplitReveal";
import { Magnetic } from "./motion/Magnetic";

const easeOut = [0.2, 0.7, 0.2, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: easeOut, delay },
  }),
};

function ParallaxLayer({
  mvX,
  mvY,
  depth,
  className,
  style,
  children,
}: {
  mvX: ReturnType<typeof useMotionValue<number>>;
  mvY: ReturnType<typeof useMotionValue<number>>;
  depth: number;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const x = useTransform(mvX, (v) => -v * depth);
  const y = useTransform(mvY, (v) => -v * depth);
  return (
    <motion.div className={className} style={{ ...style, x, y }}>
      {children}
    </motion.div>
  );
}

export default function Hero() {
  const { t } = useLanguage();
  const router = useRouter();
  const sectionRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const exitOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.35]);
  const exitY = useTransform(scrollYProgress, [0, 1], [0, 70]);

  const mvX = useMotionValue(0);
  const mvY = useMotionValue(0);
  const springX = useSpring(mvX, { stiffness: 140, damping: 18, mass: 0.4 });
  const springY = useSpring(mvY, { stiffness: 140, damping: 18, mass: 0.4 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotion || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mvX.set(x);
    mvY.set(y);
  };

  const handleMouseLeave = () => {
    mvX.set(0);
    mvY.set(0);
  };

  return (
    <section
      ref={sectionRef}
      className="mx-auto max-w-[1280px] px-5 pb-[clamp(30px,4vw,60px)] pt-[clamp(44px,6vw,86px)] sm:px-6"
    >
    <motion.div
      style={{ opacity: exitOpacity, y: exitY }}
      className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16"
    >
      <div>
        <motion.div
          custom={0}
          initial="hidden"
          animate="show"
          variants={fadeUp}
          className="mb-[clamp(20px,3vw,30px)] inline-flex items-center gap-2.5 rounded-full border border-ink/[.14] px-[15px] py-[7px] text-[13px] text-ink-soft"
        >
          <span className="block h-[7px] w-[7px] rounded-full bg-mint" />
          {t.hero.eyebrow}
        </motion.div>

        <SplitReveal
          as="h1"
          text={t.hero.title}
          delay={0.1}
          className="m-0 text-[clamp(38px,5.4vw,74px)] leading-[1.12] font-semibold tracking-[-0.02em] text-balance text-ink"
        />

        <motion.p
          custom={0.16}
          initial="hidden"
          animate="show"
          variants={fadeUp}
          className="mt-[clamp(20px,2.6vw,28px)] max-w-[46ch] text-[clamp(16.5px,1.35vw,19.5px)] leading-[1.85] text-ink-soft text-pretty"
        >
          {t.hero.sub}
        </motion.p>

        <motion.div
          custom={0.24}
          initial="hidden"
          animate="show"
          variants={fadeUp}
          className="mt-[clamp(28px,3.4vw,40px)] flex flex-wrap gap-3"
        >
          <Magnetic className="inline-block">
            <button
              onClick={() => router.push("/start")}
              className="cursor-pointer rounded-full border-0 bg-ink px-[30px] py-[17px] text-[16.5px] font-semibold text-white transition-colors duration-300 hover:bg-mint hover:text-dark"
            >
              {t.hero.cta1}
            </button>
          </Magnetic>
          <button
            onClick={() => scrollToSection("work")}
            className="cursor-pointer rounded-full border border-ink/20 bg-transparent px-[30px] py-[17px] text-[16.5px] font-semibold text-ink transition-colors duration-300 hover:border-dark hover:bg-surface"
          >
            {t.hero.cta2}
          </button>
        </motion.div>

        <motion.div
          custom={0.32}
          initial="hidden"
          animate="show"
          variants={fadeUp}
          className="mt-[clamp(34px,4.6vw,58px)] flex flex-wrap gap-[clamp(18px,3vw,34px)] border-t border-ink/[.09] pt-[clamp(22px,3vw,30px)]"
        >
          {t.hero.marks.map((m) => (
            <div key={m} className="flex items-center gap-2 text-[14.5px] text-ink-soft">
              <span className="block h-[5px] w-[5px] rounded-full bg-mint" />
              {m}
            </div>
          ))}
        </motion.div>
      </div>

      <motion.div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: easeOut, delay: 0.2 }}
        className="relative min-h-[clamp(360px,42vw,530px)]"
        style={{ perspective: 1200 }}
      >
        <ParallaxLayer
          mvX={springX}
          mvY={springY}
          depth={6}
          className="absolute start-0 top-[8%] w-[min(78%,470px)] overflow-hidden rounded-[18px] border border-ink/[.08] bg-surface shadow-[0_30px_70px_-40px_rgba(7,27,22,.45)]"
        >
          <div className="flex h-[38px] items-center gap-1.5 border-b border-ink/[.07] bg-canvas/70 px-3.5">
            <span className="block h-2 w-2 rounded-full bg-ink/[.16]" />
            <span className="block h-2 w-2 rounded-full bg-ink/[.16]" />
            <span className="block h-2 w-2 rounded-full bg-mint" />
            <span className="ms-3 block h-4 max-w-[150px] flex-1 rounded-[6px] bg-ink/[.06]" />
          </div>
          <div className="grid gap-3.5 p-[22px]">
            <div className="h-[11px] w-[42%] rounded-[5px] bg-dark" />
            <div className="h-2 w-[74%] rounded bg-ink/[.13]" />
            <div className="mt-1 grid grid-cols-2 gap-3">
              <div className="relative h-[78px] overflow-hidden rounded-xl bg-dark">
                <span className="absolute bottom-3.5 start-3.5 block h-1.5 w-[46px] rounded-[3px] bg-mint" />
                <span className="absolute bottom-[26px] start-3.5 block h-1.5 w-[26px] rounded-[3px] bg-canvas/35" />
              </div>
              <div className="flex h-[78px] items-end gap-1.5 rounded-xl border border-ink/[.09] bg-canvas p-3">
                <span className="block h-[24%] flex-1 rounded-sm bg-ink/[.12]" />
                <span className="block h-[52%] flex-1 rounded-sm bg-ink/[.12]" />
                <span className="block h-[78%] flex-1 rounded-sm bg-mint" />
                <span className="block h-[40%] flex-1 rounded-sm bg-ink/[.12]" />
              </div>
            </div>
            <div className="h-2 w-[56%] rounded bg-ink/[.13]" />
          </div>
        </ParallaxLayer>

        <ParallaxLayer
          mvX={springX}
          mvY={springY}
          depth={10}
          className="absolute end-[2%] bottom-[2%] w-[min(46%,214px)] rounded-[30px] bg-dark p-[9px] shadow-[0_40px_80px_-34px_rgba(7,27,22,.6)]"
          style={{ aspectRatio: "9 / 18.6" }}
        >
          <motion.div
            animate={reducedMotion ? undefined : { y: [0, -10, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
            className="flex h-full flex-col overflow-hidden rounded-[23px] bg-canvas"
          >
            <div className="flex flex-col gap-2.5 px-3.5 pb-2.5 pt-4">
              <span className="mx-auto block h-1 w-[34px] rounded-full bg-ink/[.18]" />
              <span className="block h-[9px] w-[58%] rounded bg-dark" />
              <span className="block h-1.5 w-[80%] rounded bg-ink/[.14]" />
            </div>
            <div className="flex flex-1 flex-col gap-2 px-3.5 py-1.5">
              <div className="h-11 rounded-[11px] border border-ink/[.06] bg-surface" />
              <div className="h-11 rounded-[11px] bg-mint-soft" />
              <div className="h-11 rounded-[11px] border border-ink/[.06] bg-surface" />
            </div>
            <div className="px-3.5 pb-4 pt-3">
              <div className="flex h-[38px] items-center justify-center rounded-full bg-dark">
                <span className="block h-1.5 w-[44%] rounded-sm bg-mint" />
              </div>
            </div>
          </motion.div>
        </ParallaxLayer>

        <ParallaxLayer
          mvX={springX}
          mvY={springY}
          depth={16}
          className="absolute end-[16%] top-0 block h-[78px] w-[78px] rounded-[22px] border-[1.5px] border-accent"
        >
          <span />
        </ParallaxLayer>

        <ParallaxLayer
          mvX={springX}
          mvY={springY}
          depth={9}
          className="absolute bottom-[12%] start-[8%] block h-14 w-14 rounded-full bg-mint-soft"
        >
          <span />
        </ParallaxLayer>
      </motion.div>
    </motion.div>
    </section>
  );
}

"use client";

import { useRef, type CSSProperties, type ReactNode, type RefObject } from "react";
import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform, useScroll, useReducedMotion } from "framer-motion";
import { useLanguage } from "@/lib/language-context";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { SectionLink } from "./nav/links";
import { SplitReveal } from "./motion/SplitReveal";
import { Magnetic } from "./motion/Magnetic";

const enterDelay = (seconds: number) => ({ "--mt-delay": `${seconds}s` }) as CSSProperties;

const HERO_GRID = "grid grid-cols-1 items-center gap-12 lg:grid-cols-[1.12fr_.88fr] lg:gap-14";

// Where each question fragment starts before it settles into the board: loose,
// tilted, drifting above it. Offsets are in px/deg and mirrored for RTL in CSS.
const SCATTER: [number, number, number][] = [
  [-36, -150, -9],
  [74, -196, 7],
  [150, -126, -5],
  [-12, -96, 6],
  [112, -70, -8],
  [36, -170, 11],
];

// Not rendered under reduced motion: Framer drives this fade with a native scroll
// timeline that keeps running on the element, so it is removed rather than zeroed.
function ScrollExit({ target, children }: { target: RefObject<HTMLElement | null>; children: ReactNode }) {
  const { scrollYProgress } = useScroll({ target, offset: ["start start", "end start"] });
  const opacity = useTransform(scrollYProgress, [0, 1], [1, 0.35]);
  const y = useTransform(scrollYProgress, [0, 1], [0, 70]);
  return (
    <motion.div style={{ opacity, y }} className={HERO_GRID}>
      {children}
    </motion.div>
  );
}

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

// The differentiator made visible: open questions about an idea drift in loosely,
// then settle into an ordered first-call direction (context, questions, next step).
// Pure CSS keyframes, so it plays before hydration and without JavaScript; the
// settled state is the element's natural layout. Decorative: the same message is
// in the headline, the supporting copy and "How it works".
function DirectionBoard() {
  const { t, arrow } = useLanguage();
  const b = t.hero.board;
  return (
    <div className="relative rounded-[22px] border border-ink/[.08] bg-surface/95 p-[clamp(18px,2.2vw,26px)] shadow-[0_10px_30px_-18px_rgba(7,27,22,.35),0_50px_90px_-40px_rgba(7,27,22,.45)] backdrop-blur-xl">
      <div className="flex items-center gap-3 font-manrope text-[11.5px] font-bold tracking-[.1em] uppercase rtl:text-[13px]">
        <span className="flex items-center gap-2 text-ink-faint">
          <span className="block h-1.5 w-1.5 rounded-full bg-ink/30" />
          {b.idea}
        </span>
        <span className="relative block h-px flex-1 overflow-hidden bg-ink/[.12]">
          <span className="hb-progress absolute inset-0 block bg-mint" />
        </span>
        <span className="flex items-center gap-2 text-mint-deep">
          <span className="block h-1.5 w-1.5 rounded-full bg-mint" />
          {b.direction}
        </span>
      </div>

      <div className="relative mt-[clamp(18px,2.4vw,26px)] grid gap-[clamp(14px,1.8vw,20px)] ps-8">
        <span className="absolute start-[7px] top-2 bottom-7 block w-[2px] overflow-hidden rounded-full bg-ink/[.1]">
          <span className="hb-path absolute inset-0 block bg-mint" />
        </span>

        <div className="hb-group relative" style={enterDelay(0.35)}>
          <span className="absolute -start-8 top-1 block h-4 w-4 rounded-full border-2 border-mint bg-surface" />
          <div className="font-manrope text-[11.5px] font-bold tracking-[.1em] text-ink-faint uppercase rtl:text-[13px]">{b.context}</div>
          <div className="mt-1.5 text-[15px] font-semibold text-ink">{b.contextText}</div>
        </div>

        <div className="relative">
          <span className="hb-group absolute -start-8 top-1 block h-4 w-4 rounded-full border-2 border-mint bg-surface" style={enterDelay(0.6)} />
          <div className="hb-group font-manrope text-[11.5px] font-bold tracking-[.1em] text-ink-faint uppercase rtl:text-[13px]" style={enterDelay(0.6)}>
            {b.questions}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {b.fragments.map((fragment, i) => {
              const [x, y, r] = SCATTER[i % SCATTER.length];
              const style = { "--sx": `${x}px`, "--sy": `${y}px`, "--sr": `${r}deg`, "--mt-delay": `${(0.15 + i * 0.09).toFixed(2)}s` } as CSSProperties;
              return (
                <span
                  key={fragment}
                  style={style}
                  className="hb-chip pointer-events-none rounded-full border border-ink/[.1] bg-canvas px-3 py-1.5 text-[13px] leading-tight text-ink"
                >
                  {fragment}
                </span>
              );
            })}
          </div>
        </div>

        <div className="relative">
          <span className="hb-node absolute -start-8 top-2.5 block h-4 w-4 rounded-full bg-mint shadow-[0_0_0_5px_theme(colors.mint/18%)]" />
          <div className="hb-next flex items-center justify-between gap-3 rounded-2xl bg-dark px-4 py-3.5 text-canvas">
            <div>
              <div className="font-manrope text-[11px] font-bold tracking-[.1em] text-mint uppercase rtl:text-[13px]">{b.next}</div>
              <div className="mt-1 text-[15px] font-semibold">{b.nextText}</div>
            </div>
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-mint text-[15px] font-bold text-dark">
              {arrow}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Hero() {
  const { t, lang } = useLanguage();
  const sectionRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const prefersReducedMotion = usePrefersReducedMotion();

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

  const content = (
    <>
      <div>
        <div className="mt-enter mb-[clamp(20px,3vw,28px)] inline-flex items-center gap-2.5 rounded-full border border-ink/[.14] px-[15px] py-[7px] text-[13px] leading-snug text-ink-soft">
          <span className="block h-[7px] w-[7px] flex-none rounded-full bg-mint" />
          {t.hero.eyebrow}
        </div>

        <SplitReveal
          as="h1"
          text={t.hero.title}
          delay={0.1}
          wordDelay={0.035}
          className="m-0 max-w-[17ch] text-[clamp(34px,4.5vw,64px)] leading-[1.12] font-semibold tracking-[-0.025em] text-balance text-ink rtl:leading-[1.3] rtl:tracking-normal"
        />

        <p
          style={enterDelay(0.16)}
          className="mt-enter mt-[clamp(18px,2.4vw,26px)] max-w-[48ch] text-[clamp(16.5px,1.3vw,19px)] leading-[1.8] text-ink-soft text-pretty"
        >
          {t.hero.sub}
        </p>

        <div style={enterDelay(0.24)} className="mt-enter mt-[clamp(24px,3vw,36px)] flex flex-wrap gap-3">
          <Magnetic className="inline-block">
            <Link
              href={`/${lang}/start`}
              className="inline-block cursor-pointer rounded-full border-0 bg-ink px-[30px] py-[17px] text-[16.5px] font-semibold text-white transition-colors duration-300 hover:bg-mint hover:text-dark"
            >
              {t.hero.cta1}
            </Link>
          </Magnetic>
          <SectionLink
            section="work"
            className="cursor-pointer rounded-full border border-ink/20 bg-transparent px-[30px] py-[17px] text-[16.5px] font-semibold text-ink transition-colors duration-300 hover:border-dark hover:bg-surface"
          >
            {t.hero.cta2}
          </SectionLink>
        </div>

        <div
          style={enterDelay(0.32)}
          className="mt-enter mt-[clamp(28px,3.6vw,46px)] max-w-[52ch] border-t border-ink/[.09] pt-[clamp(18px,2.4vw,24px)]"
        >
          <div className="mb-2 flex items-center gap-2 font-manrope text-[12px] font-bold tracking-[.12em] text-mint-deep uppercase rtl:text-[14px]">
            <span className="block h-[5px] w-[5px] rounded-full bg-mint" />
            {t.tagline}
          </div>
          <p className="m-0 text-[15px] leading-[1.75] text-ink-soft">{t.hero.fit}</p>
        </div>
      </div>

      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        aria-hidden
        className="mt-enter-scale relative mx-auto w-full max-w-[520px] pt-[clamp(8px,2vw,24px)] pb-[clamp(40px,5vw,64px)] lg:max-w-none"
        style={{ perspective: 1200, ...enterDelay(0.2) }}
      >
        <ParallaxLayer mvX={springX} mvY={springY} depth={6} className="relative z-10 w-[min(100%,460px)]">
          <DirectionBoard />
        </ParallaxLayer>

        <ParallaxLayer
          mvX={springX}
          mvY={springY}
          depth={11}
          className="hb-product absolute end-0 bottom-0 z-0 hidden w-[132px] rounded-[26px] bg-gradient-to-b from-dark to-[#0a1f19] p-[7px] shadow-[0_10px_24px_-14px_rgba(7,27,22,.5),0_50px_80px_-34px_rgba(7,27,22,.6)] ring-1 ring-white/[.06] sm:block"
          style={{ aspectRatio: "9 / 18.6" }}
        >
          <motion.div
            animate={reducedMotion ? undefined : { y: [0, -8, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
            className="relative flex h-full flex-col overflow-hidden rounded-[20px] bg-canvas"
          >
            <div className="flex flex-col gap-2 px-3 pb-2 pt-3.5">
              <span className="mx-auto block h-1 w-[28px] rounded-full bg-ink/[.18]" />
              <span className="block h-[7px] w-[58%] rounded bg-dark" />
              <span className="block h-1.5 w-[80%] rounded bg-ink/[.14]" />
            </div>
            <div className="flex flex-1 flex-col gap-1.5 px-3 py-1">
              <div className="h-8 rounded-[9px] border border-ink/[.06] bg-surface" />
              <div className="h-8 rounded-[9px] bg-mint-soft" />
              <div className="h-8 rounded-[9px] border border-ink/[.06] bg-surface" />
            </div>
            <div className="px-3 pb-3.5 pt-2">
              <div className="flex h-7 items-center justify-center rounded-full bg-dark">
                <span className="block h-1 w-[44%] rounded-sm bg-mint" />
              </div>
            </div>
          </motion.div>
        </ParallaxLayer>

        <ParallaxLayer
          mvX={springX}
          mvY={springY}
          depth={9}
          className="absolute -start-3 bottom-[6%] z-20 block h-12 w-12 rounded-full bg-gradient-to-br from-mint-soft to-mint/40 shadow-[0_8px_20px_-8px_theme(colors.mint/60%)]"
        >
          <span />
        </ParallaxLayer>
      </div>
    </>
  );

  return (
    <section
      ref={sectionRef}
      className="mx-auto max-w-[1280px] px-5 pb-[clamp(30px,4vw,60px)] pt-[clamp(36px,5vw,72px)] sm:px-6"
    >
      {prefersReducedMotion ? (
        <div className={HERO_GRID}>{content}</div>
      ) : (
        <ScrollExit target={sectionRef}>{content}</ScrollExit>
      )}
    </section>
  );
}

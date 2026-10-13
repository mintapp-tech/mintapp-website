"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { useLanguage } from "@/lib/language-context";

// Device mockups for real product screens. Both show the whole screenshot:
// the phone screen takes the image's exact aspect ratio, and the browser
// scrolls through pages taller than its window instead of cropping them.
// Sizes are in container-query units (cqw) so the frame keeps its
// proportions from a 132px homepage card up to a full-width hero.

interface ShotProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  sizes: string;
  priority?: boolean;
  className?: string;
}

export function PhoneMockup({ src, alt, width, height, sizes, priority, className = "" }: ShotProps) {
  return (
    <div className={`@container w-full ${className}`}>
      {/* titanium rim */}
      <div className="relative rounded-[16cqw] bg-[linear-gradient(140deg,#4a4e55_0%,#17191c_28%,#0c0d0f_62%,#3a3d43_100%)] p-[1.2cqw] shadow-[0_50px_80px_-34px_rgba(7,12,10,.6),0_18px_30px_-18px_rgba(7,12,10,.35)]">
        {/* side buttons */}
        <span className="absolute -start-[.7cqw] top-[17%] block h-[5%] w-[.9cqw] rounded-s-full bg-[#2a2d32]" />
        <span className="absolute -start-[.7cqw] top-[25%] block h-[9%] w-[.9cqw] rounded-s-full bg-[#2a2d32]" />
        <span className="absolute -end-[.7cqw] top-[24%] block h-[13%] w-[.9cqw] rounded-e-full bg-[#2a2d32]" />
        {/* bezel */}
        <div className="rounded-[14.8cqw] bg-black p-[2.6cqw]">
          <div className="relative overflow-hidden rounded-[12cqw] bg-black" style={{ aspectRatio: `${width} / ${height}` }}>
            <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
            {/* dynamic island + glass reflection */}
            <span className="absolute start-1/2 top-[2.4cqw] block h-[7.4cqw] w-[27cqw] -translate-x-1/2 rounded-full bg-black rtl:translate-x-1/2" />
            <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(118deg,rgba(255,255,255,.13)_0%,rgba(255,255,255,0)_32%)]" />
          </div>
        </div>
      </div>
    </div>
  );
}

// A browser (or desktop app) window. `viewport` is the visible area's
// width / height; pages taller than that scroll on hover or keyboard focus
// (or by swiping on touch screens and with reduced motion).
export function BrowserMockup({
  src,
  alt,
  width,
  height,
  sizes,
  priority,
  className = "",
  label,
  viewport = 16 / 10,
  hint = true,
}: ShotProps & { label?: string; viewport?: number; hint?: boolean }) {
  const { t } = useLanguage();
  // Only clearly tall pages scroll; anything close to the window's shape is shown whole.
  const scrolls = height / width > (1 / viewport) * 1.25;
  // translateY percentages are relative to the image's own height.
  const travel = scrolls ? (1 - width / viewport / height) * 100 : 0;
  const style = { aspectRatio: scrolls ? `${viewport}` : `${width} / ${height}`, "--travel": `-${travel.toFixed(2)}%`, "--dur": `${Math.min(14, 2 + height / width * 1.6).toFixed(1)}s` } as CSSProperties;

  return (
    <div className={`@container w-full ${className}`}>
      <div className="overflow-hidden rounded-[1.6cqw] bg-white shadow-[0_50px_80px_-40px_rgba(7,12,10,.55),0_16px_32px_-20px_rgba(7,12,10,.3)] ring-1 ring-black/[.08]">
        <div dir="ltr" className="relative flex h-[max(22px,4.2cqw)] items-center gap-[max(4px,.9cqw)] border-b border-black/[.06] bg-[#f2f3f1] px-[max(8px,1.8cqw)]">
          <span className="block aspect-square h-[max(6px,1.2cqw)] rounded-full bg-[#ff5f57]" />
          <span className="block aspect-square h-[max(6px,1.2cqw)] rounded-full bg-[#febc2e]" />
          <span className="block aspect-square h-[max(6px,1.2cqw)] rounded-full bg-[#28c840]" />
          <span className="absolute start-1/2 flex h-[58%] w-[42%] -translate-x-1/2 items-center justify-center truncate rounded-full bg-white text-[max(7px,1.5cqw)] text-ink-faint ring-1 ring-black/[.05]">
            {label}
          </span>
        </div>
        <div
          tabIndex={scrolls ? 0 : undefined}
          role={scrolls ? "region" : undefined}
          aria-label={scrolls ? alt : undefined}
          className={`group relative overflow-hidden bg-white outline-none focus-visible:ring-2 focus-visible:ring-mint-deep focus-visible:ring-inset ${scrolls ? "overscroll-contain [scrollbar-width:none] motion-reduce:overflow-y-auto [@media(hover:none)]:overflow-y-auto" : ""}`}
          style={style}
        >
          <div className={scrolls ? "transition-transform duration-[var(--dur)] ease-in-out [@media(hover:hover)]:motion-safe:group-hover:[transform:translateY(var(--travel))] motion-safe:group-focus-visible:[transform:translateY(var(--travel))]" : ""}>
            <Image src={src} alt={alt} width={width} height={height} sizes={sizes} priority={priority} className="block h-auto w-full" />
          </div>
          {scrolls && hint && (
            <span className="pointer-events-none absolute end-[2cqw] bottom-[2cqw] rounded-full bg-dark/80 px-[max(8px,1.6cqw)] py-[max(4px,.8cqw)] text-[max(10px,1.5cqw)] font-medium text-canvas backdrop-blur transition-opacity duration-300 group-hover:opacity-0 group-focus-visible:opacity-0">
              {t.work.scrollHint} ↓
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

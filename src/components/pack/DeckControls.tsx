"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

// The Direction Pack's controls: fits each 1280 x 720 slide to the window, moves
// between slides with the keyboard or the buttons, enters full screen, and exports
// with the browser's own print-to-PDF (16:9 pages or A4), only for an approved Pack.
// Nothing animates; scrolling is instant with reduced motion.

export interface DeckLabels {
  back: string;
  backHref: string;
  previous: string;
  next: string;
  fullscreen: string;
  // "Slide {n} of {m}"
  slideOf: string;
  exportSlides: string;
  exportA4: string;
  printHelp: string;
  keys: string;
}

const A4_STYLE = "@page{size:A4 landscape;margin:0}";
const fill = (template: string, n: number, m: number) => template.replace("{n}", String(n)).replace("{m}", String(m));

export default function DeckControls({ total, mode, labels, dir }: { total: number; mode: "approved" | "preview"; labels: DeckLabels; dir: "ltr" | "rtl" }) {
  const [current, setCurrent] = useState(1);
  const toolbar = useRef<HTMLDivElement>(null);

  // Fit: one slide fills the window below the toolbar; phones read in a column (CSS).
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".dp-root");
    if (!root) return;
    const fit = () => {
      const bar = toolbar.current?.offsetHeight ?? 56;
      const scale = Math.max(0.2, Math.min((window.innerWidth - 32) / 1280, (window.innerHeight - bar - 40) / 720));
      root.style.setProperty("--dp-scale", scale.toFixed(4));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // Concept screens are drawn at their natural size inside device frames; a long one is
  // scaled down until its slide fits (measured, so nothing is ever clipped). Phones read
  // the deck as a column and need no fitting.
  useEffect(() => {
    const fitFrames = () => {
      if (window.innerWidth < 700) return;
      for (const body of Array.from(document.querySelectorAll<HTMLElement>(".dp-slide[data-slide=screen] .dp-body"))) {
        const frames = Array.from(body.querySelectorAll<HTMLElement>(".dp-frame-desktop, .dp-frame-phone"));
        for (let pass = 0; pass < 4 && body.scrollHeight > body.clientHeight + 1; pass++) {
          const ratio = (body.clientHeight / body.scrollHeight) * 0.97;
          for (const frame of frames) frame.style.zoom = String(Number(getComputedStyle(frame).zoom || "1") * ratio);
        }
      }
    };
    fitFrames();
    window.addEventListener("resize", fitFrames);
    return () => window.removeEventListener("resize", fitFrames);
  }, []);

  // Which slide is on screen.
  useEffect(() => {
    const slides = Array.from(document.querySelectorAll<HTMLElement>(".dp-slide"));
    const seen = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setCurrent(slides.indexOf(e.target as HTMLElement) + 1);
      },
      { threshold: 0.6 },
    );
    slides.forEach((s) => seen.observe(s));
    return () => seen.disconnect();
  }, []);

  const go = useCallback(
    (n: number) => {
      const target = Math.min(total, Math.max(1, n));
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.getElementById(`slide-${target}`)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
      setCurrent(target);
    },
    [total],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(e.target.tagName) && e.key !== "PageDown" && e.key !== "PageUp") return;
      const forward = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
      const backward = dir === "rtl" ? "ArrowRight" : "ArrowLeft";
      if (e.key === forward || e.key === "PageDown" || e.key === "ArrowDown") (e.preventDefault(), go(current + 1));
      else if (e.key === backward || e.key === "PageUp" || e.key === "ArrowUp") (e.preventDefault(), go(current - 1));
      else if (e.key === "Home") (e.preventDefault(), go(1));
      else if (e.key === "End") (e.preventDefault(), go(total));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, dir, go, total]);

  const exportPdf = (layout: "slides" | "a4") => {
    const root = document.querySelector<HTMLElement>(".dp-root");
    if (!root) return;
    root.dataset.print = layout;
    // The deck's page-size rule is rewritten in place, so it wins whatever the order of styles.
    const page = document.getElementById("dp-page");
    const before = page?.textContent ?? "";
    if (page && layout === "a4") page.textContent = A4_STYLE;
    const done = () => {
      delete root.dataset.print;
      if (page) page.textContent = before;
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    window.print();
  };

  const button = "rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-[13px] font-semibold text-ink hover:border-ink/40 disabled:opacity-40";

  return (
    <div ref={toolbar} className="dp-toolbar border-b border-ink/10 bg-white/95 backdrop-blur" role="toolbar" aria-label={fill(labels.slideOf, current, total)}>
      <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-2 px-4 py-2.5">
        <Link href={labels.backHref} className="me-auto text-[13.5px] font-semibold text-ink-soft hover:text-ink">
          <span aria-hidden className="inline-block rtl:-scale-x-100">←</span> {labels.back}
        </Link>
        <span className="text-[13px] text-ink-soft" aria-live="polite" data-slide-counter>
          {fill(labels.slideOf, current, total)}
        </span>
        <button type="button" className={button} onClick={() => go(current - 1)} disabled={current <= 1} aria-label={labels.previous}>
          <span aria-hidden className="inline-block rtl:-scale-x-100">‹</span>
        </button>
        <button type="button" className={button} onClick={() => go(current + 1)} disabled={current >= total} aria-label={labels.next}>
          <span aria-hidden className="inline-block rtl:-scale-x-100">›</span>
        </button>
        <button type="button" className={button} onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}>
          {labels.fullscreen}
        </button>
        {mode === "approved" && (
          <>
            <button type="button" className={button} onClick={() => exportPdf("slides")} data-export="slides" title={labels.printHelp}>
              {labels.exportSlides}
            </button>
            <button type="button" className={button} onClick={() => exportPdf("a4")} data-export="a4" title={labels.printHelp}>
              {labels.exportA4}
            </button>
          </>
        )}
        <p className="sr-only">{labels.keys}</p>
      </div>
    </div>
  );
}

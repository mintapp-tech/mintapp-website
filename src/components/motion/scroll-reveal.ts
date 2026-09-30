"use client";

import { useEffect, type RefObject } from "react";

// Matches the old whileInView margin: an element reveals once it is 8% inside the viewport.
export const REVEAL_TRIGGER_MARGIN = 0.08;

export function shouldArmReveal({
  top,
  viewportHeight,
  reducedMotion,
}: {
  top: number;
  viewportHeight: number;
  reducedMotion: boolean;
}): boolean {
  return !reducedMotion && top >= viewportHeight * (1 - REVEAL_TRIGGER_MARGIN);
}

// Server HTML always renders revealed content fully visible, and the CSS entrance
// animation plays without JavaScript. After hydration, only elements that are still
// below the fold get re-hidden ("armed") so the entrance can replay when scrolled to.
// The attribute is set on the DOM directly because React never renders it.
export function useScrollReveal(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!shouldArmReveal({ top: el.getBoundingClientRect().top, viewportHeight: window.innerHeight, reducedMotion })) {
      return;
    }

    el.dataset.reveal = "armed";
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          el.dataset.reveal = "play";
          observer.disconnect();
        }
      },
      { rootMargin: `0px 0px -${REVEAL_TRIGGER_MARGIN * 100}% 0px` },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
}

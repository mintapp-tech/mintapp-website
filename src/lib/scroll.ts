import type Lenis from "lenis";

declare global {
  interface Window {
    __lenis?: Lenis;
  }
}

// Lenis learns about native scrolling (keyboard, scrollbar, focus, assistive
// technology scrolling a link into view) from the next scroll event, so its
// position can trail the page's by a frame. A destination it computes in that
// gap is off by exactly the unseen scroll (#17), so resync it with the page first.
function syncedLenis(): Lenis | undefined {
  const lenis = window.__lenis;
  lenis?.resize();
  return lenis;
}

export function scrollToSection(id: string) {
  if (typeof document === "undefined") return;
  const el = document.getElementById(id);
  if (!el) return;
  const lenis = syncedLenis();
  if (lenis) {
    lenis.scrollTo(el, { offset: -88, duration: 0.8 });
  } else {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export function scrollToTop() {
  if (typeof window === "undefined") return;
  const lenis = syncedLenis();
  if (lenis) {
    lenis.scrollTo(0, { duration: 0.8 });
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

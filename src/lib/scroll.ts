import type Lenis from "lenis";
import type { Lang } from "@/lib/i18n/types";

declare global {
  interface Window {
    __lenis?: Lenis;
  }
}

export function scrollToSection(id: string) {
  if (typeof document === "undefined") return;
  const el = document.getElementById(id);
  if (!el) return;
  if (typeof window !== "undefined" && window.__lenis) {
    window.__lenis.scrollTo(el, { offset: -88, duration: 0.8 });
  } else {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export function scrollToTop() {
  if (typeof window === "undefined") return;
  if (window.__lenis) {
    window.__lenis.scrollTo(0, { duration: 0.8 });
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

/**
 * Section anchors (#work, #services, ...) only exist on the locale homepage
 * (/en or /ar). From any other page, navigate there first and let
 * HashScrollHandler finish the scroll once the homepage has mounted.
 */
export function goToSection(router: { push: (href: string) => void }, pathname: string, locale: Lang, id: string) {
  if (pathname === `/${locale}`) {
    scrollToSection(id);
  } else {
    router.push(`/${locale}#${id}`);
  }
}

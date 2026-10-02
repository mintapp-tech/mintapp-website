"use client";

import { useEffect, useId, useRef, type CSSProperties, type KeyboardEvent, type RefObject } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "@/lib/language-context";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

export const CONTACT_PANEL_ID = "contact-panel";
const SUPPORT_EMAIL = "hello@mintapp.tech";

const delay = (seconds: number) => ({ "--mt-delay": `${seconds}s` }) as CSSProperties;

// Two routes on one short path, in the same visual language as the hero's
// direction board: a project (primary) or a general email inquiry.
// Desktop: a card anchored under the header. Mobile: a bottom sheet.
// Modal: focus is contained, Escape or a click outside closes it, background
// scroll is locked, and focus returns to whatever opened it.
export function ContactPanel({
  open,
  onClose,
  returnFocusTo,
}: {
  open: boolean;
  onClose: () => void;
  returnFocusTo: RefObject<HTMLElement | null>;
}) {
  const { t, lang, arrow } = useLanguage();
  const c = t.contact;
  const prefersReducedMotion = usePrefersReducedMotion();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      panelRef.current?.focus();
    } else if (wasOpen.current) {
      wasOpen.current = false;
      returnFocusTo.current?.focus();
    }
  }, [open, returnFocusTo]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.__lenis?.stop();
    return () => {
      document.body.style.overflow = previousOverflow;
      window.__lenis?.start();
    };
  }, [open]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !panelRef.current) return;
    const focusable = panelRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panelRef.current || !panelRef.current.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !panelRef.current.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  };

  const transition = prefersReducedMotion ? { duration: 0 } : { duration: 0.28, ease: [0.2, 0.7, 0.2, 1] as const };

  // Backdrop and panel are separate keyed children so both animate out on close.
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="contact-backdrop"
          aria-hidden
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition}
          className="fixed inset-0 z-[85] bg-dark/45 md:bg-dark/15"
        />
      )}
      {open && (
        <motion.div
          key="contact-panel"
          ref={panelRef}
          id={CONTACT_PANEL_ID}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          onKeyDown={onKeyDown}
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={transition}
          className="fixed inset-x-0 bottom-0 z-[90] max-h-[calc(100dvh-16px)] overflow-y-auto rounded-t-[26px] border border-ink/[.08] bg-surface px-5 pt-5 pb-[max(22px,env(safe-area-inset-bottom))] text-ink shadow-[0_-20px_60px_-30px_rgba(7,27,22,.45)] outline-none md:inset-x-auto md:top-[84px] md:bottom-auto md:end-[max(24px,calc((100vw-1280px)/2+24px))] md:w-[400px] md:rounded-[22px] md:p-6 md:shadow-[0_10px_30px_-18px_rgba(7,27,22,.35),0_50px_90px_-40px_rgba(7,27,22,.45)]"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 font-manrope text-[11.5px] font-bold tracking-[.1em] text-mint-deep uppercase rtl:text-[13px]">
                <span aria-hidden className="block h-1.5 w-1.5 rounded-full bg-mint" />
                {c.nav}
              </div>
              <h2 id={titleId} className="m-0 mt-1.5 text-[clamp(19px,2vw,22px)] leading-[1.3] font-semibold tracking-[-0.01em] rtl:tracking-normal">
                {c.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={c.close}
              className="flex h-10 w-10 flex-none cursor-pointer items-center justify-center rounded-[12px] border border-ink/[.14] bg-transparent text-[20px] leading-none text-ink transition-colors hover:border-ink/30"
            >
              <span aria-hidden>×</span>
            </button>
          </div>

          <div className="relative mt-5 grid gap-3 ps-8">
            <span aria-hidden className="absolute start-[7px] top-5 bottom-8 block w-[2px] overflow-hidden rounded-full bg-ink/[.1]">
              <span className="mt-draw-y absolute inset-0 block rounded-full bg-mint" />
            </span>

            <div className="relative">
              <span aria-hidden className="mt-node absolute -start-8 top-4 block h-4 w-4 rounded-full bg-mint shadow-[0_0_0_5px_theme(colors.mint/18%)]" style={delay(0.1)} />
              <Link
                href={`/${lang}/start`}
                onClick={onClose}
                className="group block rounded-2xl bg-dark p-4 text-canvas transition-transform duration-300 hover:-translate-y-0.5"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-[16.5px] font-semibold">{c.startTitle}</span>
                  <span aria-hidden className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-mint text-[15px] font-bold text-dark transition-transform duration-300 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5">
                    {arrow}
                  </span>
                </span>
                <span className="mt-1.5 block text-[14px] leading-[1.65] text-canvas/75">{c.startDesc}</span>
              </Link>
            </div>

            <div className="relative">
              <span aria-hidden className="mt-node absolute -start-8 top-4 block h-4 w-4 rounded-full border-2 border-mint bg-surface" style={delay(0.3)} />
              <a href={`mailto:${SUPPORT_EMAIL}`} className="block rounded-2xl border border-ink/[.1] bg-canvas p-4 transition-colors hover:border-mint-deep/40">
                <span className="block text-[16px] font-semibold text-ink">{c.generalTitle}</span>
                <span className="mt-1 block text-[14px] leading-[1.65] text-ink-soft">{c.generalDesc}</span>
                <span dir="ltr" className="mt-2 inline-block text-[15px] font-semibold text-dark underline decoration-mint decoration-[1.5px] underline-offset-4">
                  {SUPPORT_EMAIL}
                </span>
              </a>
            </div>
          </div>

          <p className="m-0 mt-4 flex items-center gap-2 ps-8 text-[13.5px] text-ink-soft">
            <span aria-hidden className="block h-[5px] w-[5px] flex-none rounded-full bg-mint-deep" />
            {c.reply}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "@/lib/language-context";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { HomeLink, LanguageLink, NavLink, SectionLink } from "./nav/links";
import { LogoMark, Wordmark } from "./Logo";
import { Magnetic } from "./motion/Magnetic";

const navLink =
  "cursor-pointer border-0 bg-transparent px-0.5 py-1.5 text-[15px] font-medium text-ink-soft transition-colors hover:text-ink";

const menuLink = "cursor-pointer border-0 bg-transparent py-3 text-start text-[30px] font-medium text-canvas";

const MENU_ID = "mobile-menu";

export default function Header() {
  const { t, lang } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  const prefersReducedMotion = usePrefersReducedMotion();

  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  // Focus moves into the dialog on open and back to the trigger on close.
  useEffect(() => {
    if (menuOpen) {
      wasOpen.current = true;
      closeRef.current?.focus();
    } else if (wasOpen.current) {
      wasOpen.current = false;
      triggerRef.current?.focus();
    }
  }, [menuOpen]);

  // Lock background scroll (native and Lenis) and close if the viewport grows to desktop.
  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.__lenis?.stop();

    const desktop = window.matchMedia("(min-width: 768px)");
    const onViewportChange = () => {
      if (desktop.matches) setMenuOpen(false);
    };
    desktop.addEventListener("change", onViewportChange);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.__lenis?.start();
      desktop.removeEventListener("change", onViewportChange);
    };
  }, [menuOpen]);

  const onDialogKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu();
      return;
    }
    if (e.key !== "Tab" || !dialogRef.current) return;
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !dialogRef.current.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      <header className="sticky top-0 z-[60] border-b border-ink/[.07] bg-canvas/[.86] backdrop-blur-md">
        <div className="mx-auto flex h-[74px] max-w-[1280px] items-center gap-3 px-5 max-[359px]:gap-2 sm:px-6 md:gap-8">
          <HomeLink ariaLabel="Mintapp" className="flex shrink-0 cursor-pointer items-center gap-2.5 border-0 bg-transparent p-0">
            <Wordmark />
          </HomeLink>

          <nav className="ms-auto hidden items-center gap-3.5 md:flex md:gap-6 lg:gap-7">
            <SectionLink section="work" className={navLink}>
              {t.nav.work}
            </SectionLink>
            <NavLink href={`/${lang}/services`} className={navLink}>
              {t.nav.services}
            </NavLink>
            <NavLink href={`/${lang}/about`} className={navLink}>
              {t.nav.about}
            </NavLink>
            <LanguageLink className="cursor-pointer rounded-full border border-ink/[.16] bg-transparent px-3.5 py-[7px] font-manrope text-[12.5px] font-bold tracking-[.08em] text-ink transition-colors hover:border-mint-deep hover:bg-surface"
              label={t.nav.lang}
            />
            <Magnetic strength={0.25} className="inline-block">
              <NavLink
                href={`/${lang}/start`}
                className="inline-block cursor-pointer rounded-full border-0 bg-ink px-[22px] py-3 text-[15px] font-semibold text-white transition-colors hover:bg-mint hover:text-dark"
              >
                {t.nav.start}
              </NavLink>
            </Magnetic>
          </nav>

          <div className="ms-auto flex items-center gap-2 max-[359px]:gap-1 md:hidden">
            <NavLink
              href={`/${lang}/start`}
              className="inline-block cursor-pointer whitespace-nowrap rounded-full border-0 bg-ink px-3.5 py-[11px] text-[14px] leading-none font-semibold text-white transition-colors hover:bg-mint hover:text-dark max-[359px]:px-2.5 max-[359px]:text-[13px]"
            >
              {t.nav.start}
            </NavLink>
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label={t.nav.menu}
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              aria-controls={MENU_ID}
              className="flex h-[46px] w-[46px] shrink-0 cursor-pointer flex-col items-center justify-center gap-[5px] rounded-[13px] border border-ink/[.16] bg-transparent max-[359px]:h-11 max-[359px]:w-11"
            >
              <span className="block h-[1.6px] w-[18px] bg-ink" />
              <span className="block h-[1.6px] w-[18px] bg-ink" />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            ref={dialogRef}
            id={MENU_ID}
            role="dialog"
            aria-modal="true"
            aria-label={t.nav.menu}
            onKeyDown={onDialogKeyDown}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 14 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
            className="fixed inset-0 z-[80] flex flex-col bg-dark px-6 py-6 text-canvas sm:px-8 md:hidden"
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2.5">
                <LogoMark size={26} variant="white" />
                <span className="font-manrope text-[19px] font-bold tracking-[-0.03em] text-canvas">mintapp</span>
              </span>
              <button
                ref={closeRef}
                type="button"
                onClick={closeMenu}
                aria-label={t.nav.close}
                className="flex h-[46px] w-[46px] cursor-pointer items-center justify-center rounded-[13px] border border-white/[.24] bg-transparent text-[22px] leading-none text-canvas"
              >
                <span aria-hidden>×</span>
              </button>
            </div>
            <nav className="my-auto flex flex-col gap-1.5">
              <HomeLink onNavigate={closeMenu} className={menuLink}>
                {t.nav.home}
              </HomeLink>
              <SectionLink section="work" onNavigate={closeMenu} className={menuLink}>
                {t.nav.work}
              </SectionLink>
              <NavLink href={`/${lang}/services`} onNavigate={closeMenu} className={menuLink}>
                {t.nav.services}
              </NavLink>
              <NavLink href={`/${lang}/about`} onNavigate={closeMenu} className={menuLink}>
                {t.nav.about}
              </NavLink>
            </nav>
            <div className="flex flex-col gap-3">
              <LanguageLink
                onNavigate={closeMenu}
                className="self-start rounded-full border border-canvas/24 bg-transparent px-[15px] py-2 text-[13.5px] font-semibold text-canvas transition-colors hover:border-mint hover:bg-canvas/[.08]"
                label={t.footer.langBtn}
              />
              <NavLink
                href={`/${lang}/start`}
                onNavigate={closeMenu}
                className="block w-full cursor-pointer rounded-full border-0 bg-mint px-6 py-[17px] text-center text-[17px] font-bold text-dark"
              >
                {t.nav.start}
              </NavLink>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

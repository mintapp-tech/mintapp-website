"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "@/lib/language-context";
import { scrollToSection, scrollToTop } from "@/lib/scroll";
import { LogoMark, Wordmark } from "./Logo";

const navLink =
  "cursor-pointer border-0 bg-transparent px-0.5 py-1.5 text-[15px] font-medium text-ink-soft transition-colors hover:text-ink";

export default function Header() {
  const { t, toggleLang } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);

  const go = (id: string) => {
    setMenuOpen(false);
    scrollToSection(id);
  };

  return (
    <>
      <header className="sticky top-0 z-[60] border-b border-ink/[.07] bg-canvas/[.86] backdrop-blur-md">
        <div className="mx-auto flex h-[74px] max-w-[1280px] items-center gap-4 px-5 sm:px-6 md:gap-8">
          <Wordmark onClick={scrollToTop} />

          <nav className="ms-auto hidden items-center gap-3.5 md:flex md:gap-6 lg:gap-7">
            <button className={navLink} onClick={() => go("work")}>
              {t.nav.work}
            </button>
            <button className={navLink} onClick={() => go("services")}>
              {t.nav.services}
            </button>
            <button className={navLink} onClick={() => go("process")}>
              {t.nav.about}
            </button>
            <button className={navLink} onClick={() => go("insights")}>
              {t.nav.insights}
            </button>
            <button
              onClick={toggleLang}
              className="cursor-pointer rounded-full border border-ink/[.16] bg-transparent px-3.5 py-[7px] font-manrope text-[12.5px] font-bold tracking-[.08em] text-ink transition-colors hover:border-mint-deep hover:bg-surface"
            >
              {t.nav.lang}
            </button>
            <button
              onClick={() => go("differentiator")}
              className="cursor-pointer rounded-full border-0 bg-ink px-[22px] py-3 text-[15px] font-semibold text-white transition-all hover:-translate-y-px hover:bg-mint hover:text-dark"
            >
              {t.nav.start}
            </button>
          </nav>

          <div className="ms-auto flex items-center gap-2.5 md:hidden">
            <button
              onClick={toggleLang}
              className="cursor-pointer rounded-full border border-ink/[.16] bg-transparent px-3.5 py-2 font-manrope text-[12.5px] font-bold tracking-[.08em]"
            >
              {t.nav.lang}
            </button>
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Menu"
              className="flex h-[46px] w-[46px] cursor-pointer flex-col items-center justify-center gap-[5px] rounded-[13px] border border-ink/[.16] bg-transparent"
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
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 14 }}
            transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
            className="fixed inset-0 z-[80] flex flex-col bg-dark px-6 py-6 text-canvas sm:px-8"
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2.5">
                <LogoMark size={26} variant="white" />
                <span className="font-manrope text-[19px] font-bold tracking-[-0.03em] text-canvas">mintapp</span>
              </span>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Close"
                className="flex h-[46px] w-[46px] cursor-pointer items-center justify-center rounded-[13px] border border-white/[.24] bg-transparent text-[22px] leading-none text-canvas"
              >
                ×
              </button>
            </div>
            <nav className="my-auto flex flex-col gap-1.5">
              {[
                {
                  label: t.nav.home,
                  onClick: () => {
                    setMenuOpen(false);
                    scrollToTop();
                  },
                },
                { label: t.nav.work, onClick: () => go("work") },
                { label: t.nav.services, onClick: () => go("services") },
                { label: t.nav.about, onClick: () => go("process") },
                { label: t.nav.insights, onClick: () => go("insights") },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className="cursor-pointer border-0 bg-transparent py-3 text-start text-[30px] font-medium text-canvas"
                >
                  {item.label}
                </button>
              ))}
            </nav>
            <button
              onClick={() => go("differentiator")}
              className="w-full cursor-pointer rounded-full border-0 bg-mint px-6 py-[17px] text-[17px] font-bold text-dark"
            >
              {t.nav.start}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

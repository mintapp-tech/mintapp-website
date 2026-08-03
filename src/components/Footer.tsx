"use client";

import { useRouter, usePathname } from "next/navigation";
import { useLanguage } from "@/lib/language-context";
import { LogoMark } from "./Logo";
import { goToSection } from "@/lib/scroll";

export default function Footer() {
  const { t, lang, toggleLang } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();

  const links = [
    { label: t.nav.work, onClick: () => goToSection(router, pathname, lang, "work") },
    { label: t.nav.services, onClick: () => router.push(`/${lang}/services`) },
    { label: t.nav.about, onClick: () => router.push(`/${lang}/about`) },
    { label: t.nav.insights, onClick: () => router.push(`/${lang}/insights`) },
  ];

  return (
    <footer className="mt-[clamp(48px,6vw,88px)] bg-dark px-5 pt-[clamp(56px,7vw,96px)] pb-11 text-canvas sm:px-6">
      <div className="mx-auto max-w-[1280px]">
        <div className="grid grid-cols-1 gap-[clamp(28px,4vw,54px)] border-b border-canvas/[.14] pb-[clamp(28px,3.4vw,44px)] sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <div className="mb-4 flex items-center gap-2.5">
              <LogoMark size={26} variant="white" />
              <span className="font-manrope text-[18px] font-bold tracking-[-0.03em] text-canvas">mintapp</span>
            </div>
            <p className="m-0 max-w-[32ch] text-[15px] leading-[1.8] text-canvas/60">{t.footer.pitch}</p>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="mb-1 font-manrope text-[11.5px] font-bold tracking-[.12em] text-canvas/60 uppercase">
              {t.footer.explore}
            </div>
            {links.map((link) => (
              <button
                key={link.label}
                onClick={link.onClick}
                className="cursor-pointer border-0 bg-transparent p-0 text-start text-[15px] text-canvas/85 transition-colors hover:text-mint"
              >
                {link.label}
              </button>
            ))}
            <button
              onClick={() => router.push(`/${lang}/start`)}
              className="cursor-pointer border-0 bg-transparent p-0 text-start text-[15px] text-canvas/85 transition-colors hover:text-mint"
            >
              {t.nav.start}
            </button>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="mb-1 font-manrope text-[11.5px] font-bold tracking-[.12em] text-canvas/60 uppercase">
              {t.footer.contact}
            </div>
            <a href="mailto:hello@mintapp.tech" className="text-[15px] text-canvas">
              hello@mintapp.tech
            </a>
            <span className="text-[15px] text-canvas">mintapp.tech</span>
            <span className="text-[15px] text-canvas/50">{t.footer.region}</span>
            <button
              onClick={toggleLang}
              className="mt-1.5 self-start rounded-full border border-canvas/24 bg-transparent px-[15px] py-2 text-[13.5px] font-semibold text-canvas transition-colors hover:border-mint hover:bg-canvas/[.08]"
            >
              {t.footer.langBtn}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap justify-between gap-3.5 pt-[22px] text-[13.5px] text-canvas/50">
          <span>{t.footer.rights}</span>
          <span className="flex gap-5">
            <span>{t.footer.privacy}</span>
            <span>{t.tagline}</span>
          </span>
        </div>
      </div>
    </footer>
  );
}

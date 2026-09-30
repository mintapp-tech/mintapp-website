"use client";

import { useLanguage } from "@/lib/language-context";
import { LogoMark } from "./Logo";
import { LanguageLink, NavLink, SectionLink } from "./nav/links";

const footerLink =
  "cursor-pointer border-0 bg-transparent p-0 text-start text-[15px] text-canvas/85 transition-colors hover:text-mint";

export default function Footer() {
  const { t, lang } = useLanguage();

  const links = [
    { label: t.nav.services, href: `/${lang}/services` },
    { label: t.nav.about, href: `/${lang}/about` },
    { label: t.nav.insights, href: `/${lang}/insights` },
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
            <SectionLink section="work" className={footerLink}>
              {t.nav.work}
            </SectionLink>
            {links.map((link) => (
              <NavLink key={link.href} href={link.href} className={footerLink}>
                {link.label}
              </NavLink>
            ))}
            <NavLink href={`/${lang}/start`} className={footerLink}>
              {t.nav.start}
            </NavLink>
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
            <LanguageLink className="mt-1.5 self-start rounded-full border border-canvas/24 bg-transparent px-[15px] py-2 text-[13.5px] font-semibold text-canvas transition-colors hover:border-mint hover:bg-canvas/[.08]">
              {t.footer.langBtn}
            </LanguageLink>
          </div>
        </div>

        <div className="flex flex-wrap justify-between gap-3.5 pt-[22px] text-[13.5px] text-canvas/50">
          <span>{t.footer.rights}</span>
          <span className="flex gap-5">
            <NavLink
              href={`/${lang}/privacy`}
              className="cursor-pointer border-0 bg-transparent p-0 text-[13.5px] text-canvas/50 underline decoration-canvas/30 decoration-[1.5px] underline-offset-4 transition-colors hover:text-mint hover:decoration-mint"
            >
              {t.footer.privacy}
            </NavLink>
            <span>{t.tagline}</span>
          </span>
        </div>
      </div>
    </footer>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction, logoutEverywhereAction } from "@/app/(admin)/login/actions";
import type { TeamMember } from "@/lib/admin/auth/config";
import type { AdminLocale, AdminMessages } from "@/lib/admin/messages";
import { LogoMark } from "@/components/Logo";
import NavLinks from "@/components/crm/NavLinks";
import MoreMenu from "@/components/crm/MoreMenu";
import LanguageSwitch from "./LanguageSwitch";
import SubmitButton from "./SubmitButton";

const initials = (name: string) =>
  name
    .replace(/\(.*?\)/g, "")
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

// Admin chrome in the chosen interface language; inquiry content inside keeps
// its own direction (dir="auto").
export default function Shell({ member, demo, locale, t, children }: { member: TeamMember; demo: boolean; locale: AdminLocale; t: AdminMessages; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-3 focus:top-3 focus:z-10 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2">
        {t.common.skip}
      </a>
      {demo && (
        <div role="note" className="bg-amber-100 px-4 py-2 text-center text-[12.5px] font-semibold text-amber-900">
          {t.common.demoBanner}
        </div>
      )}
      <header className="bg-dark text-white">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3.5 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2.5 rounded-md text-white" dir="ltr">
            <LogoMark size={24} variant="white" />
            <span className="text-[18px] font-bold tracking-[-0.03em]">mintapp</span>
            <span className="rounded-full bg-mint/15 px-2 py-0.5 text-[11px] font-bold tracking-[0.08em] text-mint uppercase">Admin</span>
          </Link>
          <NavLinks
            label={t.common.nav}
            items={[
              { href: "/dashboard", label: t.lead.nav.dashboard },
              { href: "/leads", label: t.lead.nav.leads },
              { href: "/projects", label: t.lead.nav.projects },
              { href: "/growth", label: t.lead.nav.growth, also: ["/outreach"] },
            ]}
          >
            <MoreMenu
              label={t.lead.nav.more}
              items={[
                { href: "/settings", label: t.lead.nav.settings },
                { href: "/companies", label: t.lead.nav.companies },
              ]}
            />
          </NavLinks>
          <div className="ms-auto flex items-center gap-2.5 text-[13.5px] sm:gap-3">
            <form action="/search" method="get" role="search" className="flex items-center">
              <label htmlFor="global-search" className="sr-only">
                {t.crm.nav.searchLabel}
              </label>
              <input
                id="global-search"
                name="q"
                type="search"
                minLength={2}
                maxLength={120}
                dir="auto"
                placeholder={t.crm.nav.searchPlaceholder}
                className="w-28 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[13.5px] text-white placeholder:text-white/60 focus:border-mint focus:outline-none sm:w-40"
              />
            </form>
            <LanguageSwitch
              to={locale === "ar" ? "en" : "ar"}
              label={t.common.switchLanguage}
              title={t.common.switchLanguageLabel}
              className="cursor-pointer rounded-full px-2.5 py-1.5 font-semibold text-white/85 hover:bg-white/10 hover:text-white"
            />
            <span className="hidden items-center gap-2 text-white/80 md:flex">
              <span aria-hidden className="grid size-7 place-items-center rounded-full bg-mint text-[11.5px] font-bold text-dark">
                {initials(member.name)}
              </span>
              {member.name}
            </span>
            <form action={logoutAction}>
              <SubmitButton className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/25 px-3.5 py-1.5 font-semibold text-white hover:border-white/60 disabled:opacity-60">
                {t.common.signOut}
              </SubmitButton>
            </form>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-[1200px] px-4 pt-7 pb-16 sm:px-6 sm:pt-9">
        {children}
      </main>
      <footer className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-5 text-[12.5px] text-ink-faint sm:px-6">
        <span>
          {t.common.signedInAs(member.name)} {t.common.privacy}
        </span>
        <form action={logoutEverywhereAction}>
          <SubmitButton className="cursor-pointer text-ink-soft underline underline-offset-4 hover:text-ink disabled:opacity-60">{t.common.signOutEverywhere}</SubmitButton>
        </form>
      </footer>
    </div>
  );
}

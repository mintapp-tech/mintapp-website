import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction, logoutEverywhereAction } from "@/app/internal/login/actions";
import type { TeamMember } from "@/lib/team-auth/session";
import { LogoMark } from "@/components/Logo";
import SubmitButton from "./SubmitButton";
import { TEAM_FONT } from "./ui";

const initials = (name: string) =>
  name
    .replace(/\(.*?\)/g, "")
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

// Dashboard chrome: English, left-to-right; inquiry content inside uses dir="auto".
export default function Shell({ member, demo, children }: { member: TeamMember; demo: boolean; children: ReactNode }) {
  return (
    <div lang="en" dir="ltr" style={TEAM_FONT} className="min-h-screen bg-canvas text-ink">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-3 focus:top-3 focus:z-10 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2">
        Skip to content
      </a>
      {demo && (
        <div role="note" className="bg-amber-100 px-4 py-2 text-center text-[12.5px] font-semibold text-amber-900">
          Local demo: synthetic inquiries on a throwaway local database. Simulated actions are marked as such.
        </div>
      )}
      <header className="bg-dark text-white">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3.5 sm:px-6">
          <Link href="/internal/inquiries" className="flex items-center gap-2.5 rounded-md text-white">
            <LogoMark size={24} variant="white" />
            <span className="text-[18px] font-bold tracking-[-0.03em]">mintapp</span>
            <span className="rounded-full bg-mint/15 px-2 py-0.5 text-[11px] font-bold tracking-[0.08em] text-mint uppercase">Team</span>
          </Link>
          <nav aria-label="Dashboard" className="order-3 w-full sm:order-none sm:w-auto">
            <Link href="/internal/inquiries" aria-current="page" className="inline-block border-b-2 border-mint pb-0.5 text-[14px] font-semibold text-white">
              Inquiries
            </Link>
          </nav>
          <div className="ms-auto flex items-center gap-3 text-[13.5px]">
            <span className="hidden items-center gap-2 text-white/80 sm:flex">
              <span aria-hidden className="grid size-7 place-items-center rounded-full bg-mint text-[11.5px] font-bold text-dark">
                {initials(member.name)}
              </span>
              {member.name}
            </span>
            <form action={logoutAction}>
              <SubmitButton className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/25 px-3.5 py-1.5 font-semibold text-white hover:border-white/60 disabled:opacity-60">
                Sign out
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
          Signed in as {member.name} ({member.email}). Private to the Mintapp team. Times are Cairo time.
        </span>
        <form action={logoutEverywhereAction}>
          <SubmitButton className="cursor-pointer text-ink-soft underline underline-offset-4 hover:text-ink disabled:opacity-60">Sign out everywhere</SubmitButton>
        </form>
      </footer>
    </div>
  );
}

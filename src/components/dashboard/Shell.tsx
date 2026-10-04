import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/app/internal/login/actions";
import type { TeamMember } from "@/lib/team-auth/session";

// Dashboard chrome: English, left-to-right; inquiry content inside uses dir="auto".
export default function Shell({ member, demo, children }: { member: TeamMember; demo: boolean; children: ReactNode }) {
  return (
    <div lang="en" dir="ltr" className="min-h-screen bg-canvas font-manrope text-ink">
      {demo && (
        <div role="note" className="bg-amber-100 px-5 py-2 text-center text-[13px] font-semibold text-amber-900">
          Local demo: synthetic inquiries on a throwaway local database. Simulated actions are marked as such.
        </div>
      )}
      <header className="border-b border-ink/10 bg-surface">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-5 py-4">
          <Link href="/internal/inquiries" className="text-[17px] font-bold">
            Mintapp · Inquiries
          </Link>
          <div className="flex items-center gap-4 text-[14px]">
            <span className="text-ink-soft">{member.name}</span>
            <form action={logoutAction}>
              <button type="submit" className="cursor-pointer rounded-full border border-ink/20 px-4 py-1.5 font-semibold">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1180px] px-5 py-8">{children}</main>
    </div>
  );
}

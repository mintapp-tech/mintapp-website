import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LoginForm from "@/components/dashboard/LoginForm";
import { LogoMark } from "@/components/Logo";
import { TEAM_FONT, card } from "@/components/dashboard/ui";
import { currentTeamMember } from "@/lib/team-auth/guard";
import { dashboardConfigured } from "@/lib/team-auth/accounts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in · Mintapp team", robots: { index: false, follow: false, nocache: true } };

export default async function LoginPage() {
  if (await currentTeamMember()) redirect("/internal/inquiries");
  const configured = dashboardConfigured();
  return (
    <div lang="en" dir="ltr" style={TEAM_FONT} className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-10 text-ink">
      <main className="w-full max-w-[400px]">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <LogoMark size={28} />
          <span className="text-[20px] font-bold tracking-[-0.03em]">mintapp</span>
          <span className="rounded-full bg-mint-soft px-2 py-0.5 text-[11px] font-bold tracking-[0.08em] text-mint-deep uppercase">Team</span>
        </div>
        <div className={`${card} p-6 sm:p-8`}>
          <h1 className="m-0 text-[22px] font-bold tracking-[-0.02em]">Sign in</h1>
          <p className="mt-1.5 mb-6 text-[14px] leading-relaxed text-ink-soft">Private inquiry and meeting preparation for the Mintapp team.</p>
          {configured ? (
            <LoginForm />
          ) : (
            <p role="alert" className="m-0 rounded-xl border border-line bg-surface-2/70 p-4 text-[14px] text-ink-soft">
              Dashboard access is not configured on this deployment.
            </p>
          )}
        </div>
        <p className="mt-5 text-center text-[12.5px] text-ink-faint">Sessions end after 2 idle hours, and always after 12 hours.</p>
      </main>
    </div>
  );
}

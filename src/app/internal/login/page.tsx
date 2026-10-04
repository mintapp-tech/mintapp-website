import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LoginForm from "@/components/dashboard/LoginForm";
import { currentTeamMember } from "@/lib/team-auth/guard";
import { dashboardConfigured } from "@/lib/team-auth/accounts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in — Mintapp team", robots: { index: false, follow: false, nocache: true } };

export default async function LoginPage() {
  if (await currentTeamMember()) redirect("/internal/inquiries");
  const configured = dashboardConfigured();
  return (
    <div lang="en" dir="ltr" className="flex min-h-screen items-center justify-center bg-canvas px-5 font-manrope text-ink">
      <div className="w-full max-w-[380px] rounded-[22px] border border-ink/10 bg-surface p-7">
        <h1 className="m-0 text-[22px] font-semibold">Mintapp team</h1>
        <p className="mt-1.5 mb-6 text-[14px] text-ink-soft">Private inquiry and meeting preparation.</p>
        {configured ? (
          <LoginForm />
        ) : (
          <p role="alert" className="m-0 text-[14px] text-red-700">
            Dashboard access is not configured on this deployment.
          </p>
        )}
      </div>
    </div>
  );
}

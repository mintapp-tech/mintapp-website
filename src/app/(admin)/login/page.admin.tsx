import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthFrame from "@/components/dashboard/AuthFrame";
import LoginForm from "@/components/dashboard/LoginForm";
import { adminState } from "@/lib/admin/auth/state";
import { authMode } from "@/lib/admin/auth/config";
import { adminText } from "@/lib/admin/locale";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const state = await adminState();
  if (state.status === "ok") redirect("/inquiries");
  if (state.status === "mfa_enroll" || state.status === "mfa_challenge") redirect("/login/mfa");
  const { locale, t } = await adminText();
  const mode = authMode();
  const expired = (await searchParams).expired === "1" || state.status === "expired";
  return (
    <AuthFrame locale={locale} t={t} title={t.login.title} intro={t.login.intro} footnote={t.login.sessionNote}>
      {mode === "off" ? (
        <p role="alert" className="m-0 rounded-xl border border-line bg-surface-2/70 p-4 text-[14px] text-ink-soft">
          {t.login.notConfigured}
        </p>
      ) : (
        <>
          {expired && (
            <p role="status" className="mt-0 mb-4 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-[13.5px] text-sky-900">
              {t.login.expired}
            </p>
          )}
          <LoginForm t={t.login} />
        </>
      )}
    </AuthFrame>
  );
}

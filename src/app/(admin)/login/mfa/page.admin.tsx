import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthFrame from "@/components/dashboard/AuthFrame";
import SubmitButton from "@/components/dashboard/SubmitButton";
import { MfaChallenge, MfaEnrollment } from "@/components/dashboard/MfaForms";
import { adminState } from "@/lib/admin/auth/state";
import { adminText } from "@/lib/admin/locale";
import { logoutAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Authenticator" };

// Second step of sign-in: set up an authenticator app (first time) or enter
// its current code. Required for every account; there is no way around it.
export default async function MfaPage() {
  const state = await adminState();
  if (state.status === "ok") redirect("/inquiries");
  if (state.status !== "mfa_enroll" && state.status !== "mfa_challenge") redirect("/login");
  const { locale, t } = await adminText();
  // Only plain strings can be passed to the client forms.
  const { setupStart, setupStarting, scan, qrAlt, manualKey, code, verify, verifying, invalidCode } = t.mfa;
  const strings = { setupStart, setupStarting, scan, qrAlt, manualKey, code, verify, verifying, invalidCode, unavailable: t.login.unavailable };
  const enrolling = state.status === "mfa_enroll";
  return (
    <AuthFrame
      locale={locale}
      t={t}
      title={enrolling ? t.mfa.setupTitle : t.mfa.challengeTitle}
      intro={
        <>
          <p className="m-0">{enrolling ? t.mfa.setupIntro : t.mfa.challengeIntro}</p>
          <p className="m-0 mt-2 text-[13px] text-ink-faint" dir="auto">
            {t.mfa.signedInAs(state.email)}
          </p>
        </>
      }
      footnote={
        <form action={logoutAction} className="inline">
          <SubmitButton className="cursor-pointer text-ink-soft underline underline-offset-4 hover:text-ink">{t.mfa.useAnotherAccount}</SubmitButton>
        </form>
      }
    >
      {enrolling ? <MfaEnrollment t={strings} /> : <MfaChallenge t={strings} />}
    </AuthFrame>
  );
}

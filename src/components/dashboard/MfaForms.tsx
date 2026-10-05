"use client";

import { useActionState } from "react";
import { startEnrollmentAction, verifyMfaAction, type EnrollState, type MfaState } from "@/app/(admin)/login/actions";
import type { AdminMessages } from "@/lib/admin/messages";
import { field, primary } from "./ui";

type T = Pick<AdminMessages["mfa"], "setupStart" | "setupStarting" | "scan" | "qrAlt" | "manualKey" | "code" | "verify" | "verifying" | "invalidCode"> & { unavailable: string };

function CodeForm({ t, factorId }: { t: T; factorId?: string }) {
  const [state, action, pending] = useActionState<MfaState, FormData>(verifyMfaAction, { error: null });
  return (
    <form action={action} className="flex flex-col gap-3">
      {factorId && <input type="hidden" name="factorId" value={factorId} />}
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
        {t.code}
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          maxLength={7}
          required
          dir="ltr"
          className={`${field} text-center font-mono text-[20px] tracking-[0.4em]`}
        />
      </label>
      {state.error && (
        <p role="alert" className="m-0 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13.5px] text-red-800">
          {state.error === "invalidCode" ? t.invalidCode : t.unavailable}
        </p>
      )}
      <button type="submit" disabled={pending} className={`${primary} mt-1 px-6 py-3 text-[15px]`}>
        {pending && <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
        {pending ? t.verifying : t.verify}
      </button>
    </form>
  );
}

export function MfaChallenge({ t }: { t: T }) {
  return <CodeForm t={t} />;
}

export function MfaEnrollment({ t }: { t: T }) {
  const [state, start, pending] = useActionState<EnrollState, FormData>(startEnrollmentAction, null);
  if (state && "factorId" in state) {
    return (
      <div className="flex flex-col gap-5">
        <p className="m-0 text-[14px] leading-relaxed">{t.scan}</p>
        <div className="flex justify-center rounded-xl border border-line bg-white p-4">
          {/* An SVG data URL produced by Supabase Auth. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={state.qr} alt={t.qrAlt} width={184} height={184} className="size-[184px]" />
        </div>
        <div>
          <p className="m-0 text-[12.5px] font-semibold text-ink-soft">{t.manualKey}</p>
          <code dir="ltr" className="mt-1 block rounded-lg bg-surface-2 px-3 py-2 text-center font-mono text-[13px] break-all select-all">
            {state.secret}
          </code>
        </div>
        <CodeForm t={t} factorId={state.factorId} />
      </div>
    );
  }
  return (
    <form action={start} className="flex flex-col gap-3">
      {state && "error" in state && (
        <p role="alert" className="m-0 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13.5px] text-red-800">
          {t.unavailable}
        </p>
      )}
      <button type="submit" disabled={pending} className={`${primary} px-6 py-3 text-[15px]`}>
        {pending && <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
        {pending ? t.setupStarting : t.setupStart}
      </button>
    </form>
  );
}

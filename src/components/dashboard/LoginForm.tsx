"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/(admin)/login/actions";
import type { AdminMessages } from "@/lib/admin/messages";
import { field } from "./ui";

export default function LoginForm({ t }: { t: AdminMessages["login"] }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, { error: null });
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
        {t.email}
        <input name="email" type="email" autoComplete="username" dir="ltr" required className={`${field} font-normal rtl:text-right`} />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
        {t.password}
        <input name="password" type="password" autoComplete="current-password" dir="ltr" required className={`${field} font-normal rtl:text-right`} />
      </label>
      {state.error && (
        <p role="alert" className="m-0 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13.5px] text-red-800">
          {t[state.error]}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-1 inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-dark px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-mint-deep disabled:cursor-wait disabled:opacity-60"
      >
        {pending && <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
        {pending ? t.submitting : t.submit}
      </button>
    </form>
  );
}

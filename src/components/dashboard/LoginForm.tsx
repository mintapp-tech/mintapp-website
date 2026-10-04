"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/internal/login/actions";

export default function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, { error: null });
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-[14px] font-medium">
        Email
        <input name="email" type="email" autoComplete="username" required className="rounded-xl border border-ink/20 bg-surface px-3.5 py-2.5 text-[15px]" />
      </label>
      <label className="flex flex-col gap-1.5 text-[14px] font-medium">
        Password
        <input name="password" type="password" autoComplete="current-password" required className="rounded-xl border border-ink/20 bg-surface px-3.5 py-2.5 text-[15px]" />
      </label>
      {state.error && (
        <p role="alert" className="m-0 text-[14px] text-red-700">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="cursor-pointer rounded-full bg-ink px-6 py-3 text-[15px] font-semibold text-white disabled:opacity-60">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

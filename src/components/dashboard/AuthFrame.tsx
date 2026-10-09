import type { ReactNode } from "react";
import { LogoMark } from "@/components/Logo";
import type { AdminLocale, AdminMessages } from "@/lib/admin/messages";
import LanguageSwitch from "./LanguageSwitch";
import { card } from "./ui";

// The frame around sign-in and authenticator screens.
export default function AuthFrame({ locale, t, title, intro, children, footnote }: { locale: AdminLocale; t: AdminMessages; title: string; intro: ReactNode; children: ReactNode; footnote?: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-10 text-ink">
      <main className="w-full max-w-[420px]">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5" dir="ltr">
            <LogoMark size={28} />
            <span className="text-[20px] font-bold tracking-[-0.03em]">mintapp</span>
            <span className="rounded-full bg-mint-soft px-2 py-0.5 text-[11px] font-bold tracking-[0.08em] text-mint-deep uppercase">Admin</span>
          </div>
          <LanguageSwitch
            to={locale === "ar" ? "en" : "ar"}
            label={t.common.switchLanguage}
            title={t.common.switchLanguageLabel}
            className="cursor-pointer rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] font-semibold text-ink-soft hover:text-ink"
          />
        </div>
        <div className={`${card} p-6 sm:p-8`}>
          <h1 className="m-0 text-[22px] font-bold tracking-[-0.02em] rtl:tracking-normal">{title}</h1>
          <div className="mt-1.5 mb-6 text-[14px] leading-relaxed text-ink-soft">{intro}</div>
          {children}
        </div>
        {footnote && <div className="mt-5 text-center text-[12.5px] leading-relaxed text-ink-faint">{footnote}</div>}
      </main>
    </div>
  );
}

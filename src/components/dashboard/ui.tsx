import clsx from "clsx";
import type { ReactNode } from "react";

// Shared building blocks for the private team dashboard.

// Latin text in Manrope, Arabic in Alexandria; the browser picks per
// character. --font-team is defined in src/app/internal/layout.tsx.
export const TEAM_FONT = { fontFamily: "var(--font-team, system-ui, sans-serif)" };

// The team works in Cairo time; all dashboard times are shown in it.
export const TIME_ZONE = "Africa/Cairo";

export function formatDate(iso: string, withTime = true): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } : {}),
  }).format(new Date(iso));
}

export type ChipTone = "neutral" | "attention" | "warn" | "info" | "ok";

const CHIP_TONES: Record<ChipTone, string> = {
  neutral: "bg-surface-2 text-ink-soft",
  attention: "bg-red-50 text-red-800 ring-1 ring-red-200",
  warn: "bg-amber-50 text-amber-900 ring-1 ring-amber-200",
  info: "bg-sky-50 text-sky-900 ring-1 ring-sky-200",
  ok: "bg-mint-soft text-mint-deep ring-1 ring-mint/40",
};

export function Chip({ tone = "neutral", children, className, ...rest }: { tone?: ChipTone; children: ReactNode; className?: string } & Record<`data-${string}`, string | undefined>) {
  return (
    <span {...rest} className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold whitespace-nowrap", CHIP_TONES[tone], className)}>
      {children}
    </span>
  );
}

export const MEETING_TONES: Record<string, ChipTone> = { booked: "ok", not_booked: "neutral", cancelled: "warn", completed: "info", no_show: "warn" };
export const REVIEW_TONES: Record<string, ChipTone> = { approved: "ok", in_review: "info", draft: "neutral", superseded: "neutral" };

export const card = "rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(7,27,22,0.04)]";
export const button =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-ink/15 bg-surface px-4 py-2 text-[13.5px] font-semibold text-ink transition-colors hover:border-ink/40 disabled:cursor-wait disabled:opacity-60";
export const primary =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-dark px-4 py-2 text-[13.5px] font-semibold text-white transition-colors hover:bg-mint-deep disabled:cursor-wait disabled:opacity-60";
export const field = "w-full rounded-xl border border-ink/15 bg-surface px-3.5 py-2.5 text-[14.5px] transition-colors focus:border-mint-deep focus:outline-none focus:ring-2 focus:ring-mint/40";
export const eyebrow = "m-0 text-[11.5px] font-bold tracking-[0.08em] text-ink-faint uppercase";

import Link from "next/link";
import type { ReactNode } from "react";
import { Chip, card, eyebrow, type ChipTone } from "@/components/dashboard/ui";
import { STAGE_TONES } from "@/lib/crm/stages";
import type { CrmMessages } from "@/lib/admin/crm-messages";
import type { Stage } from "@/lib/crm/types";

export function PageHead({ eyebrowText, title, children }: { eyebrowText?: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div>
        {eyebrowText && <p className={eyebrow}>{eyebrowText}</p>}
        <h1 className="m-0 mt-1 text-[28px] font-bold tracking-[-0.02em] sm:text-[32px] rtl:tracking-normal">{title}</h1>
      </div>
      {children}
    </div>
  );
}

export function Panel({ title, id, aside, children, className = "" }: { title: string; id: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={`${card} p-5 sm:p-6 ${className}`}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id} className="m-0 text-[17px] font-bold tracking-[-0.01em] rtl:tracking-normal">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

const TONE: Record<string, ChipTone> = { neutral: "neutral", info: "info", ok: "ok", warn: "warn", attention: "attention" };

export function StageChip({ stage, t }: { stage: Stage; t: Pick<CrmMessages, "stages"> }) {
  return (
    <Chip tone={TONE[STAGE_TONES[stage]] ?? "neutral"} data-stage={stage}>
      {t.stages[stage] ?? stage}
    </Chip>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="m-0 rounded-xl border border-dashed border-ink/20 p-4 text-[14px] text-ink-soft">{children}</p>;
}

export function Stat({ value, title, tone, href }: { value: number | string; title: string; tone?: "attention"; href?: string }) {
  // A card that links somewhere keeps the definition-list structure: the link
  // is the term, stretched over the whole card.
  return (
    <div className={`${card} relative flex flex-col-reverse px-4 py-3.5 ${href ? "transition-colors focus-within:border-ink/40 hover:border-ink/30" : ""}`}>
      <dt className="mt-1.5 text-[12.5px] font-semibold text-ink-soft">
        {href ? (
          <Link href={href} className="after:absolute after:inset-0 after:content-['']">
            {title}
          </Link>
        ) : (
          title
        )}
      </dt>
      <dd className={`m-0 text-[26px] leading-none font-bold tracking-[-0.02em] ${tone === "attention" && Number(value) > 0 ? "text-red-700" : ""}`}>{value}</dd>
    </div>
  );
}

export function RowList({ children, label }: { children: ReactNode; label: string }) {
  return (
    <ul aria-label={label} className="m-0 flex list-none flex-col p-0">
      {children}
    </ul>
  );
}

export const rowClass = "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t border-line py-2.5 text-[14px] first:border-t-0 first:pt-0";
export const linkClass = "font-semibold text-ink decoration-mint decoration-2 underline-offset-4 hover:underline";
export const smallMuted = "text-[12.5px] text-ink-faint";

// Whole days from an instant to a calendar day (YYYY-MM-DD), never negative.
export const daysBetween = (fromIso: string, toDay: string) => Math.max(0, Math.floor((Date.parse(`${toDay}T00:00:00Z`) - Date.parse(fromIso)) / 86_400_000));

"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/language-context";
import ScheduleEmbed from "./ScheduleEmbed";

// What the server decided for the link in the acknowledgment email (see
// src/lib/booking-recovery.ts). This component only presents that decision: it
// never checks a reference or an inquiry itself, and the scheduler exists only in
// the "schedule" state.
export type BookingRecoveryViewProps =
  | { state: "schedule"; bookingContext: string }
  | { state: "booked"; when: string | null; manageUrl: string | null }
  | { state: "closed" }
  | { state: "unavailable" }
  | { state: "error" };

const SUPPORT_EMAIL = "hello@mintapp.tech";

const linkClass = "font-semibold text-dark underline decoration-mint decoration-[1.5px] underline-offset-4 transition-colors hover:text-mint-deep";
const buttonClass = "inline-block cursor-pointer rounded-full border-0 bg-ink px-8 py-[15px] text-[15.5px] font-semibold text-white transition-colors hover:bg-mint hover:text-dark";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[640px] rounded-[24px] border border-ink/[.08] bg-surface p-[clamp(32px,5vw,56px)] text-center">
      <h1 tabIndex={-1} className="m-0 text-[clamp(26px,3.4vw,38px)] font-semibold tracking-[-0.02em] text-balance focus:outline-none">
        {title}
      </h1>
      {children}
    </div>
  );
}

export default function BookingRecoveryView(props: BookingRecoveryViewProps) {
  const { t, lang } = useLanguage();
  const b = t.book;
  const writeUs = (
    <a href={`mailto:${SUPPORT_EMAIL}`} className={linkClass}>
      {b.writeUs}: <bdi dir="ltr">{SUPPORT_EMAIL}</bdi>
    </a>
  );

  return (
    <section className="mx-auto max-w-[1280px] px-5 pt-[clamp(34px,5vw,68px)] pb-[clamp(60px,8vw,110px)] sm:px-6">
      {props.state === "schedule" && (
        <>
          <div className="mx-auto max-w-[640px] text-center">
            <h1 className="m-0 text-[clamp(28px,3.6vw,42px)] font-semibold tracking-[-0.02em] text-balance">{b.metaTitle}</h1>
            <p className="mx-auto mt-4 max-w-[46ch] text-[16px] leading-[1.85] text-ink-soft">{b.scheduleNote}</p>
          </div>
          <ScheduleEmbed bookingContext={props.bookingContext} lang={lang} copy={t.success.scheduling} />
        </>
      )}

      {props.state === "booked" && (
        <Panel title={b.bookedTitle}>
          <p className="mx-auto mt-4 max-w-[46ch] text-[16px] leading-[1.85] text-ink-soft">
            {props.when ? b.bookedBody.replace("{when}", props.when) : b.bookedBodyNoTime}
          </p>
          <div className="mt-7 flex flex-col items-center gap-4">
            {props.manageUrl && (
              <a href={props.manageUrl} target="_blank" rel="noopener noreferrer" className={buttonClass}>
                {b.manage}
              </a>
            )}
            <p className="m-0 text-[14px]">{writeUs}</p>
          </div>
        </Panel>
      )}

      {props.state === "closed" && (
        <Panel title={b.closedTitle}>
          <p className="mx-auto mt-4 max-w-[46ch] text-[16px] leading-[1.85] text-ink-soft">{b.closedBody}</p>
          <p className="mt-7 mb-0 text-[14px]">{writeUs}</p>
        </Panel>
      )}

      {props.state === "unavailable" && (
        <Panel title={b.unavailableTitle}>
          <p className="mx-auto mt-4 max-w-[46ch] text-[16px] leading-[1.85] text-ink-soft">{b.unavailableBody}</p>
          <div className="mt-7 flex flex-col items-center gap-4">
            <Link href={`/${lang}/start`} className={buttonClass}>
              {b.restart}
            </Link>
            <p className="m-0 text-[14px]">{writeUs}</p>
          </div>
        </Panel>
      )}

      {props.state === "error" && (
        <Panel title={b.errorTitle}>
          <p className="mx-auto mt-4 max-w-[46ch] text-[16px] leading-[1.85] text-ink-soft">{b.errorBody}</p>
          <p className="mt-7 mb-0 text-[14px]">{writeUs}</p>
        </Panel>
      )}
    </section>
  );
}

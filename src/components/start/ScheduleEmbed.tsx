"use client";

import { useEffect, useState } from "react";
import Cal, { getCalApi } from "@calcom/embed-react";

// Own namespace so this embed's event listeners (linkReady/linkFailed) can
// never receive events from any other, unrelated Cal embed that might exist
// on the page in the future.
const NAMESPACE = "mintapp-discovery-call";
// MENA/mobile network conditions can be slow — 8s (the Turnstile-script
// timeout) was judged too aggressive for this specific embed.
const READY_TIMEOUT_MS = 15000;
const SUPPORT_EMAIL = "hello@mintapp.tech";
const HEADING_ID = "schedule-embed-heading";

type Status = "loading" | "ready" | "failed";

export interface ScheduleEmbedCopy {
  title: string;
  intro: string;
  errorTitle: string;
  errorBody: string;
  retry: string;
  loading: string;
  languageNote: string;
}

interface ScheduleEmbedProps {
  bookingContext: string;
  lang: "en" | "ar";
  copy: ScheduleEmbedCopy;
}

export default function ScheduleEmbed({ bookingContext, lang, copy }: ScheduleEmbedProps) {
  const calLink = process.env.NEXT_PUBLIC_CAL_LINK;
  const [status, setStatus] = useState<Status>(calLink ? "loading" : "failed");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!calLink) return;
    let cancelled = false;

    let cal: Awaited<ReturnType<typeof getCalApi>> | null = null;
    let timeoutId: number | null = null;

    // Never reading or logging event.detail: Cal.com documents that
    // linkFailed's data may include the request URL, and other embed events
    // (e.g. bookingCancelled) carry organizer name/email. Only the fixed
    // local status transition is ever derived from these callbacks.
    const onReady = () => {
      if (cancelled) return;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      setStatus("ready");
    };
    const onFailed = () => {
      if (cancelled) return;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      setStatus("failed");
    };

    getCalApi({ namespace: NAMESPACE }).then((api) => {
      if (cancelled) return;
      cal = api;
      cal("on", { action: "linkReady", callback: onReady });
      cal("on", { action: "linkFailed", callback: onFailed });
    });

    timeoutId = window.setTimeout(() => {
      if (!cancelled) setStatus("failed");
    }, READY_TIMEOUT_MS);

    return () => {
      cancelled = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      if (cal) {
        cal("off", { action: "linkReady", callback: onReady });
        cal("off", { action: "linkFailed", callback: onFailed });
      }
    };
  }, [calLink, attempt]);

  const failed = status === "failed";

  return (
    <div className="mx-auto mt-[clamp(28px,4vw,44px)] w-full max-w-[1100px]">
      <h2 id={HEADING_ID} className="m-0 text-[clamp(20px,2.4vw,26px)] font-semibold tracking-[-0.01em] text-balance">
        {copy.title}
      </h2>
      <p className="mx-auto mt-2 max-w-[60ch] text-[15px] leading-[1.8] text-ink-soft">{copy.intro}</p>
      {lang === "ar" && copy.languageNote && <p className="mt-1 text-[13px] text-ink-faint">{copy.languageNote}</p>}

      <span role="status" aria-live="polite" className="sr-only">
        {status === "loading" ? copy.loading : ""}
      </span>

      {failed ? (
        <div className="mt-5 rounded-2xl border border-ink/[.08] bg-canvas p-6 text-start">
          <p role="alert" className="m-0 text-[14.5px] font-semibold text-red-600">
            {copy.errorTitle}
          </p>
          <p className="m-0 mt-2 max-w-[60ch] text-[14px] leading-[1.7] text-ink-soft">{copy.errorBody}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setStatus("loading");
                setAttempt((n) => n + 1);
              }}
              className="cursor-pointer rounded-full border border-ink/[.16] bg-canvas px-5 py-2.5 text-[13.5px] font-semibold text-ink transition-colors hover:border-ink/30"
            >
              {copy.retry}
            </button>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-[13.5px] font-semibold text-dark underline decoration-mint decoration-[1.5px] underline-offset-4 transition-colors hover:text-mint-deep"
            >
              {SUPPORT_EMAIL}
            </a>
          </div>
        </div>
      ) : (
        <div
          role="region"
          aria-labelledby={HEADING_ID}
          className="mt-5 min-h-[560px] w-full overflow-hidden rounded-2xl border border-ink/[.08]"
        >
          {calLink && (
            <Cal
              key={attempt}
              namespace={NAMESPACE}
              calLink={calLink}
              config={{ "metadata[bookingContext]": bookingContext }}
              style={{ width: "100%", height: "100%", minHeight: "560px", overflow: "hidden" }}
            />
          )}
        </div>
      )}
    </div>
  );
}

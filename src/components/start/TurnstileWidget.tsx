"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TURNSTILE_ACTION = "start_project";
// If the script neither loads nor errors within this window (a silent block
// by an ad-blocker/network policy often looks like nothing happening at
// all, not a clean error event), treat it the same as a load failure.
const SCRIPT_LOAD_TIMEOUT_MS = 8000;

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          action: string;
          language: string;
          callback: (token: string) => void;
          "error-callback": () => void;
          "expired-callback": () => void;
          "timeout-callback": () => void;
        },
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

export interface TurnstileWidgetHandle {
  reset: () => void;
}

interface TurnstileWidgetProps {
  siteKey: string;
  lang: "en" | "ar";
  onToken: (token: string) => void;
  onError: () => void;
  onExpired: () => void;
  onTimeout: () => void;
  onScriptError: () => void;
  retryLabel: string;
}

const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(function TurnstileWidget(
  { siteKey, lang, onToken, onError, onExpired, onTimeout, onScriptError, retryLabel },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptFailed, setScriptFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
      }
    },
  }));

  useEffect(() => {
    setScriptFailed(false);
    let cancelled = false;

    function renderWidget() {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action: TURNSTILE_ACTION,
        language: lang,
        // Never logging the token itself here or anywhere downstream.
        callback: (token) => onToken(token),
        "error-callback": () => onError(),
        "expired-callback": () => onExpired(),
        "timeout-callback": () => onTimeout(),
      });
    }

    if (window.turnstile) {
      renderWidget();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[data-turnstile-loader="true"]`);
    const script = existing ?? document.createElement("script");
    if (!existing) {
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.dataset.turnstileLoader = "true";
      document.head.appendChild(script);
    }

    const timeoutId = window.setTimeout(() => {
      if (!cancelled && !window.turnstile) {
        setScriptFailed(true);
        onScriptError();
      }
    }, SCRIPT_LOAD_TIMEOUT_MS);

    const handleLoad = () => {
      window.clearTimeout(timeoutId);
      renderWidget();
    };
    const handleError = () => {
      window.clearTimeout(timeoutId);
      if (!cancelled) {
        setScriptFailed(true);
        onScriptError();
      }
    };

    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey, lang, attempt]);

  if (scriptFailed) {
    return (
      <button
        type="button"
        onClick={() => setAttempt((n) => n + 1)}
        className="cursor-pointer rounded-[10px] border border-ink/[.16] bg-canvas px-4 py-2.5 text-[13px] font-medium text-ink transition-colors hover:border-ink/30"
      >
        {retryLabel}
      </button>
    );
  }

  return <div ref={containerRef} />;
});

export default TurnstileWidget;

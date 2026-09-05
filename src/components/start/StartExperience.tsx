"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "@/lib/language-context";
import { Reveal } from "@/components/Reveal";
import { Magnetic } from "@/components/motion/Magnetic";
import { INQUIRY_LIMITS } from "@/lib/inquiry-limits";
import TurnstileWidget, { type TurnstileWidgetHandle } from "./TurnstileWidget";
import ScheduleEmbed from "./ScheduleEmbed";

const easeOut = [0.2, 0.7, 0.2, 1] as const;

// Generous bound on the signed booking-context token — well above any
// realistic size (base64url payload + signature, ~90 chars in practice) but
// still a firm ceiling against a malformed/oversized success body.
const BOOKING_CONTEXT_MAX_LENGTH = 512;

interface FormState {
  name: string;
  company: string;
  email: string;
  phone: string;
  desc: string;
}

const emptyForm: FormState = { name: "", company: "", email: "", phone: "", desc: "" };

// Visual/reading order of the fields that can carry a server-side error —
// used to find "the first invalid field" for focus management.
const FIELD_ORDER: (keyof FormState)[] = ["name", "company", "email", "phone", "desc"];

const inputClass =
  "w-full rounded-[14px] border border-ink/[.14] bg-canvas px-4 py-3 text-[15.5px] text-ink placeholder:text-ink-faint transition-colors focus:border-mint-deep focus:outline-none";

function readUtmParams() {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get("utm_source")?.slice(0, INQUIRY_LIMITS.utmMax) || undefined;
  const utmMedium = params.get("utm_medium")?.slice(0, INQUIRY_LIMITS.utmMax) || undefined;
  const utmCampaign = params.get("utm_campaign")?.slice(0, INQUIRY_LIMITS.utmMax) || undefined;
  return { utmSource, utmMedium, utmCampaign };
}

export default function StartExperience() {
  const { t, lang } = useLanguage();
  const router = useRouter();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [honeypot, setHoneypot] = useState("");
  const [consent, setConsent] = useState(false);
  const [consentTouched, setConsentTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<{ name: string; bookingContext?: string } | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  // Generated once per form session — stable across retries of the same
  // submission (so a duplicate POST is recognized server-side as the same
  // attempt), and only replaced after a genuinely new/reset form.
  const submissionTokenRef = useRef<string>(crypto.randomUUID());
  const formStartedAtRef = useRef<string>(new Date().toISOString());
  const utmRef = useRef(readUtmParams());

  const errorRef = useRef<HTMLParagraphElement>(null);
  const nameFieldRef = useRef<HTMLInputElement>(null);
  const companyFieldRef = useRef<HTMLInputElement>(null);
  const emailFieldRef = useRef<HTMLInputElement>(null);
  const phoneFieldRef = useRef<HTMLInputElement>(null);
  const descFieldRef = useRef<HTMLTextAreaElement>(null);

  // A callback ref (not a useEffect keyed on `submitted`) so focus is
  // applied exactly when this heading actually mounts. AnimatePresence
  // mode="wait" delays mounting the success panel until the form panel's
  // exit animation finishes — by then, an effect keyed on `submitted` has
  // already run and found the ref still null, and nothing re-triggers it
  // once the node appears. A stable-identity callback ref has no such gap:
  // React calls it exactly once when the node mounts, never on ordinary
  // rerenders, and it does nothing on unmount (node is null) — so nothing
  // here ever moves focus again later (embed readiness, timeout, retry).
  const focusSuccessHeading = useCallback((node: HTMLHeadingElement | null) => {
    node?.focus();
  }, []);

  useEffect(() => {
    if (submitError) errorRef.current?.focus();
  }, [submitError]);

  useEffect(() => {
    if (Object.keys(fieldErrors).length === 0) return;
    // Move focus to the first invalid field in reading order — the summary
    // above stays for screen-reader users who tab from the top rather than
    // land directly on a field.
    const firstInvalid = FIELD_ORDER.find((key) => fieldErrors[key]);
    switch (firstInvalid) {
      case "name":
        nameFieldRef.current?.focus();
        break;
      case "company":
        companyFieldRef.current?.focus();
        break;
      case "email":
        emailFieldRef.current?.focus();
        break;
      case "phone":
        phoneFieldRef.current?.focus();
        break;
      case "desc":
        descFieldRef.current?.focus();
        break;
    }
  }, [fieldErrors]);

  const canSubmit = Boolean(form.name.trim() && form.email.trim() && form.desc.trim() && consent && turnstileToken);

  const updateField = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    // Clear this field's server-reported error the moment the user changes
    // it — the old error may no longer be true, and re-validating fully
    // client-side on every keystroke isn't worth the complexity here since
    // the server remains authoritative on the next real submit anyway.
    setFieldErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  function messageForCode(code: string): string {
    const messages = t.start.fieldErrorMessages;
    return (messages as Record<string, string>)[code] ?? messages.invalid;
  }

  // A rejected or uncertain attempt must not let the client retry with a
  // stale/already-consumed token — reset the widget so a fresh one is
  // acquired before the next attempt can even be enabled again.
  function resetTurnstile() {
    setTurnstileToken(null);
    turnstileRef.current?.reset();
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!consent) {
      setConsentTouched(true);
      return;
    }
    if (!canSubmit || submitting || !turnstileToken) return;

    setSubmitting(true);
    setSubmitError(null);
    setFieldErrors({});

    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          company: form.company.trim() || undefined,
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          desc: form.desc.trim(),
          lang,
          consent,
          submissionToken: submissionTokenRef.current,
          formStartedAt: formStartedAtRef.current,
          honeypot,
          turnstileToken,
          ...utmRef.current,
        }),
      });

      if (res.ok) {
        // Success (including the "already received" duplicate-token case,
        // which is still a 2xx) — either way, this exact submission is done.
        // bookingContext is read defensively: the inquiry is already
        // durably accepted server-side by this point, so a malformed body,
        // an unparseable response, or an out-of-shape bookingContext value
        // must never lose that success — it only means no scheduling
        // section renders, falling back to the "unavailable" copy instead.
        // The server-only context verifier is never imported here; this is
        // a plain shape/bounds check, not a signature check.
        let bookingContext: string | undefined;
        try {
          const parsedBody: unknown = await res.json();
          if (parsedBody && typeof parsedBody === "object") {
            const value = (parsedBody as Record<string, unknown>).bookingContext;
            if (typeof value === "string" && value.length > 0 && value.length <= BOOKING_CONTEXT_MAX_LENGTH) {
              bookingContext = value;
            }
          }
        } catch {
          // Non-JSON or empty success body — treated as "no context".
        }
        setSubmitted({ name: form.name.trim(), bookingContext });
        return;
      }

      let body: { error?: string; code?: string; fields?: Record<string, string> } | null = null;
      try {
        body = await res.json();
      } catch {
        // Non-JSON error body — fall through to the generic message below.
      }

      if (body?.code === "turnstile_failed") {
        setSubmitError(t.start.turnstileFailed);
        resetTurnstile();
      } else if (body?.code === "turnstile_unavailable") {
        setSubmitError(t.start.turnstileUnavailable);
        resetTurnstile();
      } else if (body?.fields && Object.keys(body.fields).length > 0) {
        // A field-validation rejection never reaches Turnstile server-side
        // (see route.ts's order), so the current token is still fresh —
        // no reset needed here.
        setFieldErrors(body.fields);
      } else {
        setSubmitError(t.start.submitError);
        resetTurnstile();
      }
    } catch {
      // Network failure of unknown extent — safer to assume the token may
      // have been consumed and require a fresh one.
      setSubmitError(t.start.submitError);
      resetTurnstile();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-[1280px] px-5 pt-[clamp(34px,5vw,68px)] pb-[clamp(60px,8vw,110px)] sm:px-6">
      {/* Polite live region for the loading state only — the error state uses
          its own role="alert" (assertive) below, so nothing double-announces. */}
      <span role="status" aria-live="polite" className="sr-only">
        {submitting ? t.start.sending : ""}
      </span>

      <AnimatePresence mode="wait">
        {submitted ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.5, ease: easeOut }}
            className="mx-auto w-full"
          >
            <div className="mx-auto max-w-[640px] rounded-[24px] border border-ink/[.08] bg-surface p-[clamp(32px,5vw,56px)] text-center">
              <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-mint-soft px-4 py-1.5 text-[13px] font-semibold text-mint-deep">
                <span className="block h-1.5 w-1.5 rounded-full bg-mint-deep" />
                {t.success.badge}
              </span>
              <h1
                ref={focusSuccessHeading}
                tabIndex={-1}
                className="m-0 text-[clamp(28px,3.6vw,42px)] font-semibold tracking-[-0.02em] text-balance focus:outline-none"
              >
                {t.success.title}
              </h1>
              <p className="mx-auto mt-4 max-w-[46ch] text-[16px] leading-[1.85] text-ink-soft">{t.success.copy}</p>

              <div className="mx-auto mt-8 max-w-[440px] text-start">
                <div className="mb-3 text-[15px] font-semibold">{t.success.nextTitle}</div>
                <div className="flex flex-col gap-2.5">
                  {t.success.next.map((point) => (
                    <div key={point} className="flex items-start gap-2.5 text-[14.5px] leading-[1.7] text-ink-soft">
                      <span className="mt-2 block h-[5px] w-[5px] flex-none rounded-full bg-mint-deep" />
                      {point}
                    </div>
                  ))}
                </div>
              </div>

              <Magnetic className="mx-auto mt-9 inline-block">
                <button
                  onClick={() => router.push(`/${lang}`)}
                  className="cursor-pointer rounded-full border-0 bg-ink px-8 py-[15px] text-[15.5px] font-semibold text-white transition-colors hover:bg-mint hover:text-dark"
                >
                  {t.success.home}
                </button>
              </Magnetic>
              <p className="mt-5 text-[13px] text-ink-soft">{t.success.note}</p>
            </div>

            {submitted.bookingContext ? (
              <ScheduleEmbed bookingContext={submitted.bookingContext} lang={lang} copy={t.success.scheduling} />
            ) : (
              <div className="mx-auto mt-8 max-w-[440px] rounded-2xl border border-ink/[.08] bg-canvas p-5 text-start">
                <p className="m-0 text-[14.5px] leading-[1.7] text-ink-soft">{t.success.scheduling.unavailable}</p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.5, ease: easeOut }}
          >
            <Reveal className="mx-auto max-w-[70ch] text-center">
              <h1 className="m-0 text-[clamp(30px,4vw,48px)] font-semibold leading-[1.16] tracking-[-0.02em] text-balance">
                {t.start.title}
              </h1>
              <p className="mx-auto mt-4 max-w-[56ch] text-[16.5px] leading-[1.85] text-ink-soft">{t.start.sub}</p>
            </Reveal>

            <div className="mt-[clamp(36px,5vw,60px)] grid grid-cols-1 gap-8 lg:grid-cols-[1.4fr_1fr] lg:gap-10">
              <Reveal as="div">
                <form onSubmit={handleSubmit} noValidate={false} className="flex flex-col gap-5 rounded-[24px] border border-ink/[.08] bg-surface p-[clamp(22px,3vw,36px)]">
                  {/* Honeypot: invisible and unreachable for real users (aria-hidden +
                      not focusable), but present in the DOM for bots that blindly fill
                      every input. Any non-empty value here is treated as a bot signal
                      server-side, silently, before anything else is validated. */}
                  <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                    <label>
                      Leave this field blank
                      <input
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                        value={honeypot}
                        onChange={(e) => setHoneypot(e.target.value)}
                      />
                    </label>
                  </div>

                  {Object.keys(fieldErrors).length > 0 && (
                    <p role="alert" className="m-0 text-[13.5px] font-medium text-red-600">
                      {t.start.errorSummary}
                    </p>
                  )}

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <label className="flex flex-col gap-2 text-[14px] font-medium text-ink">
                      {t.start.fName}
                      <input
                        ref={nameFieldRef}
                        required
                        maxLength={INQUIRY_LIMITS.nameMax}
                        value={form.name}
                        onChange={updateField("name")}
                        aria-invalid={!!fieldErrors.name}
                        aria-describedby={fieldErrors.name ? "name-error" : undefined}
                        className={`${inputClass} ${fieldErrors.name ? "border-red-500" : ""}`}
                      />
                      {fieldErrors.name && (
                        <span id="name-error" className="text-[12.5px] font-medium text-red-600">
                          {messageForCode(fieldErrors.name)}
                        </span>
                      )}
                    </label>
                    <label className="flex flex-col gap-2 text-[14px] font-medium text-ink">
                      {t.start.fCompany}{" "}
                      <span className="font-normal text-ink-faint">({t.start.optional})</span>
                      <input
                        ref={companyFieldRef}
                        maxLength={INQUIRY_LIMITS.companyMax}
                        value={form.company}
                        onChange={updateField("company")}
                        aria-invalid={!!fieldErrors.company}
                        aria-describedby={fieldErrors.company ? "company-error" : undefined}
                        className={`${inputClass} ${fieldErrors.company ? "border-red-500" : ""}`}
                      />
                      {fieldErrors.company && (
                        <span id="company-error" className="text-[12.5px] font-medium text-red-600">
                          {messageForCode(fieldErrors.company)}
                        </span>
                      )}
                    </label>
                    <label className="flex flex-col gap-2 text-[14px] font-medium text-ink">
                      {t.start.fEmail}
                      <input
                        ref={emailFieldRef}
                        required
                        type="email"
                        maxLength={INQUIRY_LIMITS.emailMax}
                        value={form.email}
                        onChange={updateField("email")}
                        aria-invalid={!!fieldErrors.email}
                        aria-describedby={fieldErrors.email ? "email-error" : undefined}
                        className={`${inputClass} ${fieldErrors.email ? "border-red-500" : ""}`}
                      />
                      {fieldErrors.email && (
                        <span id="email-error" className="text-[12.5px] font-medium text-red-600">
                          {messageForCode(fieldErrors.email)}
                        </span>
                      )}
                    </label>
                    <label className="flex flex-col gap-2 text-[14px] font-medium text-ink">
                      {t.start.fPhone} <span className="font-normal text-ink-faint">({t.start.optional})</span>
                      <input
                        ref={phoneFieldRef}
                        maxLength={INQUIRY_LIMITS.phoneMax}
                        value={form.phone}
                        onChange={updateField("phone")}
                        aria-invalid={!!fieldErrors.phone}
                        aria-describedby={fieldErrors.phone ? "phone-error" : undefined}
                        className={`${inputClass} ${fieldErrors.phone ? "border-red-500" : ""}`}
                      />
                      {fieldErrors.phone && (
                        <span id="phone-error" className="text-[12.5px] font-medium text-red-600">
                          {messageForCode(fieldErrors.phone)}
                        </span>
                      )}
                    </label>
                  </div>

                  <label className="flex flex-col gap-2 text-[14px] font-medium text-ink">
                    {t.start.fDesc}
                    <span className="text-[13.5px] font-normal leading-[1.6] text-ink-soft">{t.start.fDescHelp}</span>
                    <textarea
                      ref={descFieldRef}
                      required
                      minLength={INQUIRY_LIMITS.descMin}
                      maxLength={INQUIRY_LIMITS.descMax}
                      value={form.desc}
                      onChange={updateField("desc")}
                      placeholder={t.start.fDescPh}
                      rows={5}
                      aria-invalid={!!fieldErrors.desc}
                      aria-describedby={fieldErrors.desc ? "desc-error" : undefined}
                      className={`${inputClass} resize-none ${fieldErrors.desc ? "border-red-500" : ""}`}
                    />
                    {fieldErrors.desc && (
                      <span id="desc-error" className="text-[12.5px] font-medium text-red-600">
                        {messageForCode(fieldErrors.desc)}
                      </span>
                    )}
                  </label>

                  <div className="rounded-[14px] border border-ink/[.1] bg-canvas px-4 py-3.5">
                    <div className="mb-2 text-[13px] font-semibold text-ink">{t.start.confidentialTitle}</div>
                    <div className="flex flex-col gap-1.5">
                      {t.start.confidentialItems.map((item) => (
                        <div key={item} className="flex items-start gap-2 text-[13px] leading-[1.6] text-ink-soft">
                          <span className="mt-[7px] block h-[4px] w-[4px] flex-none rounded-full bg-ink-faint" />
                          {item}
                        </div>
                      ))}
                    </div>
                    <p className="m-0 mt-2.5 text-[12.5px] leading-[1.6] text-ink-faint">{t.start.confidentialNote}</p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="flex cursor-pointer items-start gap-3 text-[13.5px] leading-[1.65] text-ink">
                      <input
                        type="checkbox"
                        required
                        checked={consent}
                        onChange={(e) => {
                          setConsent(e.target.checked);
                          setConsentTouched(true);
                        }}
                        aria-invalid={consentTouched && !consent}
                        aria-describedby={consentTouched && !consent ? "consent-error" : undefined}
                        className="mt-[3px] h-[18px] w-[18px] flex-none cursor-pointer rounded-[5px] border border-ink/[.3] bg-canvas text-mint-deep accent-mint-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint-deep"
                      />
                      <span>
                        {t.start.consentPrefix}
                        <Link
                          href={`/${lang}/privacy`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-dark underline decoration-mint decoration-[1.5px] underline-offset-4 transition-colors hover:text-mint-deep"
                        >
                          {t.start.consentLinkText}
                        </Link>
                        {t.start.consentSuffix}
                      </span>
                    </label>
                    {consentTouched && !consent && (
                      <p id="consent-error" role="alert" className="text-[13px] font-medium text-red-600">
                        {t.start.consentError}
                      </p>
                    )}
                  </div>

                  {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
                    <TurnstileWidget
                      ref={turnstileRef}
                      siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                      lang={lang}
                      retryLabel={t.start.turnstileRetry}
                      onToken={(token) => setTurnstileToken(token)}
                      onError={() => {
                        setTurnstileToken(null);
                        setSubmitError(t.start.turnstileFailed);
                      }}
                      onExpired={() => setTurnstileToken(null)}
                      onTimeout={() => setTurnstileToken(null)}
                      onScriptError={() => setSubmitError(t.start.turnstileScriptError)}
                    />
                  )}

                  <Magnetic className={canSubmit && !submitting ? "self-start" : "pointer-events-none self-start"}>
                    <button
                      type="submit"
                      disabled={!canSubmit || submitting}
                      className={`rounded-full border-0 px-8 py-[16px] text-[16px] font-semibold transition-colors ${
                        canSubmit && !submitting
                          ? "cursor-pointer bg-ink text-white hover:bg-mint hover:text-dark"
                          : "cursor-not-allowed bg-ink/[.16] text-ink/45"
                      }`}
                    >
                      {submitting ? t.start.sending : t.start.cta}
                    </button>
                  </Magnetic>
                  {submitError && (
                    <p ref={errorRef} tabIndex={-1} role="alert" className="text-[13px] font-medium text-red-600 focus:outline-none">
                      {submitError}
                    </p>
                  )}
                  <p className="text-[13px] text-ink-soft">{t.start.privacy}</p>
                </form>
              </Reveal>

              <Reveal as="div" delay={0.1}>
                <div className="rounded-[24px] border border-ink/[.08] bg-canvas p-[clamp(22px,3vw,30px)] lg:sticky lg:top-[100px]">
                  <div className="mb-4 text-[16px] font-semibold">{t.start.sideTitle}</div>
                  <div className="flex flex-col gap-4">
                    {t.start.sidePoints.map((point, i) => (
                      <div key={point.t} className="flex items-start gap-3.5">
                        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-[9px] bg-dark font-manrope text-[13px] font-bold text-mint">
                          {i + 1}
                        </span>
                        <div>
                          <div className="mb-1 text-[15px] font-semibold">{point.t}</div>
                          <div className="text-[14px] leading-[1.7] text-ink-soft">{point.d}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-5 border-t border-ink/[.08] pt-4 text-[13.5px] leading-[1.7] text-ink-soft">{t.start.prepClarify}</p>
                  <p className="mt-3 text-[13px] text-ink-soft">{t.start.sideNote}</p>
                </div>
              </Reveal>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

import "server-only";

export type EmailSendingMode = "send" | "disabled";

export class EmailSendingModeConfigError extends Error {}

// Central fail-safe for real email delivery. A valid RESEND_API_KEY alone is
// not sufficient to send a real email — an incident during Turnstile testing
// proved that (a live browser test unexpectedly sent a real notification
// because no separate switch existed). This function is the single place
// that decides whether a send may actually be attempted:
//
//   - production: EMAIL_SENDING_MODE must be explicitly "send" or "disabled".
//     Missing/unrecognized throws — a loud, attention-getting failure rather
//     than a silent guess in either direction.
//   - test/CI (NODE_ENV=test or CI=true): always "disabled", regardless of
//     what EMAIL_SENDING_MODE is set to — automation must never be able to
//     send real email even via a mistaken "send" value. Checked first, so it
//     wins even if NODE_ENV=production were ever combined with CI=true.
//   - anything else (local development): defaults to "disabled"; "send"
//     requires a deliberate opt-in. Any other value is treated the same as
//     unset (disabled) with a sanitized warning — never escalated to "send".
export function resolveEmailSendingMode(): EmailSendingMode {
  const raw = process.env.EMAIL_SENDING_MODE;
  const isTestOrCI = process.env.NODE_ENV === "test" || process.env.CI === "true";
  const isProduction = process.env.NODE_ENV === "production";

  if (isTestOrCI) {
    return "disabled";
  }

  if (isProduction) {
    if (raw === "send" || raw === "disabled") return raw;
    throw new EmailSendingModeConfigError(
      "EMAIL_SENDING_MODE must be explicitly set to 'send' or 'disabled' in production.",
    );
  }

  if (raw === "send") return "send";
  if (raw !== undefined && raw !== "disabled") {
    console.error("email_sending_mode_invalid: unrecognized value outside production, defaulting to disabled");
  }
  return "disabled";
}

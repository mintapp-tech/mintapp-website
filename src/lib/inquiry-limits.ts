// Shared between the client (maxLength/UX hints) and the server (source of
// truth for src/lib/inquiry-schema.ts). Deliberately has no Zod import, so
// importing this into a client component doesn't pull Zod into the browser
// bundle — only the numbers do.
export const INQUIRY_LIMITS = {
  nameMin: 2,
  nameMax: 200,
  emailMax: 320, // matches the live email_length CHECK constraint exactly
  phoneMax: 40, // matches the live phone_length CHECK constraint exactly
  companyMax: 200,
  // Meaningful minimum so "hi" isn't a usable submission, and a maximum kept
  // well under the live database's own description_length check constraint
  // (empirically confirmed to reject ~500,000 chars; exact threshold pending
  // live inspection — 5,000 is a generous product-level cap regardless).
  descMin: 20,
  descMax: 5000,
  utmMax: 200,
  // Anti-bot timing window. `formStartedAt` is a client-supplied timestamp —
  // entirely user-controlled, trivially spoofable by anyone who wants to.
  // This is basic friction against naive/scripted spam, NOT a security
  // control and NOT proof of human intent; do not rely on it as such.
  //
  // minSubmitSeconds: kept low deliberately. The goal is only to catch
  // submissions completed faster than a human could plausibly act (a script
  // that POSTs within milliseconds of loading the page), not to challenge
  // a fast real person — someone with autofilled contact fields and a
  // pre-written, pasted description could legitimately submit in 2-3
  // seconds, and this must never reject that person.
  minSubmitSeconds: 2,
  // maxFormAgeMs: rejects a stale/replayed form session (tab left open for
  // hours, or a captured request replayed later) with an honest "please
  // refresh" error — a real UX case, not a bot signal, handled differently
  // from the too-fast case for exactly that reason.
  maxFormAgeMs: 1000 * 60 * 60 * 4, // 4 hours
} as const;

// Strips CR/LF and other control characters from a value before it could
// ever reach a header-like context (email subject/From/To, etc.), where an
// embedded newline could otherwise be used to inject extra headers. Not
// currently load-bearing for the notification email — the subject is a
// fixed string precisely to remove that surface entirely (see route.ts) —
// but kept as a small, reusable guard for any future header-adjacent use of
// user-supplied text, and applied defensively regardless.
export function sanitizeHeaderValue(value: string, maxLength: number, fallback: string): string {
  const cleaned = value.replace(/[\r\n\x00-\x1F\x7F]/g, "").trim();
  if (!cleaned) return fallback;
  return cleaned.slice(0, maxLength);
}
